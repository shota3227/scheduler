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
 * URLの有効期限切れ24時間前警告（社内作成者へ）
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
    scheduleId: string
) {
    const subject = await renderTemplate("email_no_slots_subject", variables);
    const body = await renderTemplate("email_no_slots_body", variables);
    const html = body.replace(/\n/g, "<br>");
    await sendMail(to, subject, html, scheduleId, "NO_SLOTS");
}
