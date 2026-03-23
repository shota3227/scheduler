import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ScheduleStatus } from "@prisma/client";
import { sendNoSlotsMail } from "@/lib/mail";

// 調整詳細取得
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const user = session.user as any;

    const schedule = await prisma.scheduleRequest.findUnique({
        where: { id },
        include: {
            creator: { select: { id: true, name: true, email: true } },
            participants: { include: { user: { select: { id: true, name: true, email: true } } } },
            timeSlots: { where: { isActive: true }, orderBy: { startTime: "asc" } },
            selection: { include: { slot: true } },
        },
    });

    if (!schedule) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 権限チェック：管理者 or 作成者 or 参加者のみ
    const isAdmin = user.role === "ADMIN";
    const isCreator = schedule.creatorId === user.id;
    const isParticipant = schedule.participants.some((p) => p.userId === user.id);

    if (!isAdmin && !isCreator && !isParticipant) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(schedule);
}

// 調整更新（キャンセルなど）
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const user = session.user as any;
    const body = await request.json();

    const schedule = await prisma.scheduleRequest.findUnique({
        where: { id },
        include: {
            creator: { select: { email: true, name: true } },
        },
    });
    if (!schedule) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    const isCreator = schedule.creatorId === user.id;
    if (!isAdmin && !isCreator) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 参加者の更新
    if (body.participantIds && Array.isArray(body.participantIds)) {
        await prisma.participant.deleteMany({ where: { scheduleId: id } });
        if (body.participantIds.length > 0) {
            const users = await prisma.user.findMany({
                where: { id: { in: body.participantIds } },
                select: { id: true, email: true },
            });
            await prisma.participant.createMany({
                data: users.map((u) => ({
                    scheduleId: id,
                    userId: u.id,
                    email: u.email,
                })),
            });
        }
    }

    const beforeActiveSlotCount = body.timeSlots && Array.isArray(body.timeSlots)
        ? await prisma.timeSlot.count({ where: { scheduleId: id, isActive: true } })
        : null;

    // タイムスロットの更新（既存を非活性化して再作成）
    if (body.timeSlots && Array.isArray(body.timeSlots)) {
        await prisma.timeSlot.updateMany({
            where: { scheduleId: id },
            data: { isActive: false },
        });
        if (body.timeSlots.length > 0) {
            await prisma.timeSlot.createMany({
                data: body.timeSlots.map((slot: { start: string; end: string }) => ({
                    scheduleId: id,
                    startTime: new Date(slot.start),
                    endTime: new Date(slot.end),
                    isActive: true,
                })),
            });
        }
    }

    const updated = await prisma.scheduleRequest.update({
        where: { id },
        data: {
            ...(body.status !== undefined && { status: body.status as ScheduleStatus }),
            ...(body.title && { title: body.title }),
            ...(body.duration && { duration: Number(body.duration) }),
            ...(body.location !== undefined && { location: body.location }),
            ...(body.address !== undefined && { address: body.address }),
        },
        include: {
            creator: { select: { id: true, name: true, email: true } },
            participants: { include: { user: { select: { id: true, name: true, email: true } } } },
            timeSlots: { where: { isActive: true } },
        },
    });

    // 候補日時が「>0件 → 0件」に変化したとき、URL作成者へアテンションメール送信
    if (
        beforeActiveSlotCount !== null &&
        beforeActiveSlotCount > 0 &&
        updated.timeSlots.length === 0 &&
        updated.status === ScheduleStatus.PENDING
    ) {
        await sendNoSlotsMail(
            schedule.creator.email,
            {
                title: updated.title,
                creator_name: schedule.creator.name,
            },
            id,
            "NO_SLOTS"
        ).catch((err) => console.error("sendNoSlotsMail on slot-empty transition failed:", err));
    }

    return NextResponse.json(updated);
}
