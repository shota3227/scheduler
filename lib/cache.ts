import { prisma } from "@/lib/prisma";

const CACHE_TTL_MINUTES = 5;

/**
 * キャッシュを取得する（5分以内のものがあれば返す）
 */
export async function getCache(scheduleId: string) {
    const now = new Date();
    const cache = await prisma.availabilityCache.findFirst({
        where: {
            scheduleId,
            expiresAt: { gt: now },
        },
        orderBy: { cachedAt: "desc" },
    });
    return cache?.data ?? null;
}

/**
 * キャッシュを保存する
 */
export async function setCache(scheduleId: string, data: unknown) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000);

    // 古いキャッシュを削除
    await prisma.availabilityCache.deleteMany({ where: { scheduleId } });

    await prisma.availabilityCache.create({
        data: {
            scheduleId,
            data: data as any,
            expiresAt,
        },
    });
}

/**
 * キャッシュを無効化する
 */
export async function invalidateCache(scheduleId: string) {
    await prisma.availabilityCache.deleteMany({ where: { scheduleId } });
}
