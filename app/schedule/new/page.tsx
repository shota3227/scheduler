"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Member {
    id: string;
    name: string;
    email: string;
}

interface TimeSlot {
    start: string;
    end: string;
}

// ローカル日付文字列（YYYY-MM-DD）を生成
function toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// 時刻選択肢（30分刻み、7:00〜22:00）
const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

export default function NewSchedulePage() {
    const router = useRouter();
    const [step, setStep] = useState(1); // 1:基本情報 2:参加者 3:候補日時 4:URL発行
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [title, setTitle] = useState("");
    const [duration, setDuration] = useState(60);
    const [location, setLocation] = useState("");
    const [address, setAddress] = useState("");
    const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
    const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
    const [guestUrl, setGuestUrl] = useState("");
    const [urlCopied, setUrlCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [error, setError] = useState("");

    // 絞り込みフィルタ
    const [filterStartDate, setFilterStartDate] = useState(() => toLocalDateStr(new Date()));
    const [filterEndDate, setFilterEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return toLocalDateStr(d);
    });
    const [filterStartTime, setFilterStartTime] = useState("09:00");
    const [filterEndTime, setFilterEndTime] = useState("18:00");

    const sessionContext = useSession();
    const session = sessionContext?.data;

    useEffect(() => {
        fetch("/api/admin/members")
            .then((r) => r.json())
            .then((data: any[]) => setMembers(data.filter((m: any) => m.isActive)));
    }, []);

    // メンバーリストまたはセッションがロードされたら、自分自身を初期選択する
    useEffect(() => {
        if (session?.user?.email && members.length > 0 && selectedMembers.length === 0) {
            const myEmail = session.user.email.toLowerCase();
            const me = members.find(m => m.email.toLowerCase() === myEmail);
            if (me) {
                setSelectedMembers([me.id]);
            }
        }
    }, [session?.user?.email, members, selectedMembers.length]);

    // フィルタ適用後のスロット
    const filteredSlots = availableSlots.filter((slot) => {
        const start = new Date(slot.start);
        const end = new Date(slot.end);

        // 期間フィルタ（スロット開始日で判定）
        if (filterStartDate) {
            const [y, mo, d] = filterStartDate.split("-").map(Number);
            const localStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
            if (start < localStart) return false;
        }
        if (filterEndDate) {
            const [y, mo, d] = filterEndDate.split("-").map(Number);
            const localEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);
            if (start > localEnd) return false;
        }

        // 開始時刻フィルタ（スロット開始時刻がフィルタ以降か）
        const slotStartMinutes = start.getHours() * 60 + start.getMinutes();
        if (filterStartTime) {
            const [h, m] = filterStartTime.split(":").map(Number);
            if (slotStartMinutes < h * 60 + m) return false;
        }

        let slotEndMinutes = end.getHours() * 60 + end.getMinutes();
        if (slotEndMinutes === 0 || slotEndMinutes < slotStartMinutes) {
            slotEndMinutes += 24 * 60; // 00:00 は 24:00 として扱う
        }

        if (filterEndTime) {
            const [h, m] = filterEndTime.split(":").map(Number);
            if (slotEndMinutes > h * 60 + m) return false;
        }

        return true;
    });

    // フィルタ変更時に、フィルタ外になったスロットを選択から除去
    useEffect(() => {
        if (selectedSlots.length === 0) return;
        setSelectedSlots((prev) =>
            prev.filter((slot) => {
                const start = new Date(slot.start);
                const end = new Date(slot.end);

                if (filterStartDate) {
                    const [y, mo, d] = filterStartDate.split("-").map(Number);
                    if (start < new Date(y, mo - 1, d, 0, 0, 0, 0)) return false;
                }
                if (filterEndDate) {
                    const [y, mo, d] = filterEndDate.split("-").map(Number);
                    if (start > new Date(y, mo - 1, d, 23, 59, 59, 999)) return false;
                }

                const slotStartMinutes = start.getHours() * 60 + start.getMinutes();
                if (filterStartTime) {
                    const [h, m] = filterStartTime.split(":").map(Number);
                    if (slotStartMinutes < h * 60 + m) return false;
                }

                let slotEndMinutes = end.getHours() * 60 + end.getMinutes();
                if (slotEndMinutes === 0 || slotEndMinutes < slotStartMinutes) {
                    slotEndMinutes += 24 * 60; // 00:00 は 24:00 として扱う
                }

                if (filterEndTime) {
                    const [h, m] = filterEndTime.split(":").map(Number);
                    if (slotEndMinutes > h * 60 + m) return false;
                }

                return true;
            })
        );
    }, [filterStartDate, filterEndDate, filterStartTime, filterEndTime]); // eslint-disable-line react-hooks/exhaustive-deps

    // 全選択／全解除（フィルタ後のスロットのみ対象）
    const allFilteredSelected =
        filteredSlots.length > 0 &&
        filteredSlots.every((slot) =>
            selectedSlots.some((s) => s.start === slot.start && s.end === slot.end)
        );

    const toggleAllFiltered = () => {
        if (allFilteredSelected) {
            setSelectedSlots((prev) =>
                prev.filter(
                    (s) => !filteredSlots.some((f) => f.start === s.start && f.end === s.end)
                )
            );
        } else {
            setSelectedSlots((prev) => {
                const toAdd = filteredSlots.filter(
                    (slot) => !prev.some((s) => s.start === slot.start && s.end === slot.end)
                );
                return [...prev, ...toAdd];
            });
        }
    };

    const toggleMember = (id: string) => {
        setSelectedMembers((prev) =>
            prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
        );
    };

    const toggleSlot = (slot: TimeSlot) => {
        setSelectedSlots((prev) => {
            const exists = prev.some(
                (s) => s.start === slot.start && s.end === slot.end
            );
            return exists ? prev.filter((s) => s.start !== slot.start || s.end !== slot.end) : [...prev, slot];
        });
    };

    // Step3: 空き時間取得のみ（スケジュールはまだ作成しない）
    const fetchAvailableSlots = async () => {
        if (selectedMembers.length === 0) return;
        setLoadingSlots(true);
        setError("");
        try {
            const res = await fetch("/api/availability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    participantIds: selectedMembers,
                    duration,
                }),
            });
            if (!res.ok) throw new Error("空き時間の取得に失敗しました");
            const { slots } = await res.json();
            setAvailableSlots(slots || []);
            setSelectedSlots([]);
        } catch (e: any) {
            setError(e.message || "エラーが発生しました");
        } finally {
            setLoadingSlots(false);
        }
    };

    // Step4: スケジュール作成 + 候補日時保存 + URL生成を一括で行う
    const handleGenerateUrl = async (): Promise<boolean> => {
        setLoading(true);
        setError("");
        try {
            // スケジュールを作成
            const createRes = await fetch("/api/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    duration,
                    location: location || undefined,
                    address: address || undefined,
                    participantIds: selectedMembers,
                }),
            });
            if (!createRes.ok) throw new Error("スケジュールの作成に失敗しました");
            const schedule = await createRes.json();

            // 選択した候補日時を保存
            const patchRes = await fetch(`/api/schedules/${schedule.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timeSlots: selectedSlots }),
            });
            if (!patchRes.ok) throw new Error("候補日時の保存に失敗しました");

            setGuestUrl(`${window.location.origin}/guest/${schedule.guestToken}`);
            return true;
        } catch (e: any) {
            setError(e.message || "エラーが発生しました");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(guestUrl);
        } catch {
            const ta = document.createElement("textarea");
            ta.value = guestUrl;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2500);
    };

    const durationOptions = [
        { label: "15分", value: 15 },
        { label: "30分", value: 30 },
        { label: "45分", value: 45 },
        { label: "1時間", value: 60 },
        { label: "1時間30分", value: 90 },
        { label: "2時間", value: 120 },
        { label: "3時間", value: 180 },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ナビ */}
            <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <a href="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm">← ダッシュボードへ</a>
                    <span className="text-gray-300">/</span>
                    <span className="font-medium text-gray-900">新規日程調整</span>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {/* ステップインジケーター */}
                <div className="flex items-center gap-2 mb-8">
                    {["基本情報", "参加者選択", "候補日時", "URL発行"].map((label, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > i + 1 ? "bg-green-500 text-white" : step === i + 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                                {step > i + 1 ? "✓" : i + 1}
                            </div>
                            <span className={`text-sm ${step === i + 1 ? "font-medium text-gray-900" : "text-gray-400"}`}>{label}</span>
                            {i < 3 && <div className="w-8 h-px bg-gray-200" />}
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    {/* Step 1: 基本情報 */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold text-gray-900">基本情報の入力</h2>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">打ち合わせ件名 <span className="text-red-500">*</span></label>
                                <input
                                    id="title-input"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="例：〇〇プロジェクト打ち合わせ"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">打ち合わせ時間 <span className="text-red-500">*</span></label>
                                <select
                                    id="duration-select"
                                    value={duration}
                                    onChange={(e) => setDuration(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {durationOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">場所（会議室名）</label>
                                <input
                                    id="location-input"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="例：第1会議室（任意）"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">場所（住所・オンラインURL等）</label>
                                <input
                                    id="address-input"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="例：東京都渋谷区〇〇1-2-3（任意）"
                                />
                            </div>
                            <button
                                id="next-step2-btn"
                                disabled={!title}
                                onClick={() => setStep(2)}
                                className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                次へ：参加者を選択
                            </button>
                        </div>
                    )}

                    {/* Step 2: 参加者選択 */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold text-gray-900">参加者の選択</h2>
                            <p className="text-sm text-gray-500">打ち合わせに参加する社内メンバーをすべて選択してください。</p>

                            {/* 検索ボックス */}
                            <div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="名前やメールアドレスで検索..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                {members
                                    .filter((m) =>
                                        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        m.email.toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                    .sort((a, b) => a.name.localeCompare(b.name, "ja"))
                                    .map((member) => (
                                        <label key={member.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedMembers.includes(member.id)}
                                                onChange={() => toggleMember(member.id)}
                                                className="w-4 h-4 text-blue-600 rounded"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                                                <p className="text-xs text-gray-500">{member.email}</p>
                                            </div>
                                        </label>
                                    ))}
                            </div>
                            <div className="text-sm text-gray-600">
                                {selectedMembers.length}名選択中
                            </div>
                            {error && <p className="text-red-600 text-sm">{error}</p>}
                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50">戻る</button>
                                <button
                                    id="fetch-slots-btn"
                                    disabled={selectedMembers.length === 0 || loadingSlots}
                                    onClick={async () => { await fetchAvailableSlots(); setStep(3); }}
                                    className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {loadingSlots ? "空き時間を取得中..." : "次へ：候補日時を確認"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: 候補日時 */}
                    {step === 3 && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold text-gray-900">候補日時の確認・選択</h2>
                            <p className="text-sm text-gray-500">
                                参加者全員が空いているスロットを自動抽出しました。社外相手に提示する候補日時を選択してください。
                            </p>

                            {/* 絞り込みフィルタ */}
                            {availableSlots.length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">絞り込み</p>
                                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-500 whitespace-nowrap">期間</label>
                                            <input
                                                type="date"
                                                value={filterStartDate}
                                                onChange={(e) => setFilterStartDate(e.target.value)}
                                                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                            <span className="text-gray-400 text-sm">〜</span>
                                            <input
                                                type="date"
                                                value={filterEndDate}
                                                onChange={(e) => setFilterEndDate(e.target.value)}
                                                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-500 whitespace-nowrap">時間帯</label>
                                            <select
                                                value={filterStartTime}
                                                onChange={(e) => setFilterStartTime(e.target.value)}
                                                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                {TIME_OPTIONS.map((t) => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <span className="text-gray-400 text-sm">〜</span>
                                            <select
                                                value={filterEndTime}
                                                onChange={(e) => setFilterEndTime(e.target.value)}
                                                className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                                {TIME_OPTIONS.map((t) => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {availableSlots.length === 0 ? (
                                <div className="py-8 text-center text-gray-500 bg-amber-50 rounded-lg">
                                    <p className="font-medium text-amber-800">候補日時が見つかりませんでした</p>
                                    <p className="text-sm mt-1">参加者のカレンダーを確認するか、期間を見直してください。</p>
                                </div>
                            ) : (
                                <>
                                    {/* カウント・全選択ボタン */}
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-500">
                                            <span className="font-medium text-gray-900">{filteredSlots.length}</span> 件表示
                                            <span className="font-medium text-blue-600">{selectedSlots.length}</span> 件選択中
                                        </p>
                                        {filteredSlots.length > 0 && (
                                            <button
                                                onClick={toggleAllFiltered}
                                                className="text-sm text-blue-600 hover:underline font-medium"
                                            >
                                                {allFilteredSelected ? "全解除" : "全選択"}
                                            </button>
                                        )}
                                    </div>

                                    {filteredSlots.length === 0 ? (
                                        <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-lg text-sm">
                                            絞り込み条件に一致する候補がありません
                                        </div>
                                    ) : (
                                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                            {filteredSlots.map((slot, i) => {
                                                const isSelected = selectedSlots.some(
                                                    (s) => s.start === slot.start && s.end === slot.end
                                                );
                                                return (
                                                    <label key={i} className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSlot(slot)}
                                                            className="w-4 h-4 text-blue-600 rounded"
                                                        />
                                                        <span className="text-sm text-gray-900">
                                                            {new Date(slot.start).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
                                                            {" "}
                                                            {new Date(slot.start).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}〜{new Date(slot.end).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50">戻る</button>
                                <button
                                    id="next-step4-btn"
                                    disabled={selectedSlots.length === 0 || loading}
                                    onClick={async () => { const ok = await handleGenerateUrl(); if (ok) setStep(4); }}
                                    className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? "保存中..." : "次へ：URLを発行する"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: URL発行 */}
                    {step === 4 && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold text-gray-900">日程調整URLを発行しました</h2>
                            <p className="text-sm text-gray-500">
                                下記のURLを取引先にメール等でお送りください。相手方がURLにアクセスして候補日時を選択すると、日程が確定します。
                            </p>

                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <label className="block text-xs font-semibold text-blue-700 mb-2">📎 発行されたURL</label>
                                <div className="flex items-stretch gap-2">
                                    <input
                                        id="guest-url-input"
                                        readOnly
                                        value={guestUrl}
                                        className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none cursor-text"
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <button
                                        id="copy-url-btn"
                                        onClick={handleCopyUrl}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${urlCopied
                                            ? "bg-green-500 text-white"
                                            : "bg-blue-600 text-white hover:bg-blue-700"
                                            }`}
                                    >
                                        {urlCopied ? "コピー済 ✓" : "コピー"}
                                    </button>
                                </div>
                            </div>

                            {selectedSlots.length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">📅 提示する候補日時（{selectedSlots.length}件）</h3>
                                    <ul className="space-y-1.5">
                                        {selectedSlots.map((slot, i) => (
                                            <li key={i} className="text-sm text-gray-700">
                                                {new Date(slot.start).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}
                                                {" "}
                                                {new Date(slot.start).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}〜
                                                {new Date(slot.end).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {error && <p className="text-red-600 text-sm">{error}</p>}
                            <button
                                id="back-to-dashboard-btn"
                                onClick={() => router.push("/dashboard")}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
                            >
                                ダッシュボードに戻る
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
