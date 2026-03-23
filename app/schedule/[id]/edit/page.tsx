"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatSlotDateTime, getJstDateKey, getJstMinutes } from "@/lib/utils";

interface SlotItem {
    id: string;
    start: string;
    end: string;
}

interface NewSlot {
    start: string;
    end: string;
}

interface Member {
    id: string;
    name: string;
    email: string;
}

function toLocalDateStr(d: Date): string {
    return getJstDateKey(d);
}

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 22; h++) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 22) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

function fmtSlot(start: string, end: string) {
    return formatSlotDateTime(start, end);
}

const DURATION_OPTIONS = [
    { label: "15分", value: 15 },
    { label: "30分", value: 30 },
    { label: "45分", value: 45 },
    { label: "1時間", value: 60 },
    { label: "1時間30分", value: 90 },
    { label: "2時間", value: 120 },
    { label: "3時間", value: 180 },
];

export default function ScheduleEditPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [tab, setTab] = useState<"basic" | "participants" | "slots">("basic");
    const [pageLoading, setPageLoading] = useState(true);
    const [pageError, setPageError] = useState("");

    // 基本情報
    const [title, setTitle] = useState("");
    const [duration, setDuration] = useState(60);
    const [location, setLocation] = useState("");
    const [address, setAddress] = useState("");
    const [savingBasic, setSavingBasic] = useState(false);
    const [savedBasic, setSavedBasic] = useState(false);
    const [basicError, setBasicError] = useState("");

    // 参加者
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [savingParticipants, setSavingParticipants] = useState(false);
    const [savedParticipants, setSavedParticipants] = useState(false);
    const [participantsError, setParticipantsError] = useState("");
    const [membersLoading, setMembersLoading] = useState(false);

    // 候補日時
    const [currentSlots, setCurrentSlots] = useState<SlotItem[]>([]);
    const [slotDuration, setSlotDuration] = useState(60);
    const [savingSlots, setSavingSlots] = useState(false);
    const [savedSlots, setSavedSlots] = useState(false);
    const [slotsError, setSlotsError] = useState("");

    // 空き時間ピッカー
    const [showPicker, setShowPicker] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<NewSlot[]>([]);
    const [selectedNewSlots, setSelectedNewSlots] = useState<NewSlot[]>([]);
    const [loadingAvail, setLoadingAvail] = useState(false);

    // フィルタ
    const [filterStartDate, setFilterStartDate] = useState(() => toLocalDateStr(new Date()));
    const [filterEndDate, setFilterEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return toLocalDateStr(d);
    });
    const [filterStartTime, setFilterStartTime] = useState("09:00");
    const [filterEndTime, setFilterEndTime] = useState("18:00");

    // 初期データ取得
    useEffect(() => {
        fetch(`/api/schedules/${id}`)
            .then((r) => r.json())
            .then((data) => {
                setTitle(data.title);
                setDuration(data.duration);
                setSlotDuration(data.duration);
                setLocation(data.location ?? "");
                setAddress(data.address ?? "");
                setCurrentSlots(
                    (data.timeSlots ?? []).map((ts: any) => ({
                        id: ts.id,
                        start: ts.startTime,
                        end: ts.endTime,
                    }))
                );
                setSelectedParticipantIds((data.participants ?? []).map((p: any) => p.userId));
                setPageLoading(false);
            })
            .catch(() => {
                setPageError("データの取得に失敗しました");
                setPageLoading(false);
            });
    }, [id]);

    // メンバー一覧取得
    useEffect(() => {
        setMembersLoading(true);
        fetch("/api/admin/members")
            .then((r) => r.json())
            .then((data) => {
                const members = (Array.isArray(data) ? data : data.members ?? [])
                    .filter((m: any) => m.isActive !== false);
                setAllMembers(members);
            })
            .catch(() => {
                // メンバー取得失敗は非致命的
            })
            .finally(() => setMembersLoading(false));
    }, []);

    // フィルタ適用後の空き時間
    const filteredAvail = availableSlots.filter((slot) => {
        const start = new Date(slot.start);
        const end = new Date(slot.end);
        const slotDateKey = getJstDateKey(start);

        if (filterStartDate) {
            if (slotDateKey < filterStartDate) return false;
        }
        if (filterEndDate) {
            if (slotDateKey > filterEndDate) return false;
        }
        const startMin = getJstMinutes(start);
        if (filterStartTime) {
            const [h, m] = filterStartTime.split(":").map(Number);
            if (startMin < h * 60 + m) return false;
        }
        let endMin = getJstMinutes(end);
        if (endMin === 0 || endMin < startMin) {
            endMin += 24 * 60;
        }
        if (filterEndTime) {
            const [h, m] = filterEndTime.split(":").map(Number);
            if (endMin > h * 60 + m) return false;
        }
        // すでに currentSlots にあるものは除外
        if (currentSlots.some((c) => c.start === slot.start && c.end === slot.end)) return false;
        return true;
    });

    // フィルタ変更時、選択から外れたスロットを除去
    useEffect(() => {
        if (selectedNewSlots.length === 0) return;
        setSelectedNewSlots((prev) =>
            prev.filter((slot) => filteredAvail.some((f) => f.start === slot.start && f.end === slot.end))
        );
    }, [filterStartDate, filterEndDate, filterStartTime, filterEndTime]); // eslint-disable-line react-hooks/exhaustive-deps

    const allFilteredSelected =
        filteredAvail.length > 0 &&
        filteredAvail.every((s) => selectedNewSlots.some((n) => n.start === s.start && n.end === s.end));

    const toggleAllFiltered = () => {
        if (allFilteredSelected) {
            setSelectedNewSlots((prev) =>
                prev.filter((s) => !filteredAvail.some((f) => f.start === s.start && f.end === s.end))
            );
        } else {
            setSelectedNewSlots((prev) => {
                const toAdd = filteredAvail.filter(
                    (f) => !prev.some((s) => s.start === f.start && s.end === f.end)
                );
                return [...prev, ...toAdd];
            });
        }
    };

    const toggleNewSlot = (slot: NewSlot) => {
        setSelectedNewSlots((prev) => {
            const exists = prev.some((s) => s.start === slot.start && s.end === slot.end);
            return exists
                ? prev.filter((s) => s.start !== slot.start || s.end !== slot.end)
                : [...prev, slot];
        });
    };

    const toggleParticipant = (memberId: string) => {
        setSelectedParticipantIds((prev) =>
            prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
        );
    };

    // 基本情報を保存
    const saveBasic = async () => {
        if (!title.trim()) { setBasicError("件名は必須です"); return; }
        setSavingBasic(true);
        setSavedBasic(false);
        setBasicError("");
        try {
            const res = await fetch(`/api/schedules/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: title.trim(), duration, location, address }),
            });
            if (!res.ok) throw new Error("保存に失敗しました");
            setSavedBasic(true);
            setTimeout(() => setSavedBasic(false), 2500);
        } catch (e: any) {
            setBasicError(e.message);
        } finally {
            setSavingBasic(false);
        }
    };

    // 参加者を保存
    const saveParticipants = async () => {
        if (selectedParticipantIds.length === 0) {
            setParticipantsError("参加者を1名以上選択してください");
            return;
        }
        setSavingParticipants(true);
        setSavedParticipants(false);
        setParticipantsError("");
        try {
            const res = await fetch(`/api/schedules/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ participantIds: selectedParticipantIds }),
            });
            if (!res.ok) throw new Error("保存に失敗しました");
            setSavedParticipants(true);
            setTimeout(() => setSavedParticipants(false), 2500);
        } catch (e: any) {
            setParticipantsError(e.message);
        } finally {
            setSavingParticipants(false);
        }
    };

    // 空き時間を取得（ピッカーを開く）
    const fetchAvailability = async () => {
        setLoadingAvail(true);
        setSlotsError("");
        try {
            const res = await fetch("/api/availability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ participantIds: selectedParticipantIds, duration: slotDuration }),
            });
            if (!res.ok) throw new Error("空き時間の取得に失敗しました");
            const { slots } = await res.json();
            setAvailableSlots(slots ?? []);
            setSelectedNewSlots([]);
            setShowPicker(true);
        } catch (e: any) {
            setSlotsError(e.message);
        } finally {
            setLoadingAvail(false);
        }
    };

    // 候補日時を保存（現在のスロット＋新規スロット）
    const saveSlots = async () => {
        setSavingSlots(true);
        setSavedSlots(false);
        setSlotsError("");
        try {
            const allSlots = [
                ...currentSlots.map((s) => ({ start: s.start, end: s.end })),
                ...selectedNewSlots,
            ];
            const res = await fetch(`/api/schedules/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timeSlots: allSlots }),
            });
            if (!res.ok) throw new Error("候補日時の保存に失敗しました");
            const updated = await res.json();
            setCurrentSlots(
                (updated.timeSlots ?? []).map((ts: any) => ({
                    id: ts.id,
                    start: ts.startTime,
                    end: ts.endTime,
                }))
            );
            setSelectedNewSlots([]);
            setShowPicker(false);
            setSavedSlots(true);
            setTimeout(() => setSavedSlots(false), 2500);
        } catch (e: any) {
            setSlotsError(e.message);
        } finally {
            setSavingSlots(false);
        }
    };

    if (pageLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">読み込み中...</p>
                </div>
            </div>
        );
    }

    if (pageError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-red-600">{pageError}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ナビ */}
            <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <Link href={`/schedule/${id}`} className="text-sm text-blue-600 hover:underline">
                        ← 詳細に戻る
                    </Link>
                    <span className="text-gray-300">|</span>
                    <span className="font-bold text-gray-900">調整を編集</span>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-6 py-8">
                {/* タブ */}
                <div className="flex border-b border-gray-200 mb-6">
                    {(["basic", "participants", "slots"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            {t === "basic" ? "基本情報" : t === "participants" ? "参加者" : "候補日時"}
                        </button>
                    ))}
                </div>

                {/* ── 基本情報タブ ── */}
                {tab === "basic" && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                        <h2 className="font-bold text-gray-900">基本情報の編集</h2>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                打ち合わせ件名 <span className="text-red-500">*</span>
                            </label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">打ち合わせ時間</label>
                            <select
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {DURATION_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">場所（会議室名）</label>
                            <input
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="任意"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">住所 / オンラインURL</label>
                            <input
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="任意"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {basicError && <p className="text-sm text-red-600">{basicError}</p>}

                        <button
                            onClick={saveBasic}
                            disabled={savingBasic}
                            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {savingBasic ? "保存中..." : savedBasic ? "✓ 保存しました" : "基本情報を保存"}
                        </button>
                    </div>
                )}

                {/* ── 参加者タブ ── */}
                {tab === "participants" && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-gray-900">社内参加者の編集</h2>
                            <span className="text-sm text-gray-500">
                                {selectedParticipantIds.length}名選択中
                            </span>
                        </div>

                        {membersLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                            </div>
                        ) : allMembers.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">
                                メンバーが見つかりません
                            </p>
                        ) : (
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="名前やメールアドレスで検索..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                    {allMembers
                                        .filter((m) =>
                                            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            m.email.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .sort((a, b) => a.name.localeCompare(b.name, "ja"))
                                        .map((member) => {
                                            const isSelected = selectedParticipantIds.includes(member.id);
                                            return (
                                                <label
                                                    key={member.id}
                                                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleParticipant(member.id)}
                                                        className="w-4 h-4 text-blue-600 rounded"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                                                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                                                    </div>
                                                    {isSelected && (
                                                        <span className="text-xs text-blue-600 font-medium shrink-0">参加</span>
                                                    )}
                                                </label>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {participantsError && <p className="text-sm text-red-600">{participantsError}</p>}

                        <button
                            onClick={saveParticipants}
                            disabled={savingParticipants || membersLoading}
                            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {savingParticipants
                                ? "保存中..."
                                : savedParticipants
                                    ? "✓ 保存しました"
                                    : `参加者を保存（${selectedParticipantIds.length}名）`}
                        </button>
                    </div>
                )}

                {/* ── 候補日時タブ ── */}
                {tab === "slots" && (
                    <div className="space-y-4">
                        {/* 現在の候補 */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h2 className="font-bold text-gray-900 mb-4">
                                現在の候補日時
                                <span className="ml-2 text-sm font-normal text-gray-500">（{currentSlots.length}件）</span>
                            </h2>

                            {currentSlots.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">候補日時がありません</p>
                            ) : (
                                <ul className="space-y-2">
                                    {currentSlots.map((slot) => (
                                        <li
                                            key={slot.id}
                                            className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5"
                                        >
                                            <span className="text-sm text-gray-800">{fmtSlot(slot.start, slot.end)}</span>
                                            <button
                                                onClick={() =>
                                                    setCurrentSlots((prev) => prev.filter((s) => s.id !== slot.id))
                                                }
                                                className="text-gray-400 hover:text-red-500 transition-colors ml-3 shrink-0"
                                                title="削除"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* 空き時間から追加 */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-bold text-gray-900">空き時間から追加</h2>
                                <button
                                    onClick={showPicker ? () => { setShowPicker(false); setSelectedNewSlots([]); } : fetchAvailability}
                                    disabled={loadingAvail || selectedParticipantIds.length === 0}
                                    className="text-sm text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loadingAvail ? "取得中..." : showPicker ? "閉じる" : "空き時間を取得"}
                                </button>
                            </div>

                            {selectedParticipantIds.length === 0 && (
                                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-3">
                                    「参加者」タブで参加者を選択してから空き時間を取得してください
                                </p>
                            )}

                            {showPicker && (
                                <>
                                    {/* フィルタ */}
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">絞り込み</p>
                                        <div className="flex flex-wrap gap-x-6 gap-y-3">
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-gray-500 whitespace-nowrap">期間</label>
                                                <input
                                                    type="date"
                                                    value={filterStartDate}
                                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                                                />
                                                <span className="text-gray-400 text-sm">〜</span>
                                                <input
                                                    type="date"
                                                    value={filterEndDate}
                                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-xs text-gray-500 whitespace-nowrap">時間帯</label>
                                                <select
                                                    value={filterStartTime}
                                                    onChange={(e) => setFilterStartTime(e.target.value)}
                                                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                                                >
                                                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <span className="text-gray-400 text-sm">〜</span>
                                                <select
                                                    value={filterEndTime}
                                                    onChange={(e) => setFilterEndTime(e.target.value)}
                                                    className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                                                >
                                                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* スロット一覧 */}
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-gray-500">
                                            <span className="font-medium text-gray-900">{filteredAvail.length}</span> 件表示
                                            <span className="font-medium text-blue-600">{selectedNewSlots.length}</span> 件追加選択中
                                        </p>
                                        {filteredAvail.length > 0 && (
                                            <button onClick={toggleAllFiltered} className="text-sm text-blue-600 hover:underline font-medium">
                                                {allFilteredSelected ? "全解除" : "全選択"}
                                            </button>
                                        )}
                                    </div>

                                    {filteredAvail.length === 0 ? (
                                        <div className="py-6 text-center text-gray-400 bg-gray-50 rounded-lg text-sm">
                                            {availableSlots.length === 0
                                                ? "空き時間が見つかりませんでした"
                                                : "絞り込み条件に一致する候補がありません"}
                                        </div>
                                    ) : (
                                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto mb-4">
                                            {filteredAvail.map((slot, i) => {
                                                const isSelected = selectedNewSlots.some(
                                                    (s) => s.start === slot.start && s.end === slot.end
                                                );
                                                return (
                                                    <label
                                                        key={i}
                                                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleNewSlot(slot)}
                                                            className="w-4 h-4 text-blue-600 rounded"
                                                        />
                                                        <span className="text-sm text-gray-900">{fmtSlot(slot.start, slot.end)}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 保存ボタン */}
                        {slotsError && <p className="text-sm text-red-600 px-1">{slotsError}</p>}
                        <button
                            onClick={saveSlots}
                            disabled={savingSlots || currentSlots.length + selectedNewSlots.length === 0}
                            className="w-full bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {savingSlots
                                ? "保存中..."
                                : savedSlots
                                    ? "✓ 保存しました"
                                    : `候補日時を保存（${currentSlots.length + selectedNewSlots.length}件）`}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
