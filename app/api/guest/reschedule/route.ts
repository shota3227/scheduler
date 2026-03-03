import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateCache } from "@/lib/cache";
import { sendCreatorAlertMail } from "@/lib/mail";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, message } = body;

        if (!token) {
            return NextResponse.json({ error: "Token is required" }, { status: 400 });
        }

        // トークンから案件を取得
        const schedule = await prisma.scheduleRequest.findUnique({
            where: { guestToken: token },
            include: {
                creator: true,
            },
        });

        if (!schedule) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        // 期限切れチェック
        if (schedule.expiresAt < new Date()) {
            return NextResponse.json({ error: "URL has expired" }, { status: 410 });
        }

        // 既に確定済み・再調整依頼済みかどうかのチェック
        if (schedule.status === "CONFIRMED") {
            return NextResponse.json({ error: "already_confirmed", message: "この日程調整は既に確定しています" }, { status: 400 });
        }
        if (schedule.status === "RESCHEDULE_REQUESTED") {
            return NextResponse.json({ error: "already_requested", message: "再調整依頼は既に送信されています" }, { status: 400 });
        }
        if (schedule.status === "CANCELLED") {
            return NextResponse.json({ error: "cancelled", message: "この日程調整はキャンセルされています" }, { status: 400 });
        }

        // トランザクションでステータスを更新し、GuestSelectionにメッセージのみ保存（slotIdは無し）
        // ※ ただし現在のGuestSelectionスキーマは slotId が必須(String & @unique)なため、
        // 今回はシンプルに ScheduleRequest の status だけを更新し、メッセージは別に運用・または今回はメール通知のみに利用します。
        // （スキーマ上、messageはGuestSelectionにあるが、slotIdが必須なので空の選択を作るのは難しい。今回はメール通知で十分担保される）

        await prisma.scheduleRequest.update({
            where: { id: schedule.id },
            data: { status: "RESCHEDULE_REQUESTED" },
        });

        // キャッシュを無効化
        await invalidateCache(schedule.id);

        // 作成者へ再調整依頼のシステムアラートを送信
        await sendCreatorAlertMail(
            schedule.creator.email,
            "RESCHEDULE",
            schedule.id,
            schedule.title,
            message || ""
        );

        return NextResponse.json({ message: "Reschedule request sent successfully" });
    } catch (e: any) {
        console.error("Reschedule completely failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
