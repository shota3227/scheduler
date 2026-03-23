import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendExpiryWarningMail } from "@/lib/mail";
import { ScheduleStatus } from "@prisma/client";
import { getGuestUrl } from "@/lib/token";
import { addDays } from "date-fns";
import { formatGuestUrlExpiry, getJstDayRange } from "@/lib/expiry";

// Vercel Cron: 毎日1回実行（vercel.json で設定）
// 期限切れチェック + 2日前(午前10時)リマインド + 古いイベントの自動削除
export async function GET(request: NextRequest) {
    // Vercel Cron認証ヘッダーチェック
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const twoWeeksAgo = addDays(now, -14);
    const reminderTargetRange = getJstDayRange(now, 2); // JSTで「2日後に期限切れ」の案件

    // 2日後に期限切れになる「調整進行中(PENDING/RESCHEDULE_REQUESTED)」を検索
    const soonExpiring = await prisma.scheduleRequest.findMany({
        where: {
            status: { in: [ScheduleStatus.PENDING, ScheduleStatus.RESCHEDULE_REQUESTED] },
            expiresAt: {
                gte: reminderTargetRange.start,
                lte: reminderTargetRange.end,
            },
        },
        include: {
            creator: { select: { email: true, name: true } },
        },
    });

    const sentWarnings = await prisma.notification.findMany({
        where: {
            scheduleId: { in: soonExpiring.map((s) => s.id) },
            type: "EXPIRED_WARNING",
            success: true,
        },
        select: { scheduleId: true },
    });
    const sentWarningIds = new Set(
        sentWarnings
            .map((n) => n.scheduleId)
            .filter((id): id is string => typeof id === "string")
    );
    const warningTargets = soonExpiring.filter((s) => !sentWarningIds.has(s.id));

    for (const schedule of warningTargets) {
        await sendExpiryWarningMail(
            schedule.creator.email,
            {
                title: schedule.title,
                url: getGuestUrl(schedule.guestToken),
                expires_at: formatGuestUrlExpiry(schedule.expiresAt, { includeYear: true }),
                creator_name: schedule.creator.name,
            },
            schedule.id
        ).catch(console.error);
    }

    // 期限切れの進行中ステータスをEXPIREDに更新
    const expired = await prisma.scheduleRequest.updateMany({
        where: {
            status: { in: [ScheduleStatus.PENDING, ScheduleStatus.RESCHEDULE_REQUESTED] },
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
        warningsSent: warningTargets.length,
        expiredUpdated: expired.count,
        deletedConfirmed: deletedConfirmed.count,
        deletedUnconfirmed: deletedUnconfirmed.count,
    });
}
