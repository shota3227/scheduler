import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

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
 * メール送信（汎用）
 */
async function sendMail(to: string, subject: string, html: string, scheduleId?: string, type?: string) {
    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            html,
        });
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
 */
export async function sendConfirmedMail(
    to: string,
    variables: Record<string, string>,
    scheduleId: string
) {
    const subject = await renderTemplate("email_confirmed_subject", variables);
    const body = await renderTemplate("email_confirmed_body", variables);
    const html = body.replace(/\n/g, "<br>");
    await sendMail(to, subject, html, scheduleId, "CONFIRMED");
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
