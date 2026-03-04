import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { signOut } from "@/auth";
import { getStatusLabel, getStatusColor, formatDateTime } from "@/lib/utils";
import { getGuestUrl } from "@/lib/token";
import GuestUrlSection from "./GuestUrlSection";
import CancelButton from "./CancelButton";

export default async function ScheduleDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const { id } = await params;
    const user = session.user as any;
    const isAdmin = user.role === "ADMIN";

    const schedule = await prisma.scheduleRequest.findUnique({
        where: { id },
        include: {
            creator: { select: { id: true, name: true, email: true } },
            participants: { include: { user: { select: { id: true, name: true, email: true } } } },
            timeSlots: { where: { isActive: true }, orderBy: { startTime: "asc" } },
            selection: { include: { slot: true } },
        },
    });

    if (!schedule) notFound();

    const isCreator = schedule.creatorId === user.id;
    const isParticipant = schedule.participants.some((p) => p.userId === user.id);

    if (!isAdmin && !isCreator && !isParticipant) redirect("/dashboard");

    const canManage = isAdmin || isCreator;
    const guestUrl = getGuestUrl(schedule.guestToken);

    const cancelAction = async () => {
        "use server";
        await prisma.scheduleRequest.update({
            where: { id },
            data: { status: "CANCELLED" },
        });
        redirect("/dashboard");
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ナビゲーション */}
            <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
                            ← ダッシュボード
                        </Link>
                        <span className="text-gray-300">|</span>
                        <span className="font-bold text-gray-900">調整詳細</span>
                    </div>
                    <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
                        <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
                            ログアウト
                        </button>
                    </form>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
                {/* タイトル・ステータス */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(schedule.status)}`}>
                                    {getStatusLabel(schedule.status)}
                                </span>
                            </div>
                            <h1 className="text-xl font-bold text-gray-900">{schedule.title}</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                作成者: {schedule.creator.name}　・　作成日: {new Date(schedule.createdAt).toLocaleDateString("ja-JP")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 打ち合わせ情報 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">打ち合わせ情報</h2>
                    <dl className="space-y-3">
                        <div className="flex gap-4">
                            <dt className="text-sm text-gray-500 w-24 shrink-0">時間</dt>
                            <dd className="text-sm text-gray-900">{schedule.duration} 分</dd>
                        </div>
                        {schedule.location && (
                            <div className="flex gap-4">
                                <dt className="text-sm text-gray-500 w-24 shrink-0">場所</dt>
                                <dd className="text-sm text-gray-900">{schedule.location}</dd>
                            </div>
                        )}
                        {schedule.address && (
                            <div className="flex gap-4">
                                <dt className="text-sm text-gray-500 w-24 shrink-0">住所 / URL</dt>
                                <dd className="text-sm text-gray-900 break-all">{schedule.address}</dd>
                            </div>
                        )}
                        <div className="flex gap-4">
                            <dt className="text-sm text-gray-500 w-24 shrink-0">参加者</dt>
                            <dd className="text-sm text-gray-900">
                                {schedule.participants.map((p) => p.user.name).join("、")}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* 候補日時 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">候補日時</h2>
                    {schedule.timeSlots.length === 0 ? (
                        <p className="text-sm text-gray-400">候補日時がありません</p>
                    ) : (
                        <ul className="space-y-2">
                            {schedule.timeSlots.map((slot) => {
                                const isConfirmed = schedule.selection?.slotId === slot.id;
                                return (
                                    <li
                                        key={slot.id}
                                        className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${isConfirmed
                                            ? "bg-green-50 border border-green-200 text-green-800 font-medium"
                                            : "bg-gray-50 text-gray-700"
                                            }`}
                                    >
                                        {isConfirmed && (
                                            <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        {formatDateTime(slot.startTime, slot.endTime)}
                                        {isConfirmed && <span className="ml-auto text-xs text-green-600">確定</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {/* ゲストのメッセージ */}
                    {schedule.selection?.message && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                            <p className="text-xs text-blue-500 font-medium mb-1">ゲストからのメッセージ</p>
                            <p className="text-sm text-blue-900">{schedule.selection.message}</p>
                        </div>
                    )}
                </div>

                {/* ゲスト用URL（PENDING かつ管理権限あり） */}
                {schedule.status === "PENDING" && canManage && (
                    <GuestUrlSection
                        scheduleId={schedule.id}
                        guestUrl={guestUrl}
                        emailSentAt={schedule.emailSentAt ? schedule.emailSentAt.toISOString() : null}
                        expiresAt={schedule.expiresAt ? schedule.expiresAt.toISOString() : null}
                    />
                )}

                {/* アクションボタン */}
                {canManage && (schedule.status === "PENDING" || schedule.status === "CONFIRMED") && (
                    <div className="flex items-center justify-end gap-4">
                        <Link
                            href={`/schedule/${id}/edit`}
                            className="text-sm text-blue-600 hover:underline font-medium"
                        >
                            編集
                        </Link>
                        <CancelButton action={cancelAction} />
                    </div>
                )}
            </main>
        </div>
    );
}
