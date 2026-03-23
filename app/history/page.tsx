import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getStatusLabel, getStatusColor, formatDateTime } from "@/lib/utils";
import { signOut } from "@/auth";
import { CancelButton } from "./CancelButton";
import { refreshExpiredScheduleStatuses } from "@/lib/schedule-status";

export default async function HistoryPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    const user = session.user as any;
    const isAdmin = user.role === "ADMIN";

    await refreshExpiredScheduleStatuses();

    const schedules = await prisma.scheduleRequest.findMany({
        where: isAdmin
            ? { timeSlots: { some: { isActive: true } } }
            : { creatorId: user.id, timeSlots: { some: { isActive: true } } },
        include: {
            creator: { select: { name: true, email: true } },
            participants: { include: { user: { select: { name: true } } } },
            timeSlots: { where: { isActive: true }, orderBy: { startTime: "asc" } },
            selection: { include: { slot: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    const activeStatuses = new Set(["PENDING", "RESCHEDULE_REQUESTED"]);

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-sm text-blue-600">← ダッシュボード</Link>
                        <span className="font-bold text-gray-900">調整履歴</span>
                    </div>
                    <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
                        <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer">ログアウト</button>
                    </form>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-bold text-gray-900">
                        {isAdmin ? "全メンバーの調整履歴" : "自分の調整履歴"}
                    </h1>
                    <Link href="/schedule/new" className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
                        + 新規調整
                    </Link>
                </div>

                {schedules.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                        <p className="text-gray-500">調整履歴がありません</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-5 py-3 text-gray-600 font-medium">件名</th>
                                    {isAdmin && <th className="text-left px-4 py-3 text-gray-600 font-medium">作成者</th>}
                                    <th className="text-left px-4 py-3 text-gray-600 font-medium">参加者</th>
                                    <th className="text-left px-4 py-3 text-gray-600 font-medium">ステータス</th>
                                    <th className="text-left px-4 py-3 text-gray-600 font-medium">確定日時</th>
                                    <th className="text-left px-4 py-3 text-gray-600 font-medium">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {schedules.map((s) => (
                                    <tr key={s.id} className="hover:bg-gray-50">
                                        <td className="px-5 py-4">
                                            <Link href={`/schedule/${s.id}`} className="font-medium text-blue-600 hover:underline">
                                                {s.title}
                                            </Link>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                作成: {new Date(s.createdAt).toLocaleDateString("ja-JP")}
                                            </p>
                                        </td>
                                        {isAdmin && (
                                            <td className="px-4 py-4 text-gray-700">{s.creator.name}</td>
                                        )}
                                        <td className="px-4 py-4 text-gray-700">
                                            {s.participants.map((p) => p.user.name).join("、")}
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(s.status)}`}>
                                                {getStatusLabel(s.status)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-gray-700">
                                            {s.selection?.slot
                                                ? formatDateTime(s.selection.slot.startTime, s.selection.slot.endTime)
                                                : "—"}
                                        </td>
                                        <td className="px-4 py-4">
                                            {activeStatuses.has(s.status) && (
                                                <CancelButton action={async () => {
                                                    "use server";
                                                    await prisma.scheduleRequest.update({
                                                        where: { id: s.id },
                                                        data: { status: "CANCELLED" },
                                                    });
                                                    redirect("/history");
                                                }} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
