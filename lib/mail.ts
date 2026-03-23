import { prisma } from "@/lib/prisma";
import { sendGraphMail } from "@/lib/graph";

/**
 * 共通の送信元アドレス（M365上の実在アカウント・共有メールボックス）
 */
function getSystemMailAddress(): string {
    return process.env.SYSTEM_MAIL_ADDRESS || process.env.SMTP_FROM_ADDRESS || "scheduler@luvir.jp";
}

/**
 * 設定済みのメールテンプレートを取得し、変数を展開する
 */
async function renderTemplate(key: string, variables: Record<string, string>): Promise<string> {
    const config = await prisma.siteConfig.findUnique({ where: { key } });
    if (!config) return "";
    let text = config.value;
    Object.entries(variables).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    });
    return text;
}

/**
 * メール送信（汎用・Graph API経由）
 */
async function sendMail(to: string, subject: string, html: string, scheduleId?: string, type?: string) {
    const from = getSystemMailAddress();
    try {
        await sendGraphMail(from, to, subject, html);
        await prisma.notification.create({
            data: {
                scheduleId,
                type: type ?? "GENERIC",
                recipient: to,
                success: true,
            },
        });
    } catch (err: any) {
        await prisma.notification.create({
            data: {
                scheduleId,
                type: type ?? "GENERIC",
                recipient: to,
                success: false,
                error: String(err?.message ?? err),
            },
        });
        throw err;
    }
}

/**
 * 社外相手に日程調整URLを送付するメール
 */
export async function sendGuestUrlMail(
    to: string,
    variables: Record<string, string>,
    scheduleId: string
) {
    const subject = await renderTemplate("email_url_subject", variables);
    const body = await renderTemplate("email_url_body", variables);
    const html = body.replace(/\n/g, "<br>");
    await sendMail(to, subject, html, scheduleId, "URL_SENT");
}

/**
 * 日時確定通知（社内作成者へ）
 * ※Graph API(sendMail)の送信元を作成者自身にするか、システムアドレスにするか選択可能です
 */
export async function sendConfirmedMail(
    to: string, // 作成者のメールアドレス
    variables: Record<string, string>,
    scheduleId: string,
    sendAsCreator: boolean = false
) {
    const subject = await renderTemplate("email_confirmed_subject", variables);
    const body = await renderTemplate("email_confirmed_body", variables);
    const html = body.replace(/\n/g, "<br>");

    // sendAsCreatorがtrueなら、送信元も作成者とする（M365側で自身から自身への通知として扱う場合）
    const from = sendAsCreator ? to : getSystemMailAddress();

    try {
        await sendGraphMail(from, to, subject, html);
        await prisma.notification.create({
            data: { scheduleId, type: "CONFIRMED", recipient: to, success: true },
        });
    } catch (err: any) {
        await prisma.notification.create({
            data: { scheduleId, type: "CONFIRMED", recipient: to, success: false, error: String(err?.message ?? err) },
        });
        console.error("sendConfirmedMail error:", err);
    }
}

/**
 * URL作成者へ「確定」または「再調整」のシステムアラートメールを送る（リンク付き）
 */
export async function sendCreatorAlertMail(
    to: string,
    type: "CONFIRMED" | "RESCHEDULE",
    scheduleId: string,
    scheduleTitle: string,
    message: string = ""
) {
    const from = getSystemMailAddress();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const detailUrl = `${appUrl}/schedule/${scheduleId}`;

    let subject = "";
    let html = "";

    if (type === "CONFIRMED") {
        subject = `【システム通知】クライアントが日程を確定させました（${scheduleTitle}）`;
        html = `
            <p>ゲストが日程を確定し、カレンダーへの予定登録が完了しました。</p>
            <p><strong>件名:</strong> ${scheduleTitle}</p>
            ${message ? `<p><strong>ゲストからのメッセージ:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>` : ""}
            <p>詳細な調整内容については、以下のリンクよりご確認いただけます：<br/>
            <a href="${detailUrl}">${detailUrl}</a></p>
        `;
    } else {
        subject = `【システム通知】ゲストから再調整依頼が来ています（${scheduleTitle}）`;
        html = `
            <p>ゲストより、提示した候補日時では調整が難しいとの連絡がありました。</p>
            <p><strong>件名:</strong> ${scheduleTitle}</p>
            ${message ? `<p><strong>ゲストからのメッセージ:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>` : ""}
            <p>以下のリンクより詳細を確認し、再度日程調整を行ってください：<br/>
            <a href="${detailUrl}">${detailUrl}</a></p>
        `;
    }

    try {
        await sendGraphMail(from, to, subject, html);
        await prisma.notification.create({
            data: { scheduleId, type: `ALERT_${type}`, recipient: to, success: true },
        });
    } catch (err: any) {
        await prisma.notification.create({
            data: { scheduleId, type: `ALERT_${type}`, recipient: to, success: false, error: String(err?.message ?? err) },
        });
        console.error("sendCreatorAlertMail error:", err);
    }
}

/**
 * URLの有効期限切れ2日前リマインド（社内作成者へ）

 */
export async function sendExpiryWarningMail(
    to: string,
    variables: Record<string, string>,
    scheduleId: string
) {
    const subject = await renderTemplate("email_expiry_warning_subject", variables);
    const body = await renderTemplate("email_expiry_warning_body", variables);
    const html = body.replace(/\n/g, "<br>");
    await sendMail(to, subject, html, scheduleId, "EXPIRED_WARNING");
}

/**
 * 候補日時が0件になった通知（社内作成者へ）
 */
export async function sendNoSlotsMail(
    to: string,
    variables: Record<string, string>,
    scheduleId: string,
    notificationType: string = "NO_SLOTS"
) {
    const subject = await renderTemplate("email_no_slots_subject", variables);
    const body = await renderTemplate("email_no_slots_body", variables);
    const html = body.replace(/\n/g, "<br>");
    await sendMail(to, subject, html, scheduleId, notificationType);
}
