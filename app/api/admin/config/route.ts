import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 文言設定一覧取得
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const configs = await prisma.siteConfig.findMany({
        orderBy: [{ category: "asc" }, { key: "asc" }],
    });

    return NextResponse.json(configs);
}

// 文言設定更新
export async function PATCH(request: NextRequest) {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    // body: { key: string, value: string } or array

    const updates = Array.isArray(body) ? body : [body];

    const results = await Promise.all(
        updates.map(({ key, value }: { key: string; value: string }) =>
            prisma.siteConfig.update({
                where: { key },
                data: { value },
            })
        )
    );

    return NextResponse.json(results);
}
