import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isTokenValid } from "@/lib/token";
import { getAvailableSlots, createCalendarEvent } from "@/lib/graph";
import { invalidateCache } from "@/lib/cache";
import { sendConfirmedMail } from "@/lib/mail";
import { ScheduleStatus } from "@prisma/client";
import { startOfDay, addDays } from "date-fns";
import { z } from "zod";

// UTC ISO搪 → JSTの読みやすい文字列に変換
function toJSTString(utcIso: string): string {
    return new Date(utcIso).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// UTC ISO → Graph API用 JST DateTimeString（末尾のZなし）
function toGraphJSTDateTime(utcIso: string): string {
    // UTC時刻に9時間加算してJST文字列として出力
    const jst = new Date(new Date(utcIso).getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().slice(0, 19); // "YYYY-MM-DDTHH:MM:SS"
}

const selectSchema = z.object({
    token: z.string(),
    slotStart: z.string(), // ISO8601
    slotEnd: z.string(),
    message: z.string().optional(),
});

// 社外ゲストが日時を選択・確定する
export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = selectSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { token, slotStart, slotEnd, message } = parsed.data;

    // トランザクションで排他制御
    try {
        const result = await prisma.$transaction(async (tx) => {
            const schedule = await tx.scheduleRequest.findUnique({
                where: { guestToken: token },
                include: {
                    participants: { select: { email: true } },
                    creator: { select: { email: true, name: true } },
                    timeSlots: { where: { isActive: true } },
                },
            });

            if (!schedule) throw new Error("NOT_FOUND");
            if (!isTokenValid(schedule.expiresAt)) throw new Error("EXPIRED");
            if (schedule.status !== ScheduleStatus.PENDING) throw new Error("ALREADY_CONFIRMED");

            // 排他制御：Graph APIで再確認
            const emails = schedule.participants.map((p) => p.email);
            const startDate = startOfDay(new Date());
            const endDate = addDays(startDate, 31);

            const currentSlots = await getAvailableSlots(
                emails,
                startDate,
                endDate,
                schedule.duration
            );

            const selectedStart = new Date(slotStart).getTime();
            const selectedEnd = new Date(slotEnd).getTime();

            // 選択した時間が今もまだ空いているか確認
            const isStillAvailable = currentSlots.some(
                (s) =>
                    new Date(s.start).getTime() === selectedStart &&
                    new Date(s.end).getTime() === selectedEnd
            );

            if (!isStillAvailable) {
                throw new Error("CONFLICT");
            }

            // TimeSlotを作成または既存を取得
            let timeSlot = await tx.timeSlot.findFirst({
                where: {
                    scheduleId: schedule.id,
                    startTime: new Date(slotStart),
                    endTime: new Date(slotEnd),
                },
            });

            if (!timeSlot) {
                timeSlot = await tx.timeSlot.create({
                    data: {
                        scheduleId: schedule.id,
                        startTime: new Date(slotStart),
                        endTime: new Date(slotEnd),
                    },
                });
            }

            // GuestSelectionを作成
            const selection = await tx.guestSelection.create({
                data: {
                    scheduleId: schedule.id,
                    slotId: timeSlot.id,
                    message,
                },
            });

            // スケジュールを確定に更新
            const updated = await tx.scheduleRequest.update({
                where: { id: schedule.id },
                data: {
                    status: ScheduleStatus.CONFIRMED,
                    confirmedAt: new Date(),
                    confirmedSlotId: timeSlot.id,
                },
            });

            return {
                schedule: updated,
                selection,
                creator: schedule.creator,
                slotStart,
                slotEnd,
                participantEmails: schedule.participants.map((p) => p.email),
                scheduleLocation: schedule.location,
                scheduleTitle: schedule.title,
            };
        });

        // キャッシュを無効化
        await invalidateCache(result.schedule.id);

        // 確定通知メールを作成者へ送信（非同期）
        const datetimeStr = `${toJSTString(result.slotStart)}〜${new Date(result.slotEnd).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })}`;
        sendConfirmedMail(
            result.creator.email,
            {
                title: result.schedule.title,
                datetime: datetimeStr,
                message: result.selection.message ?? "",
                creator_name: result.creator.name ?? "",
            },
            result.schedule.id
        ).catch(console.error);

        // Outlookカレンダーに予定を作成（非同期・エラー無視）
        const finalAttendees = [...result.participantEmails];
        if (!finalAttendees.includes(result.creator.email)) {
            finalAttendees.push(result.creator.email);
        }

        createCalendarEvent(
            result.creator.email,
            finalAttendees,
            result.scheduleTitle,
            toGraphJSTDateTime(result.slotStart),
            toGraphJSTDateTime(result.slotEnd),
            result.scheduleLocation ?? undefined,
        ).catch((err) => console.error("Calendar event creation failed:", err));

        // DB設定から完了メッセージを取得して返す
        const completionMsg = await prisma.siteConfig.findUnique({
            where: { key: "wording_completion_message" },
        });

        return NextResponse.json({
            success: true,
            message: completionMsg?.value ?? "日程のご確認ありがとうございます。担当者より改めてご連絡いたします。",
        });
    } catch (error: any) {
        if (error.message === "CONFLICT") {
            const conflictMsg = await prisma.siteConfig.findUnique({
                where: { key: "wording_conflict_message" },
            });
            return NextResponse.json(
                {
                    error: "CONFLICT",
                    message: conflictMsg?.value ?? "行き違いで選択した日時が埋まってしまったようです。再選択をお願いします。",
                },
                { status: 409 }
            );
        }
        if (error.message === "EXPIRED") {
            return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
        }
        if (error.message === "ALREADY_CONFIRMED") {
            return NextResponse.json({ error: "ALREADY_CONFIRMED" }, { status: 409 });
        }
        console.error("Guest select error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
