import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendGuestUrlMail } from "@/lib/mail";
import { getGuestUrl } from "@/lib/token";
import { z } from "zod";

const sendMailSchema = z.object({
    scheduleId: z.string(),
    guestEmail: z.string().email(),
    customBody: z.string().optional(),
});

// 社外へURL案内メールを送信
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = sendMailSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { scheduleId, guestEmail, customBody } = parsed.data;
    const user = session.user as any;

    const schedule = await prisma.scheduleRequest.findUnique({
        where: { id: scheduleId },
        include: { creator: { select: { name: true } } },
    });

    if (!schedule) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 作成者 or 管理者のみ送信可能
    if (schedule.creatorId !== user.id && user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const guestUrl = getGuestUrl(schedule.guestToken);

    // カスタム本文があれば emailBody を更新
    if (customBody) {
        await prisma.scheduleRequest.update({
            where: { id: scheduleId },
            data: { emailBody: customBody, emailSentAt: new Date() },
        });
    } else {
        await prisma.scheduleRequest.update({
            where: { id: scheduleId },
            data: { emailSentAt: new Date() },
        });
    }

    await sendGuestUrlMail(
        guestEmail,
        {
            title: schedule.title,
            url: guestUrl,
            creator_name: schedule.creator.name,
            expires_at: schedule.expiresAt.toLocaleString("ja-JP"),
        },
        scheduleId
    );

    return NextResponse.json({ success: true, url: guestUrl });
}
