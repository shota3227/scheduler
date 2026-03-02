"use client";

import { useState, useEffect } from "react";

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
            const updates = Object.entries(editValues).map(([key, value]) => ({ key, value }));
            await fetch("/api/admin/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
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
                        <a href="/dashboard" className="text-sm text-blue-600">← ダッシュボード</a>
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
                    <div className="space-y-4">
                        <h2 className="font-bold text-gray-900 mb-2">ブランディング設定</h2>
                        {brandingConfigs.map((config) => (
                            <div key={config.key} className="bg-white rounded-xl border border-gray-200 p-5">
                                <label className="block text-sm font-medium text-gray-700 mb-2">{config.label}</label>
                                {config.key === "branding_logo_url" ? (
                                    <div className="space-y-2">
                                        <input
                                            id={`config-${config.key}`}
                                            type="url"
                                            value={editValues[config.key] ?? ""}
                                            onChange={(e) => setEditValues((prev) => ({ ...prev, [config.key]: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://example.com/logo.png"
                                        />
                                        {editValues[config.key] && (
                                            <img src={editValues[config.key]} alt="プレビュー" className="h-12 object-contain border border-gray-200 rounded p-1" />
                                        )}
                                    </div>
                                ) : (
                                    <input
                                        id={`config-${config.key}`}
                                        type="text"
                                        value={editValues[config.key] ?? ""}
                                        onChange={(e) => setEditValues((prev) => ({ ...prev, [config.key]: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                            </div>
                        ))}
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
