"use client";

interface Props {
    action: () => Promise<void>;
}

export default function ResolveExternallyButton({ action }: Props) {
    return (
        <form action={action}>
            <button
                type="submit"
                className="text-xs text-slate-600 hover:underline cursor-pointer"
                onClick={(e) => {
                    if (!confirm("この案件を「別途対応済み」にしますか？")) e.preventDefault();
                }}
            >
                別途対応済みにする
            </button>
        </form>
    );
}
