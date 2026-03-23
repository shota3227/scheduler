const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJstDate(date: Date): Date {
    return new Date(date.getTime() + JST_OFFSET_MS);
}

function fromJstDate(date: Date): Date {
    return new Date(date.getTime() - JST_OFFSET_MS);
}

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

/**
 * URL有効期限を計算（発行日から5日目の24:00 = 6日目の00:00 JST）
 */
export function getGuestUrlExpiresAt(now: Date = new Date()): Date {
    const nowJst = toJstDate(now);
    const expiresAtJst = new Date(
        Date.UTC(
            nowJst.getUTCFullYear(),
            nowJst.getUTCMonth(),
            nowJst.getUTCDate() + 5,
            0,
            0,
            0,
            0
        )
    );
    return fromJstDate(expiresAtJst);
}

/**
 * JST基準の「指定日オフセット」の日付範囲（00:00:00.000〜23:59:59.999）をUTC Dateで返す
 */
export function getJstDayRange(base: Date, dayOffset: number = 0): { start: Date; end: Date } {
    const baseJst = toJstDate(base);
    const year = baseJst.getUTCFullYear();
    const month = baseJst.getUTCMonth();
    const day = baseJst.getUTCDate() + dayOffset;

    const startJst = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const endJst = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));

    return {
        start: fromJstDate(startJst),
        end: fromJstDate(endJst),
    };
}

/**
 * URL有効期限表示を整形（00:00の場合は前日24:00として表示）
 */
export function formatGuestUrlExpiry(
    value: string | Date,
    options?: { includeYear?: boolean }
): string {
    const date = typeof value === "string" ? new Date(value) : value;
    const includeYear = options?.includeYear ?? false;

    const jstDate = toJstDate(date);
    let year = jstDate.getUTCFullYear();
    let month = jstDate.getUTCMonth();
    let day = jstDate.getUTCDate();
    let hour = jstDate.getUTCHours();
    let minute = jstDate.getUTCMinutes();

    if (hour === 0 && minute === 0) {
        const prevDay = new Date(Date.UTC(year, month, day - 1, 0, 0, 0, 0));
        year = prevDay.getUTCFullYear();
        month = prevDay.getUTCMonth();
        day = prevDay.getUTCDate();
        hour = 24;
        minute = 0;
    }

    const dayText = includeYear
        ? `${year}年${month + 1}月${day}日`
        : `${month + 1}月${day}日`;

    return `${dayText} ${pad2(hour)}:${pad2(minute)}`;
}
