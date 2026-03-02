import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

// サービスクライアント（バックエンド処理用）
function getGraphClient() {
    const credential = new ClientSecretCredential(
        process.env.GRAPH_TENANT_ID!,
        process.env.GRAPH_CLIENT_ID!,
        process.env.GRAPH_CLIENT_SECRET!
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ["https://graph.microsoft.com/.default"],
    });

    return Client.initWithMiddleware({ authProvider });
}

export interface FreeBusySlot {
    start: string;
    end: string;
}

export interface UserAvailability {
    email: string;
    busyTimes: FreeBusySlot[];
}

/**
 * 指定された参加者全員の空き時間を取得する
 * @param emails 参加者のメールアドレス一覧
 * @param startDate 検索開始日時
 * @param endDate 検索終了日時
 * @param durationMinutes 打ち合わせ時間（分）
 * @returns 全員が空いている時間スロット一覧
 */
export async function getAvailableSlots(
    emails: string[],
    startDate: Date,
    endDate: Date,
    durationMinutes: number
): Promise<FreeBusySlot[]> {
    const client = getGraphClient();

    // Graph API: getSchedule で全参加者のビジー時間を取得
    const scheduleItems = emails.map((email) => email);

    const response = await client
        .api("/users/" + emails[0] + "/calendar/getSchedule")
        .post({
            schedules: scheduleItems,
            startTime: {
                dateTime: startDate.toISOString(),
                timeZone: "Asia/Tokyo",
            },
            endTime: {
                dateTime: endDate.toISOString(),
                timeZone: "Asia/Tokyo",
            },
            availabilityViewInterval: durationMinutes,
        });

    const availabilityData: UserAvailability[] = (response.value || []).map(
        (item: any) => ({
            email: item.scheduleId,
            busyTimes: (item.scheduleItems || [])
                .filter((si: any) => si.status !== "free" && si.status !== "oof")
                .map((si: any) => ({
                    // Graph API returns UTC times without 'Z' suffix.
                    // Appending 'Z' forces JavaScript to parse them as UTC,
                    // preventing an erroneous JST (+9h) interpretation.
                    start: si.start.dateTime.endsWith("Z") ? si.start.dateTime : si.start.dateTime + "Z",
                    end: si.end.dateTime.endsWith("Z") ? si.end.dateTime : si.end.dateTime + "Z",
                })),
        })
    );

    return extractAvailableSlots(
        availabilityData,
        startDate,
        endDate,
        durationMinutes
    );
}

/**
 * 全員のビジー時間から空き時間スロットを抽出
 */
function extractAvailableSlots(
    availability: UserAvailability[],
    startDate: Date,
    endDate: Date,
    durationMinutes: number
): FreeBusySlot[] {
    const slots: FreeBusySlot[] = [];
    const durationMs = durationMinutes * 60 * 1000;

    const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo', weekday: 'short'
    });

    let daysToAdd = 0;
    while (true) {
        // startDateからN日後の日時 (24時間のミリ秒を加算)
        const targetDate = new Date(startDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        if (targetDate.getTime() > endDate.getTime()) break;

        // JST基準の YYYY-MM-DD を生成
        const parts = dateFormatter.formatToParts(targetDate);
        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const d = parts.find(p => p.type === 'day')?.value;
        const dateStr = `${y}-${m}-${d}`;

        // 平日のみ（月〜金）
        const weekday = weekdayFormatter.format(targetDate);
        if (weekday === "Sat" || weekday === "Sun") {
            daysToAdd++;
            continue;
        }

        // 7:00〜22:00の範囲 (JST固定で絶対時刻を取得)
        const dayStartMs = new Date(`${dateStr}T07:00:00+09:00`).getTime();
        const dayEndMs = new Date(`${dateStr}T22:00:00+09:00`).getTime();

        let slotStartMs = Math.max(startDate.getTime(), dayStartMs);

        // 30分単位に切り上げ (例: 10:15 -> 10:30)
        const remainder = slotStartMs % (30 * 60 * 1000);
        if (remainder !== 0) {
            slotStartMs += (30 * 60 * 1000) - remainder;
        }

        while (slotStartMs + durationMs <= dayEndMs) {
            const slotEndMs = slotStartMs + durationMs;

            // 全参加者がこのスロットで空いているか確認
            const isAvailable = availability.every((user) =>
                user.busyTimes.every((busy) => {
                    const busyStart = new Date(busy.start).getTime();
                    const busyEnd = new Date(busy.end).getTime();
                    // スロットとビジー時間が重複しないか確認
                    return slotEndMs <= busyStart || slotStartMs >= busyEnd;
                })
            );

            if (isAvailable) {
                slots.push({
                    start: new Date(slotStartMs).toISOString(),
                    end: new Date(slotEndMs).toISOString(),
                });
            }

            // 30分刻みで次のスロットへ
            slotStartMs += 30 * 60 * 1000;
        }

        daysToAdd++;
    }

    return slots;
}

/**
 * 指定された候補スロットを現在のカレンダー状況で再確認し、
 * 全参加者が依然として空いているスロットのみを返す
 * @param emails 参加者のメールアドレス一覧
 * @param slots チェック対象の候補スロット一覧
 * @param durationMinutes 打ち合わせ時間（分）
 */
export async function filterAvailableSlots(
    emails: string[],
    slots: FreeBusySlot[],
    durationMinutes: number
): Promise<FreeBusySlot[]> {
    if (emails.length === 0 || slots.length === 0) return slots;

    const client = getGraphClient();

    // スロット全体をカバーする時間範囲を算出
    const times = slots.flatMap((s) => [new Date(s.start).getTime(), new Date(s.end).getTime()]);
    const rangeStart = new Date(Math.min(...times));
    const rangeEnd = new Date(Math.max(...times));

    const response = await client
        .api("/users/" + emails[0] + "/calendar/getSchedule")
        .post({
            schedules: emails,
            startTime: {
                dateTime: rangeStart.toISOString(),
                timeZone: "Asia/Tokyo",
            },
            endTime: {
                dateTime: rangeEnd.toISOString(),
                timeZone: "Asia/Tokyo",
            },
            availabilityViewInterval: durationMinutes,
        });

    const availability: UserAvailability[] = (response.value || []).map(
        (item: any) => ({
            email: item.scheduleId,
            busyTimes: (item.scheduleItems || [])
                .filter((si: any) => si.status !== "free" && si.status !== "oof")
                .map((si: any) => ({
                    start: si.start.dateTime.endsWith("Z") ? si.start.dateTime : si.start.dateTime + "Z",
                    end: si.end.dateTime.endsWith("Z") ? si.end.dateTime : si.end.dateTime + "Z",
                })),
        })
    );

    // 各スロットについて全参加者が空いているか確認し、空いているもののみ返す
    return slots.filter((slot) => {
        const slotStart = new Date(slot.start).getTime();
        const slotEnd = new Date(slot.end).getTime();
        return availability.every((user) =>
            user.busyTimes.every((busy) => {
                const busyStart = new Date(busy.start).getTime();
                const busyEnd = new Date(busy.end).getTime();
                return slotEnd <= busyStart || slotStart >= busyEnd;
            })
        );
    });
}

/**
 * Microsoft 365のユーザー一覧を取得
 */
export async function getMicrosoftUsers() {
    const client = getGraphClient();

    const response = await client
        .api("/users")
        .select("id,displayName,mail,userPrincipalName")
        .filter("accountEnabled eq true")
        .get();

    return (response.value || [])
        .filter((u: any) => u.mail)
        .map((u: any) => ({
            msAadId: u.id,
            name: u.displayName,
            email: u.mail || u.userPrincipalName,
        }));
}

/**
 * Outlookカレンダーに予定を作成
 */
export async function createCalendarEvent(
    organizerEmail: string,
    attendeeEmails: string[],
    subject: string,
    startTime: string,
    endTime: string,
    location?: string
) {
    const client = getGraphClient();

    const event = {
        subject,
        start: { dateTime: startTime, timeZone: "Asia/Tokyo" },
        end: { dateTime: endTime, timeZone: "Asia/Tokyo" },
        location: location ? { displayName: location } : undefined,
        attendees: attendeeEmails.map((email) => ({
            emailAddress: { address: email },
            type: "required",
        })),
    };

    return client.api(`/users/${organizerEmail}/calendar/events`).post(event);
}
