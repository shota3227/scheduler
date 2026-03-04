"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { formatDateTime } from "@/lib/utils";

interface ScheduleInfo {
    id: string;
    title: string;
    duration: number;
    location?: string;
    address?: string;
    status: string;
    expiresAt: string;
}

interface Slot {
    start: string;
    end: string;
}

interface SiteConfig {
    heading: string;
    description: string;
    noSlotsMessage: string;
    completionMessage: string;
    companyName: string;
    logoUrl: string;
}

export default function GuestPage() {
    const params = useParams();
    const token = params.token as string;

    const [schedule, setSchedule] = useState<ScheduleInfo | null>(null);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [config, setConfig] = useState<SiteConfig | null>(null);
    const [selected, setSelected] = useState<Slot | null>(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [completed, setCompleted] = useState(false);
    const [completionMsg, setCompletionMsg] = useState("");
    const [isRescheduleRequested, setIsRescheduleRequested] = useState(false);
    const [expired, setExpired] = useState(false);
    const confirmSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, [token]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 調整情報・候補日時を取得
            const res = await fetch(`/api/guest/${token}`);

            if (res.status === 410) {
                setExpired(true);
                return;
            }
            if (res.status === 404) {
                setError("URLが無効です");
                return;
            }

            const data = await res.json();

            if (data.error === "already_confirmed") {
                setCompleted(true);
                return;
            }

            setSchedule(data.schedule);
            setSlots(data.slots || []);

            // サイト設定を取得（文言・ブランディング）
            const configRes = await fetch("/api/public/config");
            if (configRes.ok) {
                const configs = await configRes.json();
                setConfig(configs);
            }
        } catch (e) {
            setError("データの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async () => {
        if (!selected || !schedule) return;
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/guest/select", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    slotStart: selected.start,
                    slotEnd: selected.end,
                    message,
                }),
            });
            const data = await res.json();

            if (res.status === 409) {
                // 競合エラー
                setError(data.message || "選択した日時が埋まっています。再選択してください。");
                setSelected(null);
                await loadData(); // 最新の候補を再取得
                return;
            }

            if (!res.ok) throw new Error(data.error || "エラーが発生しました");

            setCompletionMsg(data.message);
            setCompleted(true);
        } catch (e: any) {
            setError(e.message || "エラーが発生しました");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReschedule = async () => {
        if (!schedule) return;
        if (!confirm("別の日程での再調整を依頼しますか？\n（入力した備考・メッセージも送信されます）")) return;

        setSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/guest/reschedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    message,
                }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "エラーが発生しました");

            setIsRescheduleRequested(true);
            setCompletionMsg("再調整の依頼を送信しました。担当者からのご連絡をお待ちください。");
            setCompleted(true);
        } catch (e: any) {
            setError(e.message || "エラーが発生しました");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (expired) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">URLの有効期限が切れています</h2>
                    <p className="text-gray-500 text-sm">このURLは無効になりました。担当者にお問い合わせください。</p>
                </div>
            </div>
        );
    }

    if (error && !schedule) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
                    <p className="text-red-600">{error}</p>
                </div>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    {config?.logoUrl && (
                        <img src={config.logoUrl} alt="ロゴ" className="h-10 mx-auto mb-4 object-contain" />
                    )}
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${isRescheduleRequested ? "bg-amber-100" : "bg-green-100"}`}>
                        {isRescheduleRequested ? (
                            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        {isRescheduleRequested ? "再調整の依頼を送信しました" : "日程が確定しました"}
                    </h2>

                    {!isRescheduleRequested && selected && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 my-6 text-left inline-block w-full">
                            <p className="text-sm font-medium text-blue-900 mb-2 text-center">以下の日時で確定いたしました</p>
                            <div className="flex items-center justify-center gap-2 text-blue-800 font-bold text-lg">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {new Date(selected.start).toLocaleDateString("ja-JP", {
                                    year: "numeric", month: "short", day: "numeric", weekday: "short"
                                })}
                                {" "}
                                {new Date(selected.start).toLocaleTimeString("ja-JP", {
                                    hour: "2-digit", minute: "2-digit"
                                })}
                                -
                                {new Date(selected.end).toLocaleTimeString("ja-JP", {
                                    hour: "2-digit", minute: "2-digit"
                                })}
                            </div>
                        </div>
                    )}

                    <p className="text-gray-600 text-sm leading-relaxed">
                        {completionMsg || config?.completionMessage || "日程のご確認ありがとうございます。担当者より改めてご連絡いたします。"}
                    </p>
                    {config?.companyName && (
                        <p className="text-gray-400 text-xs mt-6">{config.companyName}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
            <div className="max-w-lg mx-auto">
                {/* ヘッダー */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
                    {config?.logoUrl && (
                        <img src={config.logoUrl} alt="ロゴ" className="h-8 mb-4 object-contain" />
                    )}
                    <h1 className="text-xl font-bold text-gray-900 mb-1">
                        {config?.heading || "打ち合わせ日時のご選択をお願いいたします"}
                    </h1>
                    <p className="text-gray-500 text-sm">
                        {config?.description || "下記の候補日時の中からご都合のよい日時を1つお選びください。"}
                    </p>
                    {schedule && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                            <p className="font-medium text-blue-900">{schedule.title}</p>
                            <p className="text-blue-700 mt-0.5">所要時間: {schedule.duration}分</p>
                            {schedule.location && <p className="text-blue-700">場所: {schedule.location}</p>}
                            {schedule.address && <p className="text-blue-700">{schedule.address}</p>}
                            {schedule.expiresAt && (
                                <p className="text-red-600 font-medium mt-2">
                                    ※ 有効期限: {new Date(schedule.expiresAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })} {new Date(schedule.expiresAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* 候補日時リスト */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
                    <h2 className="font-semibold text-gray-900 mb-4">候補日時一覧</h2>
                    {error && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                            {error}
                        </div>
                    )}
                    {slots.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-6">
                            {config?.noSlotsMessage || "現在ご選択いただける候補日時がございません。担当者より改めてご連絡いたします。"}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {slots.map((slot, i) => {
                                const isSelected = selected?.start === slot.start;
                                return (
                                    <button
                                        key={i}
                                        id={`slot-btn-${i}`}
                                        onClick={() => {
                                            setSelected(slot);
                                            setTimeout(() => {
                                                confirmSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                            }, 50);
                                        }}
                                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${isSelected
                                            ? "border-blue-500 bg-blue-50 text-blue-900"
                                            : "border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-900"
                                            }`}
                                    >
                                        <span className="font-medium">
                                            {new Date(slot.start).toLocaleDateString("ja-JP", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                                weekday: "short",
                                            })}
                                        </span>
                                        <span className="ml-3 text-sm">
                                            {new Date(slot.start).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}〜{new Date(slot.end).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 備考・送信 */}
                {slots.length > 0 && (
                    <div ref={confirmSectionRef} className="bg-white rounded-2xl shadow-sm p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            備考・メッセージ（任意）
                        </label>
                        <textarea
                            id="guest-message-input"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                            placeholder="ご要望等があればご記入ください"
                        />
                        <button
                            id="confirm-slot-btn"
                            disabled={!selected || submitting}
                            onClick={handleSelect}
                            className="w-full bg-blue-600 text-white rounded-xl px-4 py-3 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-3"
                        >
                            {submitting ? "処理中..." : selected ? "この日時で確定する" : "日時を選択してください"}
                        </button>
                        <button
                            id="reschedule-request-btn"
                            disabled={submitting}
                            onClick={handleReschedule}
                            className="w-full bg-white border border-gray-300 text-gray-700 rounded-xl px-4 py-3 font-medium hover:bg-gray-50 focus:bg-gray-50 transition-colors"
                        >
                            選択肢の中では調整が難しい
                        </button>
                        {config?.companyName && (
                            <p className="text-center text-gray-400 text-xs mt-4">{config.companyName}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
