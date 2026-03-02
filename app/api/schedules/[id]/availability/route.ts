import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/graph";
import { getCache, setCache } from "@/lib/cache";
import { addDays, startOfDay } from "date-fns";

// 空き時間取得（キャッシュ対応）
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const schedule = await prisma.scheduleRequest.findUnique({
        where: { id },
        include: {
            participants: { select: { email: true } },
        },
    });

    if (!schedule) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // キャッシュ確認
    const cached = await getCache(id);
    if (cached) {
        // バックグラウンドでキャッシュを更新
        refreshCacheInBackground(id, schedule);
        return NextResponse.json({ slots: cached, cached: true });
    }

    // キャッシュがない場合はGraph APIを直接呼び出す
    try {
        const emails = schedule.participants.map((p) => p.email);
        const startDate = startOfDay(new Date());
        const endDate = addDays(startDate, 31);

        const slots = await getAvailableSlots(
            emails,
            startDate,
            endDate,
            schedule.duration
        );

        await setCache(id, slots);
        return NextResponse.json({ slots, cached: false });
    } catch (error: any) {
        console.error("Graph API error:", error);
        return NextResponse.json(
            { error: "カレンダー情報の取得に失敗しました" },
            { status: 500 }
        );
    }
}

async function refreshCacheInBackground(scheduleId: string, schedule: any) {
    try {
        const emails = schedule.participants.map((p: any) => p.email);
        const startDate = startOfDay(new Date());
        const endDate = addDays(startDate, 31);
        const slots = await getAvailableSlots(
            emails,
            startDate,
            endDate,
            schedule.duration
        );
        await setCache(scheduleId, slots);
    } catch (err) {
        console.error("Background cache refresh failed:", err);
    }
}
