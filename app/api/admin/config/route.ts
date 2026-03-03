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
        updates.map(({ key, value }: { key: string; value: string }) => {
            // valueだけ更新、存在しない場合は空の補足情報で作成
            const categoryMatch = key.split("_")[0];
            const category = categoryMatch ? categoryMatch.toUpperCase() : "OTHER";

            return prisma.siteConfig.upsert({
                where: { key },
                update: { value },
                create: {
                    key,
                    value,
                    label: key, // 管理画面からはラベルは不要/不可視で良いためそのまま
                    category,
                },
            });
        })
    );

    return NextResponse.json(results);
}
