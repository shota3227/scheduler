import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendExpiryWarningMail, sendNoSlotsMail } from "@/lib/mail";
import { ScheduleStatus } from "@prisma/client";
import { getGuestUrl } from "@/lib/token";
import { addHours, addDays } from "date-fns";

// Vercel Cron: 毎日1回実行（vercel.json で設定）
// 期限切れチェック + 24時間前警告 + 古いイベントの自動削除
export async function GET(request: NextRequest) {
    // Vercel Cron認証ヘッダーチェック
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const in24h = addHours(now, 24);
    const twoWeeksAgo = addDays(now, -14);

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

    // ----------- 2週間経過したデータの自動削除 -----------

    // 1. CONFIRMED: 実際のイベント終了時刻から2週間以上経過したものを検索して削除
    const oldConfirmed = await prisma.scheduleRequest.findMany({
        where: {
            status: ScheduleStatus.CONFIRMED,
            selection: {
                slot: {
                    endTime: { lt: twoWeeksAgo }
                }
            }
        },
        select: { id: true }
    });

    const deletedConfirmed = await prisma.scheduleRequest.deleteMany({
        where: {
            id: { in: oldConfirmed.map(s => s.id) }
        }
    });

    // 2. その他のステータス (EXPIRED, CANCELLED, etc): 最終更新日（期限切れになった日等）から2週間放置されているものを削除
    const deletedUnconfirmed = await prisma.scheduleRequest.deleteMany({
        where: {
            status: { not: ScheduleStatus.CONFIRMED },
            updatedAt: { lt: twoWeeksAgo }
        }
    });

    return NextResponse.json({
        warningsSent: soonExpiring.length,
        expiredUpdated: expired.count,
        deletedConfirmed: deletedConfirmed.count,
        deletedUnconfirmed: deletedUnconfirmed.count,
    });
}
