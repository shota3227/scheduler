import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isTokenValid } from "@/lib/token";
import { filterAvailableSlots } from "@/lib/graph";
import { sendNoSlotsMail } from "@/lib/mail";

// 社外ゲスト向け：トークンから調整情報と候補日時を取得
// URL開封時にGraph APIで現在の空き状況を再確認し、埋まっている候補は除外して返す
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;

    const schedule = await prisma.scheduleRequest.findUnique({
        where: { guestToken: token },
        include: {
            participants: { select: { email: true } },
            creator: { select: { email: true, name: true } },
            timeSlots: {
                where: { isActive: true },
                orderBy: { startTime: "asc" },
            },
            selection: true,
        },
    });

    if (!schedule) {
        return NextResponse.json({ error: "無効なURLです" }, { status: 404 });
    }

    if (!isTokenValid(schedule.expiresAt)) {
        return NextResponse.json({ error: "URLの有効期限が切れています" }, { status: 410 });
    }

    if (schedule.status === "CONFIRMED" || schedule.status === "RESOLVED_EXTERNALLY") {
        return NextResponse.json({ error: "already_confirmed", status: schedule.status });
    }

    let slots = schedule.timeSlots.map((ts) => ({
        start: ts.startTime.toISOString(),
        end: ts.endTime.toISOString(),
    }));

    // Graph API で現在の空き状況を再確認し、既に埋まっているスロットを除外
    const emails = schedule.participants.map((p) => p.email);
    if (emails.length > 0 && slots.length > 0) {
        try {
            slots = await filterAvailableSlots(emails, slots, schedule.duration);
        } catch (e) {
            // Graph API 失敗時はフィルタリングなしで全スロットを返す（フェイルオープン）
            console.error("Availability check failed:", e);
        }
    }

    // 候補日時0件のURLアクセス時、URL作成者へアテンションメール（連打対策で24時間に1回まで）
    if ((schedule.status === "PENDING" || schedule.status === "RESCHEDULE_REQUESTED") && slots.length === 0) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const alreadyNotified = await prisma.notification.findFirst({
            where: {
                scheduleId: schedule.id,
                type: "NO_SLOTS_URL_OPEN",
                success: true,
                sentAt: { gte: oneDayAgo },
            },
            select: { id: true },
        });

        if (!alreadyNotified) {
            await sendNoSlotsMail(
                schedule.creator.email,
                {
                    title: schedule.title,
                    creator_name: schedule.creator.name,
                },
                schedule.id,
                "NO_SLOTS_URL_OPEN"
            ).catch((err) => console.error("sendNoSlotsMail on guest URL open failed:", err));
        }
    }

    return NextResponse.json({
        schedule: {
            id: schedule.id,
            title: schedule.title,
            duration: schedule.duration,
            location: schedule.location,
            address: schedule.address,
            status: schedule.status,
            expiresAt: schedule.expiresAt,
        },
        slots,
    });
}
