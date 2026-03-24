import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStatusLabel, getStatusColor } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { signOut } from "@/auth";
import CancelButton from "@/app/schedule/[id]/CancelButton";
import ResolveExternallyButton from "@/app/dashboard/ResolveExternallyButton";
import { formatGuestUrlExpiry } from "@/lib/expiry";
import PendingLink from "@/app/dashboard/PendingLink";
import { Prisma, ScheduleStatus } from "@prisma/client";

export default async function DashboardPage(
    props: { searchParams: Promise<{ filter?: string }> }
) {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const user = session.user as {
        id: string;
        role?: string | null;
        name?: string | null;
        email?: string | null;
    };
    const isAdmin = user.role === "ADMIN";

    const searchParams = await props.searchParams;
    const rawFilter = searchParams?.filter || "all";
    const filter = rawFilter === "pending" || rawFilter === "expired" ? rawFilter : "all";

    const now = new Date();
    const activeStatuses: ScheduleStatus[] = [ScheduleStatus.PENDING, ScheduleStatus.RESCHEDULE_REQUESTED];
    const baseWhere: Prisma.ScheduleRequestWhereInput = isAdmin
        ? { timeSlots: { some: { isActive: true } } }
        : { creatorId: user.id, timeSlots: { some: { isActive: true } } };

    const schedules = await prisma.scheduleRequest.findMany({
        where: {
            ...baseWhere,
            status: { not: ScheduleStatus.RESOLVED_EXTERNALLY },
        },
        select: {
            id: true,
            title: true,
            status: true,
            creatorId: true,
            expiresAt: true,
            creator: { select: { name: true } },
            participants: { select: { user: { select: { name: true } } } },
            selection: {
                select: {
                    slot: {
                        select: {
                            startTime: true,
                            endTime: true,
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
    });

    const displaySchedules = schedules.map((schedule) => {
        const isExpired = activeStatuses.includes(schedule.status) && schedule.expiresAt < now;
        return {
            ...schedule,
            displayStatus: isExpired ? ScheduleStatus.EXPIRED : schedule.status,
        };
    });
    const isActiveStatus = (status: ScheduleStatus) => activeStatuses.includes(status);
    const pendingCount = displaySchedules.filter((s) => isActiveStatus(s.displayStatus)).length;
    const confirmedCount = displaySchedules.filter((s) => s.displayStatus === ScheduleStatus.CONFIRMED).length;
    const totalCount = displaySchedules.length;
    const filteredSchedules =
        filter === "pending"
            ? displaySchedules.filter((s) => isActiveStatus(s.displayStatus))
            : filter === "expired"
                ? displaySchedules.filter((s) => s.displayStatus === ScheduleStatus.EXPIRED)
                : displaySchedules;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ナビゲーション */}
            <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span className="font-bold text-gray-900">日程調整システム</span>
                        <span className="text-sm text-gray-500 border-l border-gray-300 pl-3 ml-1">{user.name || user.email}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <PendingLink href="/dashboard" className="text-sm text-blue-600 font-medium">ダッシュボード</PendingLink>
                        <PendingLink href="/history" className="text-sm text-gray-600 hover:text-gray-900">履歴</PendingLink>
                        {isAdmin && <PendingLink href="/admin" className="text-sm text-gray-600 hover:text-gray-900">管理者設定</PendingLink>}
                        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
                            <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">ログアウト</button>
                        </form>
                    </div>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* サマリーカード */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <p className="text-sm text-gray-500 mb-1">調整中</p>
                        <p className="text-3xl font-bold text-blue-600">{pendingCount}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <p className="text-sm text-gray-500 mb-1">確定済み</p>
                        <p className="text-3xl font-bold text-green-600">{confirmedCount}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <p className="text-sm text-gray-500 mb-1">合計</p>
                        <p className="text-3xl font-bold text-gray-700">{totalCount}</p>
                    </div>
                </div>

                {/* 新規作成ボタンと絞り込み */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-gray-900">最近の調整</h2>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <PendingLink
                                href="/dashboard"
                                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === "all" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                すべて
                            </PendingLink>
                            <PendingLink
                                href="/dashboard?filter=pending"
                                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === "pending" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                調整中のみ
                            </PendingLink>
                            <PendingLink
                                href="/dashboard?filter=expired"
                                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === "expired" ? "bg-white shadow-sm font-medium text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                期限切れのみ
                            </PendingLink>
                        </div>
                    </div>
                    <PendingLink
                        href="/schedule/new"
                        id="create-schedule-btn"
                        className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        新規日程調整
                    </PendingLink>
                </div>

                {/* 調整一覧 */}
                {filteredSchedules.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                        <p className="text-gray-500">条件に一致する日程調整がありません</p>
                        {filter === "pending" || filter === "expired" ? (
                            <PendingLink href="/dashboard" className="mt-3 inline-block text-blue-600 text-sm hover:underline">
                                すべての調整を表示する →
                            </PendingLink>
                        ) : (
                            <PendingLink href="/schedule/new" className="mt-3 inline-block text-blue-600 text-sm hover:underline">
                                最初の日程調整を作成する →
                            </PendingLink>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredSchedules.map((schedule) => {
                            const status = schedule.displayStatus;
                            const canManage = isAdmin || schedule.creatorId === user.id;
                            const cancelAction = async () => {
                                "use server";
                                await prisma.scheduleRequest.update({
                                    where: { id: schedule.id },
                                    data: { status: ScheduleStatus.CANCELLED },
                                });
                                redirect("/dashboard");
                            };
                            const resolveExternallyAction = async () => {
                                "use server";
                                await prisma.scheduleRequest.update({
                                    where: { id: schedule.id },
                                    data: { status: ScheduleStatus.RESOLVED_EXTERNALLY },
                                });
                                redirect(filter === "expired" ? "/dashboard?filter=expired" : "/dashboard");
                            };
                            return (
                                <div
                                    key={schedule.id}
                                    className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all overflow-hidden"
                                >
                                    {/* クリックで詳細へ */}
                                    <PendingLink href={`/schedule/${schedule.id}`} className="block p-5">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(status)}`}>
                                                        {getStatusLabel(status)}
                                                    </span>
                                                    <h3 className="font-medium text-gray-900">{schedule.title}</h3>
                                                </div>
                                                <p className="text-sm text-gray-500">
                                                    作成者: {schedule.creator.name} ・ 参加者: {schedule.participants.map((p) => p.user.name).join("、")}
                                                </p>
                                                {schedule.selection && (
                                                    <p className="text-sm text-green-600 mt-1">
                                                        ✓ 確定: {formatDateTime(schedule.selection.slot?.startTime ?? "", schedule.selection.slot?.endTime ?? "")}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-400">有効期限</p>
                                                <p className="text-xs text-gray-600">
                                                    {formatGuestUrlExpiry(schedule.expiresAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </PendingLink>

                                    {/* アクションバー */}
                                    {canManage && (
                                        <div className="border-t border-gray-100 px-5 py-2 flex items-center justify-end gap-4 bg-gray-50">
                                            {isActiveStatus(status) && (
                                                <PendingLink
                                                    href={`/schedule/${schedule.id}/edit`}
                                                    className="text-xs text-blue-600 hover:underline font-medium"
                                                >
                                                    編集
                                                </PendingLink>
                                            )}
                                            {isActiveStatus(status) && (
                                                <CancelButton action={cancelAction} />
                                            )}
                                            {status === ScheduleStatus.EXPIRED && (
                                                <ResolveExternallyButton action={resolveExternallyAction} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mt-4 text-right">
                    <PendingLink href="/history" className="text-sm text-blue-600 hover:underline">すべての履歴を見る →</PendingLink>
                </div>
            </main>
        </div>
    );
}
