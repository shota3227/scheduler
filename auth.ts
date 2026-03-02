import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Auth.jsの正規表現バグ対応: ハイフンありのテナントIDがOIDC discoveryで失敗する問題へのパッチ
const entraIdProvider = MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
    // すでに同じメールアドレスのアカウントがある場合にリンクを許可する（OAuthAccountNotLinked対策）
    allowDangerousEmailAccountLinking: true,
});

const customFetchSymbol = Object.getOwnPropertySymbols(entraIdProvider).find(
    (s) => s.description === "customFetch"
);
if (customFetchSymbol) {
    // @ts-ignore
    entraIdProvider[customFetchSymbol] = async (...args: Parameters<typeof fetch>) => {
        const url = new URL(args[0] instanceof Request ? args[0].url : args[0] as string);
        if (url.pathname.endsWith(".well-known/openid-configuration")) {
            const response = await fetch(...args);
            const json = await response.clone().json();
            const issuer = json.issuer.replace("{tenantid}", process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID);
            return Response.json({ ...json, issuer });
        }
        return fetch(...args);
    };
}

const authConfig = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [
        entraIdProvider,
        Credentials({
            name: "アプリアカウント",
            credentials: {
                email: { label: "メールアドレス", type: "email" },
                password: { label: "パスワード", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });
                if (!user) return null;
                const { compare } = await import("bcryptjs");
                const passwordHash = (user as any).passwordHash as string | undefined;
                if (!passwordHash) return null;
                const valid = await compare(credentials.password as string, passwordHash);
                if (!valid) return null;
                return { id: user.id, name: user.name, email: user.email, role: user.role };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, account }) {
            if (user) {
                token.role = (user as any).role ?? "USER";
                token.id = user.id;
            }
            if (account?.access_token) {
                token.msAccessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                (session.user as any).id = token.id as string;
                (session.user as any).role = token.role as string;
                (session as any).msAccessToken = token.msAccessToken;
            }
            return session;
        },
        async signIn({ user, account }) {
            if (account?.provider === "microsoft-entra-id") {
                if (user.email) {
                    await prisma.user.upsert({
                        where: { email: user.email },
                        update: { name: user.name ?? user.email, msAadId: account.providerAccountId },
                        create: {
                            name: user.name ?? user.email,
                            email: user.email,
                            msAadId: account.providerAccountId,
                            role: "USER",
                        },
                    });
                }
            }
            return true;
        },
    },
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
    },
    debug: true,
});

export const { handlers, auth, signIn, signOut } = authConfig;
