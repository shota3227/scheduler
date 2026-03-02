"use client";

export function CancelButton({ action }: { action: () => void }) {
    return (
        <form action={action}>
            <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
                onClick={(e) => {
                    if (!confirm("キャンセルしますか？")) e.preventDefault();
                }}
            >
                キャンセル
            </button>
        </form>
    );
}
