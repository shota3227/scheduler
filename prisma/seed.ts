import "dotenv/config";

// シードはDirect Connectionが必要（pgbouncer非対応のため）
if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding database...");

    // 初期文言設定
    const siteConfigs = [
        // 文言設定
        {
            key: "wording_guest_heading",
            value: "打ち合わせ日時のご選択をお願いいたします",
            label: "社外向けURL画面の見出し",
            category: "WORDING",
        },
        {
            key: "wording_guest_description",
            value: "下記の候補日時の中からご都合のよい日時を1つお選びください。",
            label: "社外向けURL画面の説明文",
            category: "WORDING",
        },
        {
            key: "wording_no_slots_message",
            value: "現在ご選択いただける候補日時がございません。担当者より改めてご連絡いたします。",
            label: "候補日時が0件の場合のメッセージ",
            category: "WORDING",
        },
        {
            key: "wording_conflict_message",
            value: "行き違いで選択した日時が埋まってしまったようです。再選択をお願いします。",
            label: "競合エラー時のメッセージ",
            category: "WORDING",
        },
        {
            key: "wording_completion_message",
            value: "日程のご確認ありがとうございます。担当者より改めてご連絡いたします。",
            label: "日時確定後の完了メッセージ（社外向け）",
            category: "WORDING",
        },
        // ブランディング設定
        {
            key: "branding_company_name",
            value: "株式会社Luvir",
            label: "社名",
            category: "BRANDING",
        },
        {
            key: "branding_logo_url",
            value: "",
            label: "ロゴ画像URL",
            category: "BRANDING",
        },
        // メールテンプレート
        {
            key: "email_confirmed_subject",
            value: "【日程確定】{title}",
            label: "確定通知メール件名",
            category: "EMAIL_TEMPLATE",
        },
        {
            key: "email_confirmed_body",
            value: `{creator_name} 様\n\n以下の打ち合わせ日程が確定しました。\n\n■ 打ち合わせ名：{title}\n■ 日時：{datetime}\n■ 先方からのメッセージ：{message}\n\nよろしくお願いいたします。\n\n日程調整システム`,
            label: "確定通知メール本文",
            category: "EMAIL_TEMPLATE",
        },
        {
            key: "email_url_subject",
            value: "【日程調整のお願い】{title}",
            label: "URL案内メール件名",
            category: "EMAIL_TEMPLATE",
        },
        {
            key: "email_url_body",
            value: `お世話になっております。\n{creator_name} と申します。\n\n打ち合わせの日程調整をお願いいたしたく、下記URLより候補日時をご選択ください。\n\n■ 打ち合わせ名：{title}\n■ 日程選択URL：{url}\n■ URLの有効期限：{expires_at}\n\nご不明な点がございましたら、お気軽にご連絡ください。\nよろしくお願いいたします。`,
            label: "URL案内メール本文",
            category: "EMAIL_TEMPLATE",
        },
        {
            key: "email_expiry_warning_subject",
            value: "【期限切れ間近】{title} の日程調整URLが間もなく期限切れになります",
            label: "期限切れ警告メール件名",
            category: "EMAIL_TEMPLATE",
        },
        {
            key: "email_expiry_warning_body",
            value: `{creator_name} 様\n\n以下の日程調整URLが24時間以内に期限切れになります。\n\n■ 打ち合わせ名：{title}\n■ URLの有効期限：{expires_at}\n■ 日程選択URL：{url}\n\n必要に応じて再度URLを送付するか、直接ご連絡ください。\n\n日程調整システム`,
            label: "期限切れ警告メール本文",
            category: "EMAIL_TEMPLATE",
        },
        {
            key: "email_no_slots_subject",
            value: "【要確認】{title} の候補日時がなくなりました",
            label: "候補日時0件通知メール件名",
            category: "EMAIL_TEMPLATE",
        },
        {
            key: "email_no_slots_body",
            value: `{creator_name} 様\n\n以下の日程調整において、空き候補日時がなくなりました。\n\n■ 打ち合わせ名：{title}\n\n参加者のカレンダーを確認の上、再度日程調整を行ってください。\n\n日程調整システム`,
            label: "候補日時0件通知メール本文",
            category: "EMAIL_TEMPLATE",
        },
    ];

    for (const config of siteConfigs) {
        await prisma.siteConfig.upsert({
            where: { key: config.key },
            update: {},
            create: config,
        });
    }

    console.log(`Seeded ${siteConfigs.length} site configs.`);

    // 初期管理者アカウント（Microsoft 365 SSOが使えない場合の緊急用）
    // 本番では Microsoft 365 SSO で最初のログイン後に管理者ロールを付与する
    console.log("Seeding complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
