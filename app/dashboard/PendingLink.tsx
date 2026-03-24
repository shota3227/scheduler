"use client";

import Link, { LinkProps } from "next/link";
import { MouseEvent, ReactNode, useEffect, useRef, useState } from "react";

type Props = LinkProps & {
    children: ReactNode;
    className?: string;
    id?: string;
    target?: string;
    rel?: string;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

const CLEAR_CURSOR_DELAY_MS = 1200;

export default function PendingLink({
    children,
    className,
    onClick,
    target,
    rel,
    ...props
}: Props) {
    const [isPending, setIsPending] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            document.body.style.cursor = "";
        };
    }, []);

    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            target === "_blank"
        ) {
            return;
        }

        setIsPending(true);
        document.body.style.cursor = "progress";
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setIsPending(false);
            document.body.style.cursor = "";
            timerRef.current = null;
        }, CLEAR_CURSOR_DELAY_MS);
    };

    return (
        <Link
            {...props}
            target={target}
            rel={rel}
            onClick={handleClick}
            aria-busy={isPending || undefined}
            className={[
                "cursor-pointer transition-all active:scale-[0.99]",
                isPending ? "opacity-80 cursor-progress" : "",
                className ?? "",
            ].join(" ").trim()}
        >
            {children}
        </Link>
    );
}
