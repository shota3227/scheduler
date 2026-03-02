import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendExpiryWarningMail, sendNoSlotsMail } from "@/lib/mail";
import { ScheduleStatus } from "@prisma/client";
import { getGuestUrl } from "@/lib/token";
import { addHours } from "date-fns";

// Vercel Cron: 毎日1回実行（vercel.json で設定）
// 期限切れチェック + 24時間前警告
export async function GET(request: NextRequest) {
    // Vercel Cron認証ヘッダーチェック
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const in24h = addHours(now, 24);

    // 24時間以内に期限切れになるPENDINGの調整を検索
    const soonExpiring = await prisma.scheduleRequest.findMany({
        where: {
            status: ScheduleStatus.PENDING,
            expiresAt: { lte: in24h, gte: now },
        },
        include: {
            creator: { select: { email: true, name: true } },
        },
    });

    for (const schedule of soonExpiring) {
        await sendExpiryWarningMail(
            schedule.creator.email,
            {
                title: schedule.title,
                url: getGuestUrl(schedule.guestToken),
                expires_at: schedule.expiresAt.toLocaleString("ja-JP"),
                creator_name: schedule.creator.name,
            },
            schedule.id
        ).catch(console.error);
    }

    // 期限切れのPENDINGをEXPIREDに更新
    const expired = await prisma.scheduleRequest.updateMany({
        where: {
            status: ScheduleStatus.PENDING,
            expiresAt: { lt: now },
        },
        data: { status: ScheduleStatus.EXPIRED },
    });

    return NextResponse.json({
        warningsSent: soonExpiring.length,
        expiredUpdated: expired.count,
    });
}
