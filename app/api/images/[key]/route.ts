import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ key: string }> }
) {
    const { key } = await params;

    try {
        const config = await prisma.siteConfig.findUnique({
            where: { key: key },
        });

        if (!config || !config.value) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const value = config.value.trim();

        // Data URI scheme (e.g., data:image/png;base64,iVBORw0KGgo...)
        const match = value.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);

        if (match) {
            const mimeType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, "base64");

            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": mimeType,
                    "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600",
                },
            });
        }

        // URLの場合はリダイレクト
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return NextResponse.redirect(value);
        }

        return new NextResponse("Invalid image format", { status: 400 });

    } catch (error) {
        console.error("Error serving image:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
