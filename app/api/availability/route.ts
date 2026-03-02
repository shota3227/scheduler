import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/graph";
import { startOfDay, addDays } from "date-fns";

// スケジュール未作成の状態で空き時間だけを取得するエンドポイント
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { participantIds, duration } = body;

    if (!Array.isArray(participantIds) || participantIds.length === 0 || !duration) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const members = await prisma.user.findMany({
        where: { id: { in: participantIds }, isActive: true },
        select: { email: true },
    });

    const emails = members.map((m) => m.email);
    const startDate = startOfDay(new Date());
    const endDate = addDays(startDate, 31);

    try {
        const slots = await getAvailableSlots(emails, startDate, endDate, duration);
        return NextResponse.json({ slots });
    } catch (error: any) {
        console.error("Graph API error:", error);
        return NextResponse.json(
            { error: "カレンダー情報の取得に失敗しました" },
            { status: 500 }
        );
    }
}
