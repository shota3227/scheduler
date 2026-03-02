# SMTP設定手順書

## @luvir.jp ドメインからのメール送信設定

---

## 手順1：SMTP認証情報の確認

`@luvir.jp` ドメインのメール送信に必要なSMTP情報を、メールサーバー管理者またはドメイン管理会社から入手してください。

一般的なSMTP設定値：

| 設定項目 | 一般的な値 | 説明 |
|---------|-----------|------|
| SMTP_HOST | mail.luvir.jp など | SMTPサーバーホスト名 |
| SMTP_PORT | 587（STARTTLS）または 465（SSL） | ポート番号 |
| SMTP_USER | noreply@luvir.jp | 送信者メールアドレス |
| SMTP_PASSWORD | *** | SMTPパスワード |

---

## 手順2：.envファイルへの設定

```env
SMTP_HOST="mail.luvir.jp"
SMTP_PORT="587"
SMTP_USER="noreply@luvir.jp"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="日程調整システム <noreply@luvir.jp>"
```

---

## 手順3：Vercel環境変数への登録

1. Vercel ダッシュボードにアクセス
2. プロジェクト → **「Settings」** → **「Environment Variables」**
3. 上記のSMTP関連環境変数をすべて登録
4. **「Production」** と **「Preview」** 両方に適用

---

## 手順4：メール送信テスト

ローカル開発環境での送信テスト：

```bash
# テスト用スクリプトを実行
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
});
transporter.sendMail({
  from: process.env.SMTP_FROM,
  to: 'test@example.com',
  subject: 'テストメール',
  text: 'SMTPテスト送信'
}).then(console.log).catch(console.error);
"
```

---

## よくある問題と対処法

| 問題 | 原因 | 対処法 |
|-----|------|-------|
| 接続タイムアウト | ファイアウォールのポートブロック | IT管理者にポート587/465の開放を依頼 |
| 認証失敗 | パスワード誤り or 2段階認証 | パスワード確認・アプリパスワードの使用 |
| TLSエラー | SSL/TLS設定ミス | SMTP_PORTを587（STARTTLS）に変更 |

---

## Vercel無料プランでのメール制限

- Vercelのサーバーレス関数からSMTP接続は可能
- 1回のリクエストで10秒以内に送信を完了させること
- 大量送信には専用のメール配信サービス（SendGrid等）の利用を推奨
