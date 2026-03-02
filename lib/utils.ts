import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * 日時を日本語フォーマットで表示
 * 例: 2024年3月15日（金）14:00〜15:00
 */
export function formatDateTime(start: string | Date, end?: string | Date): string {
    const startDate = typeof start === "string" ? parseISO(start) : start;
    const dateStr = format(startDate, "yyyy年M月d日（E）HH:mm", { locale: ja });
    if (!end) return dateStr;
    const endDate = typeof end === "string" ? parseISO(end) : end;
    const endStr = format(endDate, "HH:mm");
    return `${dateStr}〜${endStr}`;
}

/**
 * ステータスの日本語表示
 */
export function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        PENDING: "調整中",
        CONFIRMED: "確定済み",
        EXPIRED: "期限切れ",
        CANCELLED: "キャンセル",
    };
    return labels[status] ?? status;
}

/**
 * ステータスに応じたカラークラス
 */
export function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
        PENDING: "text-blue-600 bg-blue-50 border-blue-200",
        CONFIRMED: "text-green-600 bg-green-50 border-green-200",
        EXPIRED: "text-gray-500 bg-gray-50 border-gray-200",
        CANCELLED: "text-red-600 bg-red-50 border-red-200",
    };
    return colors[status] ?? "text-gray-600 bg-gray-50 border-gray-200";
}
