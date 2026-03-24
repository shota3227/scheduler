"use client";

import React, { useState, useEffect, useCallback } from "react";
import PendingLink from "@/components/navigation/PendingLink";

interface Config {
    id: string;
    key: string;
    value: string;
    label: string;
    category: string;
}

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
}

interface ImageDropzoneProps {
    value?: string;
    dbKey: string;
    onChange: (base64: string) => void;
    label: string;
    description?: string;
}

function ImageDropzone({ value, dbKey, onChange, label, description }: ImageDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState("");

    const saveImage = async (base64: string) => {
        setSaving(true);
        setSaved(false);
        setSaveError("");
        try {
            const res = await fetch("/api/admin/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([{ key: dbKey, value: base64 }]),
            });
            if (!res.ok) throw new Error(await res.text());
            onChange(base64);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            setSaveError("保存に失敗しました");
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const readFile = (file: File) => {
        const isPng = file.type === "image/png";
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            // 最大1200pxにリサイズ（OGP等の大きい画像を圧縮）
            const maxDim = 1200;
            if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
            if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) { setSaveError("圧縮処理に失敗しました"); return; }
            // PNG以外（JPEG等）は白背景を敷いてJPEGに変換
            if (!isPng) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, w, h);
            }
            ctx.drawImage(img, 0, 0, w, h);
            const mimeType = isPng ? "image/png" : "image/jpeg";
            const quality = isPng ? 1.0 : 0.75;
            const compressed = canvas.toDataURL(mimeType, quality);
            saveImage(compressed);
        };
        img.onerror = () => setSaveError("ファイルの読み込みに失敗しました");
        img.src = url;
    };

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                readFile(e.dataTransfer.files[0]);
            }
        },
        [dbKey]
    );

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const clearImage = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await saveImage("");
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">{label}</label>
                {saving && <span className="text-xs text-blue-600">保存中...</span>}
                {saved && <span className="text-xs text-green-600 font-medium">✓ 保存しました</span>}
                {saveError && <span className="text-xs text-red-600">{saveError}</span>}
            </div>
            {description && <p className="text-xs text-gray-500">{description}</p>}
            <div
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : saving ? "border-blue-300 bg-blue-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !saving && document.getElementById(`file-upload-${dbKey}`)?.click()}
            >
                <input
                    id={`file-upload-${dbKey}`}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            readFile(e.target.files[0]);
                        }
                    }}
                />

                {value ? (
                    <div className="relative w-full flex justify-center">
                        <img
                            src={value.startsWith("data:") ? value : `/api/images/${dbKey}`}
                            alt={label}
                            className="max-h-32 object-contain rounded"
                        />
                        {!saving && (
                            <button
                                type="button"
                                onClick={clearImage}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 shadow"
                            >
                                ×
                            </button>
                        )}
                    </div>
                ) : saving ? (
                    <div className="text-center text-blue-500">
                        <svg className="animate-spin mx-auto h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm font-medium">アップロード中...</span>
                    </div>
                ) : (
                    <div className="text-center text-gray-500">
                        <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                            クリックまたはドラッグ＆ドロップで画像を配置
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AdminPage() {
    const [configs, setConfigs] = useState<Config[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [activeTab, setActiveTab] = useState<"wording" | "branding" | "email" | "members">("wording");
    const [editValues, setEditValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/admin/config").then((r) => r.json()).then((data) => {
            setConfigs(data);
            const vals: Record<string, string> = {};
            data.forEach((c: Config) => { vals[c.key] = c.value; });
            setEditValues(vals);
        });
        fetch("/api/admin/members").then((r) => r.json()).then(setMembers);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError("");
        try {
            // 画像Base64データは個別保存のため除外し、文字列設定のみ一括保存する
            const updates = Object.entries(editValues)
                .filter(([, value]) => !value.startsWith("data:"))
                .map(([key, value]) => ({ key, value }));
            const res = await fetch("/api/admin/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error(await res.text());
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {
            setError("保存に失敗しました");
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setError("");
        try {
            const res = await fetch("/api/admin/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "sync" }),
            });
            const data = await res.json();
            alert(`${data.synced}名を同期しました`);
            const membersRes = await fetch("/api/admin/members");
            setMembers(await membersRes.json());
        } catch {
            setError("同期に失敗しました");
        } finally {
            setSyncing(false);
        }
    };

    const handleRoleChange = async (id: string, role: string) => {
        await fetch("/api/admin/members", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, role }),
        });
        setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role } : m));
    };

    const handleActiveChange = async (id: string, isActive: boolean) => {
        await fetch("/api/admin/members", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, isActive }),
        });
        setMembers((prev) => prev.map((m) => m.id === id ? { ...m, isActive } : m));
    };

    const wordingConfigs = configs.filter((c) => c.category === "WORDING");
    const brandingConfigs = configs.filter((c) => c.category === "BRANDING");
    const emailConfigs = configs.filter((c) => c.category === "EMAIL_TEMPLATE");

    const tabs = [
        { id: "wording", label: "文言管理" },
        { id: "branding", label: "ブランディング" },
        { id: "email", label: "メールテンプレート" },
        { id: "members", label: "メンバー管理" },
    ] as const;

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <PendingLink href="/dashboard" className="text-sm text-blue-600">← ダッシュボード</PendingLink>
                        <span className="font-bold text-gray-900">管理者設定</span>
                    </div>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-8">
                {/* タブ */}
                <div className="flex border-b border-gray-200 mb-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            id={`admin-tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

                {/* 文言管理 */}
                {activeTab === "wording" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-bold text-gray-900">文言設定</h2>
                            <p className="text-xs text-gray-500">社外向け画面に表示される文言を変更できます</p>
                        </div>
                        {wordingConfigs.map((config) => (
                            <div key={config.key} className="bg-white rounded-xl border border-gray-200 p-5">
                                <label className="block text-sm font-medium text-gray-700 mb-2">{config.label}</label>
                                <textarea
                                    id={`config-${config.key}`}
                                    value={editValues[config.key] ?? ""}
                                    onChange={(e) => setEditValues((prev) => ({ ...prev, [config.key]: e.target.value }))}
                                    rows={2}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        ))}
                        <button
                            id="save-wording-btn"
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saved ? "保存しました ✓" : saving ? "保存中..." : "保存する"}
                        </button>
                    </div>
                )}

                {/* ブランディング */}
                {activeTab === "branding" && (
                    <div className="space-y-6">
                        <h2 className="font-bold text-gray-900 mb-2">ブランディング設定</h2>

                        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">社名</label>
                                <input
                                    type="text"
                                    value={editValues["branding_company_name"] ?? ""}
                                    onChange={(e) => setEditValues((prev) => ({ ...prev, ["branding_company_name"]: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <ImageDropzone
                                label="ロゴ画像"
                                dbKey="branding_logo_data"
                                description="ヘッダーや各種画面に表示される企業ロゴです。背景透過のPNG形式を推奨します。"
                                value={editValues["branding_logo_data"] ?? editValues["branding_logo_url"] ?? ""}
                                onChange={(val) => setEditValues((prev) => ({ ...prev, ["branding_logo_data"]: val }))}
                            />

                            <ImageDropzone
                                label="ファビコン (favicon)"
                                dbKey="branding_favicon_data"
                                description="ブラウザのタブに表示される小さなアイコンです。正方形のPNGまたはICO形式を推奨します。"
                                value={editValues["branding_favicon_data"] ?? ""}
                                onChange={(val) => setEditValues((prev) => ({ ...prev, ["branding_favicon_data"]: val }))}
                            />

                            <ImageDropzone
                                label="OGP画像"
                                dbKey="branding_ogp_data"
                                description="SNSやチャットツール（Slack等）でURLを共有した際にプレビューとして表示される画像です。（推奨サイズ: 1200 x 630）"
                                value={editValues["branding_ogp_data"] ?? ""}
                                onChange={(val) => setEditValues((prev) => ({ ...prev, ["branding_ogp_data"]: val }))}
                            />
                        </div>

                        <button
                            id="save-branding-btn"
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saved ? "保存しました ✓" : saving ? "保存中..." : "保存する"}
                        </button>
                    </div>
                )}

                {/* メールテンプレート */}
                {activeTab === "email" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-bold text-gray-900">メールテンプレート</h2>
                            <p className="text-xs text-gray-500">{"{変数名}"} 形式で動的項目を埋め込めます</p>
                        </div>
                        {emailConfigs.map((config) => (
                            <div key={config.key} className="bg-white rounded-xl border border-gray-200 p-5">
                                <label className="block text-sm font-medium text-gray-700 mb-2">{config.label}</label>
                                <textarea
                                    id={`config-${config.key}`}
                                    value={editValues[config.key] ?? ""}
                                    onChange={(e) => setEditValues((prev) => ({ ...prev, [config.key]: e.target.value }))}
                                    rows={config.key.includes("body") ? 6 : 2}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        ))}
                        <button
                            id="save-email-btn"
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saved ? "保存しました ✓" : saving ? "保存中..." : "保存する"}
                        </button>
                    </div>
                )}

                {/* メンバー管理 */}
                {activeTab === "members" && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-bold text-gray-900">メンバー管理</h2>
                            <button
                                id="sync-members-btn"
                                onClick={handleSync}
                                disabled={syncing}
                                className="inline-flex items-center gap-2 border border-blue-600 text-blue-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-50 disabled:opacity-50"
                            >
                                {syncing ? "同期中..." : "Microsoft 365と同期"}
                            </button>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="text-left px-5 py-3 text-gray-600 font-medium">名前</th>
                                        <th className="text-left px-4 py-3 text-gray-600 font-medium">メールアドレス</th>
                                        <th className="text-left px-4 py-3 text-gray-600 font-medium">ステータス</th>
                                        <th className="text-left px-4 py-3 text-gray-600 font-medium">ロール</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {members.map((member) => (
                                        <tr key={member.id}>
                                            <td className="px-5 py-4 font-medium text-gray-900">{member.name}</td>
                                            <td className="px-4 py-4 text-gray-600">{member.email}</td>
                                            <td className="px-4 py-4">
                                                <select
                                                    id={`active-select-${member.id}`}
                                                    value={member.isActive ? "true" : "false"}
                                                    onChange={(e) => handleActiveChange(member.id, e.target.value === "true")}
                                                    className={`border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${member.isActive ? "border-green-300 text-green-700 bg-green-50" : "border-gray-300 text-gray-500 bg-gray-50"}`}
                                                >
                                                    <option value="true">有効</option>
                                                    <option value="false">無効</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-4">
                                                <select
                                                    id={`role-select-${member.id}`}
                                                    value={member.role}
                                                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                                    className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                >
                                                    <option value="USER">一般ユーザー</option>
                                                    <option value="ADMIN">管理者</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
