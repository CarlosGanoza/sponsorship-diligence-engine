"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

export function NavLink({
  href,
  label,
}: {
  href: Route;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition",
        active ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-white hover:text-ink-900",
      )}
      href={href}
    >
      {label}
    </Link>
  );
}
