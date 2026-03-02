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

    // 平日9:00〜19:00の時間帯で候補を生成（30分刻み）
    let current = new Date(startDate);

    while (current < endDate) {
        const dayOfWeek = current.getDay();

        // 平日のみ（月〜金）
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            current = getNextDay(current);
            continue;
        }

        // 7:00〜22:00の範囲（UIの絞り込みで最大対応する時間帯）
        const dayStart = setTime(current, 7, 0);
        const dayEnd = setTime(current, 22, 0);

        let slotStart = new Date(Math.max(current.getTime(), dayStart.getTime()));

        while (slotStart.getTime() + durationMs <= dayEnd.getTime()) {
            const slotEnd = new Date(slotStart.getTime() + durationMs);

            // 全参加者がこのスロットで空いているか確認
            const isAvailable = availability.every((user) =>
                user.busyTimes.every((busy) => {
                    const busyStart = new Date(busy.start).getTime();
                    const busyEnd = new Date(busy.end).getTime();
                    // スロットとビジー時間が重複しないか確認
                    return slotEnd.getTime() <= busyStart || slotStart.getTime() >= busyEnd;
                })
            );

            if (isAvailable) {
                slots.push({
                    start: slotStart.toISOString(),
                    end: slotEnd.toISOString(),
                });
            }

            // 30分刻みで次のスロットへ
            slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
        }

        current = getNextDay(dayStart);
    }

    return slots;
}

function setTime(date: Date, hours: number, minutes: number): Date {
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
}

function getNextDay(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
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
