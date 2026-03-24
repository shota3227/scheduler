"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";

interface Props {
    action: () => Promise<void>;
    label?: string;
    size?: "sm" | "xs";
}

function SubmitButton({ label, size }: { label: string; size: "sm" | "xs" }) {
    const { pending } = useFormStatus();
    const textClass = size === "xs" ? "text-xs" : "text-sm";

    useEffect(() => {
        if (!pending) return;
        document.body.style.cursor = "progress";
        return () => {
            document.body.style.cursor = "";
        };
    }, [pending]);

    return (
        <button
            type="submit"
            disabled={pending}
            aria-busy={pending || undefined}
            className={[
                textClass,
                "text-red-500 hover:underline transition-all active:scale-[0.99]",
                pending ? "cursor-progress opacity-70" : "cursor-pointer",
            ].join(" ")}
            onClick={(e) => {
                if (pending) {
                    e.preventDefault();
                    return;
                }
                if (!confirm("この調整をキャンセルしますか？")) e.preventDefault();
            }}
        >
            {pending ? "処理中..." : label}
        </button>
    );
}

export default function CancelButton({ action, label = "調整をキャンセルする", size = "sm" }: Props) {
    return (
        <form action={action}>
            <SubmitButton label={label} size={size} />
        </form>
    );
}
