import { randomBytes } from "crypto";
import { getGuestUrlExpiresAt } from "@/lib/expiry";

/**
 * 推測不能なゲストトークンを生成（256bit = 64文字の hex）
 */
export function generateGuestToken(): string {
    return randomBytes(32).toString("hex");
}

/**
 * URLの有効期限を計算（発行日から5日目の24:00）
 */
export function getExpiresAt(): Date {
    return getGuestUrlExpiresAt();
}

/**
 * トークンが有効かチェック
 */
export function isTokenValid(expiresAt: Date): boolean {
    return new Date() < new Date(expiresAt);
}

/**
 * ゲスト向けURLを生成
 */
export function getGuestUrl(token: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${baseUrl}/guest/${token}`;
}
