import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateGuestToken, getExpiresAt } from "@/lib/token";
import { ScheduleStatus } from "@prisma/client";
import { z } from "zod";
import { refreshExpiredScheduleStatuses } from "@/lib/schedule-status";

const createSchema = z.object({
    title: z.string().min(1),
    duration: z.number().min(15).max(480),
    location: z.string().optional(),
    address: z.string().optional(),
    participantIds: z.array(z.string()).min(1),
    timeSlots: z.array(z.object({
        start: z.string(),
        end: z.string(),
    })).optional(),
    emailBody: z.string().optional(),
});

// 調整一覧取得
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await refreshExpiredScheduleStatuses();

    const user = session.user as any;
    const isAdmin = user.role === "ADMIN";

    const schedules = await prisma.scheduleRequest.findMany({
        where: isAdmin ? {} : { creatorId: user.id },
        include: {
            creator: { select: { id: true, name: true, email: true } },
            participants: { include: { user: { select: { id: true, name: true, email: true } } } },
            timeSlots: { where: { isActive: true } },
            selection: true,
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(schedules);
}

// 調整作成
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const { title, duration, location, address, participantIds, timeSlots, emailBody } = parsed.data;

    // 参加者のメールアドレスを取得
    const participants = await prisma.user.findMany({
        where: { id: { in: participantIds } },
        select: { id: true, email: true },
    });

    const guestToken = generateGuestToken();
    const expiresAt = getExpiresAt();

    const schedule = await prisma.scheduleRequest.create({
        data: {
            title,
            duration,
            location,
            address,
            emailBody,
            guestToken,
            expiresAt,
            creatorId: user.id,
            status: ScheduleStatus.PENDING,
            participants: {
                create: participants.map((p) => ({
                    userId: p.id,
                    email: p.email,
                })),
            },
            timeSlots: timeSlots
                ? {
                    create: timeSlots.map((slot) => ({
                        startTime: new Date(slot.start),
                        endTime: new Date(slot.end),
                    })),
                }
                : undefined,
        },
        include: {
            participants: { include: { user: true } },
            timeSlots: true,
        },
    });

    return NextResponse.json(schedule, { status: 201 });
}
