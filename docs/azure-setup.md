# Azure AD アプリ登録手順書

## Microsoft 365 連携のためのAzure ADアプリ登録

### 必要な権限
- Microsoft 365 管理者権限

---

## 手順1：Azure ポータルへアクセス

1. [Microsoft Azure ポータル](https://portal.azure.com) にサインイン
2. 左メニューから **「Azure Active Directory」** （または「Microsoft Entra ID」）を選択

---

## 手順2：アプリの登録

1. **「アプリの登録」** → **「新規登録」** をクリック
2. 以下を入力：
   - **名前**：`日程調整システム`
   - **サポートされるアカウントの種類**：`この組織ディレクトリのみに含まれるアカウント`
   - **リダイレクトURI**：
     - 種類：`Web`
     - URI：`http://localhost:3000/api/auth/callback/microsoft-entra-id`（開発用）
     - URI：`https://your-app.vercel.app/api/auth/callback/microsoft-entra-id`（本番用）
3. **「登録」** をクリック

---

## 手順3：クライアントシークレットの作成

1. 登録したアプリの **「証明書とシークレット」** を開く
2. **「新しいクライアントシークレット」** をクリック
3. 説明を入力し、有効期限を選択（例：24ヶ月）
4. **「追加」** → 表示された **「値」** をコピー（`.env` の `AUTH_MICROSOFT_ENTRA_ID_SECRET` に設定）

> [!CAUTION]
> シークレットの値はこの画面でのみ表示されます。必ず安全な場所に保存してください。

---

## 手順4：API権限の付与

1. **「APIのアクセス許可」** → **「アクセス許可の追加」** をクリック
2. **「Microsoft Graph」** を選択
3. **「委任されたアクセス許可」** から以下を追加：
   - `Calendars.Read` - カレンダーの読み取り
   - `User.Read` - ユーザー情報の読み取り
   - `offline_access` - リフレッシュトークン
4. **「アプリケーションの許可」** から以下を追加（バックエンドでの代理アクセス用）：
   - `Calendars.Read` - カレンダーの読み取り
   - `User.Read.All` - 全ユーザー情報の読み取り
   - `Mail.Send` - いずれかのユーザー（システムアドレス等）としてメールを送信
5. **「〇〇ディレクトリに管理者の同意を与えます」** をクリック

---

## 手順5：環境変数の設定

アプリ登録後、以下の値を `.env` ファイルに設定します：

```env
AUTH_MICROSOFT_ENTRA_ID_ID="アプリケーション（クライアント）ID"
AUTH_MICROSOFT_ENTRA_ID_SECRET="クライアントシークレットの値"
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID="ディレクトリ（テナント）ID"
GRAPH_CLIENT_ID="アプリケーション（クライアント）ID"  # 同じ値
GRAPH_CLIENT_SECRET="クライアントシークレットの値"   # 同じ値
GRAPH_TENANT_ID="ディレクトリ（テナント）ID"         # 同じ値
```

> [!NOTE]
> 「アプリケーションID」と「テナントID」は、アプリの「概要」ページで確認できます。

---

## 手順6：Vercel本番環境でのリダイレクトURI追加

1. Vercelにデプロイ後、本番URLが確定したら
2. Azure ポータルの **「認証」** → **「プラットフォームの追加」** → **「Web」**
3. リダイレクトURIに `https://your-app.vercel.app/api/auth/callback/microsoft-entra-id` を追加

---

## 確認事項

- [ ] アプリが登録された
- [ ] クライアントシークレットが作成され、`.env` に設定された
- [ ] API権限が正しく付与された
- [ ] 管理者の同意が付与された
- [ ] `.env` に全ての環境変数が設定された
