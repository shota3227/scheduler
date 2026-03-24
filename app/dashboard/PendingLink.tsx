"use client";

import Link, { LinkProps } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { MouseEvent, ReactNode, useEffect, useRef } from "react";

type Props = LinkProps & {
    children: ReactNode;
    className?: string;
    id?: string;
    target?: string;
    rel?: string;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

const ROUTE_PENDING_CLASS = "route-pending";

function hrefToString(href: LinkProps["href"]): string {
    if (typeof href === "string") return href;

    const path = href.pathname ?? "";
    const hash = href.hash ? `#${href.hash}` : "";
    if (!href.query) return `${path}${hash}`;

    const params = new URLSearchParams();
    Object.entries(href.query).forEach(([key, value]) => {
        if (value == null) return;
        if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, String(v)));
            return;
        }
        params.set(key, String(value));
    });
    const query = params.toString();
    return `${path}${query ? `?${query}` : ""}${hash}`;
}

export default function PendingLink({
    children,
    className,
    onClick,
    target,
    rel,
    href,
    ...props
}: Props) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isNavigatingRef = useRef(false);

    useEffect(() => {
        if (isNavigatingRef.current) {
            isNavigatingRef.current = false;
            document.documentElement.classList.remove(ROUTE_PENDING_CLASS);
            document.body.style.cursor = "";
        }
    }, [pathname, searchParams]);

    useEffect(() => {
        return () => {
            document.documentElement.classList.remove(ROUTE_PENDING_CLASS);
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

        const nextUrl = new URL(hrefToString(href), window.location.href);
        const currentUrl = new URL(window.location.href);
        const isSameUrl =
            nextUrl.pathname === currentUrl.pathname &&
            nextUrl.search === currentUrl.search &&
            nextUrl.hash === currentUrl.hash;
        if (isSameUrl) return;

        isNavigatingRef.current = true;
        document.documentElement.classList.add(ROUTE_PENDING_CLASS);
        document.body.style.cursor = "progress";
    };

    return (
        <Link
            {...props}
            href={href}
            target={target}
            rel={rel}
            onClick={handleClick}
            className={[
                "cursor-pointer transition-all active:scale-[0.99]",
                className ?? "",
            ].join(" ").trim()}
        >
            {children}
        </Link>
    );
}
