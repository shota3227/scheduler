import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMicrosoftUsers } from "@/lib/graph";
import { Role } from "@prisma/client";

// メンバー一覧取得
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, msAadId: true, isActive: true },
        orderBy: { name: "asc" },
    });

    return NextResponse.json(members);
}

// Microsoft 365と同期
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { action } = await request.json();

    if (action === "sync") {
        const msUsers = await getMicrosoftUsers();
        let synced = 0;

        for (const u of msUsers) {
            await prisma.user.upsert({
                where: { email: u.email },
                update: { name: u.name, msAadId: u.msAadId },
                create: {
                    name: u.name,
                    email: u.email,
                    msAadId: u.msAadId,
                    role: Role.USER,
                },
            });
            synced++;
        }

        return NextResponse.json({ synced });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// メンバー更新
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, email, role, isActive } = body;

    const updated = await prisma.user.update({
        where: { id },
        data: {
            ...(name && { name }),
            ...(email && { email }),
            ...(role && { role: role as Role }),
            ...(isActive !== undefined && { isActive }),
        },
    });

    return NextResponse.json(updated);
}

// メンバー削除
export async function DELETE(request: NextRequest) {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
}
