"use client";

interface Props {
    action: () => Promise<void>;
    label?: string;
    size?: "sm" | "xs";
}

export default function CancelButton({ action, label = "調整をキャンセルする", size = "sm" }: Props) {
    const textClass = size === "xs" ? "text-xs" : "text-sm";
    return (
        <form action={action}>
            <button
                type="submit"
                className={`${textClass} text-red-500 hover:underline`}
                onClick={(e) => {
                    if (!confirm("この調整をキャンセルしますか？")) e.preventDefault();
                }}
            >
                {label}
            </button>
        </form>
    );
}
