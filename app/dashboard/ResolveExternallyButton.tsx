"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";

interface Props {
    action: () => Promise<void>;
}

function SubmitButton() {
    const { pending } = useFormStatus();

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
                "text-xs text-slate-600 hover:underline transition-all active:scale-[0.99]",
                pending ? "cursor-progress opacity-70" : "cursor-pointer",
            ].join(" ")}
            onClick={(e) => {
                if (pending) {
                    e.preventDefault();
                    return;
                }
                if (!confirm("この案件を「別途対応済み」にしますか？")) e.preventDefault();
            }}
        >
            {pending ? "処理中..." : "別途対応済みにする"}
        </button>
    );
}

export default function ResolveExternallyButton({ action }: Props) {
    return (
        <form action={action}>
            <SubmitButton />
        </form>
    );
}
