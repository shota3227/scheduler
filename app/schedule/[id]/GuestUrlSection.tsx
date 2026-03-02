"use client";

import { useState } from "react";

interface Props {
    scheduleId: string;
    guestUrl: string;
    emailSentAt: string | null;
}

export default function GuestUrlSection({ scheduleId, guestUrl, emailSentAt }: Props) {
    const [copied, setCopied] = useState(false);
    const [guestEmail, setGuestEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");

    const copyUrl = () => {
        navigator.clipboard.writeText(guestUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sendEmail = async () => {
        if (!guestEmail) return;
        setSending(true);
        setError("");
        try {
            const res = await fetch("/api/notify/send-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scheduleId, guestEmail }),
            });
            if (!res.ok) throw new Error("送信に失敗しました");
            setSent(true);
            setGuestEmail("");
        } catch (e: any) {
            setError(e.message ?? "エラーが発生しました");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">ゲスト用 URL</h2>

            {/* URL 表示 + コピーボタン */}
            <div className="flex items-center gap-2 mb-5">
                <input
                    type="text"
                    readOnly
                    value={guestUrl}
                    className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 font-mono truncate"
                />
                <button
                    onClick={copyUrl}
                    className="shrink-0 inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    {copied ? (
                        <>
                            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            コピー済み
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            コピー
                        </>
                    )}
                </button>
            </div>

            {/* メール送信フォーム */}
            <div className="border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-600 mb-3">ゲストのメールアドレスへ URL を送信</p>
                <div className="flex gap-2">
                    <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="guest@example.com"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={sending}
                    />
                    <button
                        onClick={sendEmail}
                        disabled={!guestEmail || sending}
                        className="shrink-0 inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm rounded-lg px-4 py-2 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {sending ? "送信中..." : "送信"}
                    </button>
                </div>
                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                {sent && (
                    <p className="mt-2 text-xs text-green-600">メールを送信しました</p>
                )}
                {!sent && emailSentAt && (
                    <p className="mt-2 text-xs text-gray-400">
                        最終送信: {new Date(emailSentAt).toLocaleString("ja-JP")}
                    </p>
                )}
            </div>
        </div>
    );
}
