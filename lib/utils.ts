import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const JST_TIME_ZONE = "Asia/Tokyo";

function toDate(value: string | Date): Date {
    return typeof value === "string" ? new Date(value) : value;
}

function getDateTimePartsInJst(date: Date): Record<string, string> {
    const parts = new Intl.DateTimeFormat("ja-JP", {
        timeZone: JST_TIME_ZONE,
        year: "numeric",
        month: "numeric",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(date);

    const map: Record<string, string> = {};
    parts.forEach((p) => {
        if (p.type !== "literal") {
            map[p.type] = p.value;
        }
    });
    return map;
}

function getDatePartsInJst(date: Date): Record<string, string> {
    const parts = new Intl.DateTimeFormat("ja-JP", {
        timeZone: JST_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const map: Record<string, string> = {};
    parts.forEach((p) => {
        if (p.type !== "literal") {
            map[p.type] = p.value;
        }
    });
    return map;
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * 日時を日本語フォーマットで表示
 * 例: 2024年3月15日（金）14:00〜15:00
 */
export function formatDateTime(start: string | Date, end?: string | Date): string {
    const startDate = toDate(start);
    const startParts = getDateTimePartsInJst(startDate);
    const dateStr = `${startParts.year}年${startParts.month}月${startParts.day}日（${startParts.weekday}）${startParts.hour}:${startParts.minute}`;
    if (!end) return dateStr;
    const endDate = toDate(end);
    const endParts = getDateTimePartsInJst(endDate);
    const endStr = `${endParts.hour}:${endParts.minute}`;
    return `${dateStr}〜${endStr}`;
}

/**
 * 候補日時の短縮表記（JST固定）
 * 例: 3月15日(金) 14:00〜15:00
 */
export function formatSlotDateTime(start: string | Date, end: string | Date): string {
    const startDate = toDate(start);
    const endDate = toDate(end);

    const dateStr = new Intl.DateTimeFormat("ja-JP", {
        timeZone: JST_TIME_ZONE,
        month: "long",
        day: "numeric",
        weekday: "short",
    }).format(startDate);

    const startTimeStr = new Intl.DateTimeFormat("ja-JP", {
        timeZone: JST_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(startDate);

    const endTimeStr = new Intl.DateTimeFormat("ja-JP", {
        timeZone: JST_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(endDate);

    return `${dateStr} ${startTimeStr}〜${endTimeStr}`;
}

/**
 * JST日付キー（YYYY-MM-DD）
 */
export function getJstDateKey(value: string | Date): string {
    const date = toDate(value);
    const parts = getDatePartsInJst(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * JST時刻を分に変換（00:00 -> 0, 23:30 -> 1410）
 */
export function getJstMinutes(value: string | Date): number {
    const date = toDate(value);
    const parts = getDateTimePartsInJst(date);
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    return hour * 60 + minute;
}

/**
 * ステータスの日本語表示
 */
export function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        PENDING: "調整中",
        RESCHEDULE_REQUESTED: "再調整依頼",
        CONFIRMED: "確定済み",
        EXPIRED: "期限切れ",
        RESOLVED_EXTERNALLY: "別途対応済み",
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
        RESCHEDULE_REQUESTED: "text-amber-700 bg-amber-50 border-amber-200",
        CONFIRMED: "text-green-600 bg-green-50 border-green-200",
        EXPIRED: "text-gray-500 bg-gray-50 border-gray-200",
        RESOLVED_EXTERNALLY: "text-slate-600 bg-slate-50 border-slate-200",
        CANCELLED: "text-red-600 bg-red-50 border-red-200",
    };
    return colors[status] ?? "text-gray-600 bg-gray-50 border-gray-200";
}
