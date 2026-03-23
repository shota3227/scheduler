import { ScheduleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 期限切れ案件のステータスを最新化する。
 * Cronが未実行でも、画面/API参照時に補正できるようにするための保険処理。
 */
export async function refreshExpiredScheduleStatuses(now: Date = new Date()): Promise<number> {
    try {
        const result = await prisma.scheduleRequest.updateMany({
            where: {
                status: { in: [ScheduleStatus.PENDING, ScheduleStatus.RESCHEDULE_REQUESTED] },
                expiresAt: { lt: now },
            },
            data: { status: ScheduleStatus.EXPIRED },
        });
        return result.count;
    } catch (error) {
        console.error("refreshExpiredScheduleStatuses failed:", error);
        return 0;
    }
}
