import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 社外ゲスト向けページは認証不要
    if (pathname.startsWith("/guest/") || pathname.startsWith("/api/guest/") || pathname.startsWith("/api/public/")) {
        return NextResponse.next();
    }

    // 認証ページは認証不要
    if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/")) {
        return NextResponse.next();
    }

    // 管理者ページは管理者ロールが必要
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin/")) {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
        // 例外：日程調整画面で誰でもメンバー一覧とシステム設定（メールテンプレート）をGETできるようにする
        if ((pathname === "/api/admin/members" || pathname === "/api/admin/config") && request.method === "GET") {
            return NextResponse.next();
        }
        if ((session.user as any).role !== "ADMIN") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        return NextResponse.next();
    }

    // その他のページは認証が必要
    const session = await auth();
    if (!session?.user) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
