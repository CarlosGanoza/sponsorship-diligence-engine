"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type CommandItem = {
  id: string;
  kind: string;
  label: string;
  description: string;
  meta: string;
  href: string;
};

const GROUP_ORDER = ["Shortcut", "Candidate", "Sponsor", "Brief", "Pipeline", "Task", "Alert"] as const;

export function CommandPalette({
  items,
}: {
  items: CommandItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, [pathname]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return items.slice(0, 10);
    }

    return items
      .filter((item) =>
        `${item.kind} ${item.label} ${item.description} ${item.meta}`.toLowerCase().includes(normalized),
      )
      .slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [open, query]);

  const groupedItems = useMemo(() => {
    const grouped = new Map<string, CommandItem[]>();

    for (const item of filteredItems) {
      const currentGroup = grouped.get(item.kind) ?? [];
      currentGroup.push(item);
      grouped.set(item.kind, currentGroup);
    }

    return GROUP_ORDER.filter((group) => grouped.has(group)).map((group) => ({
      kind: group,
      items: grouped.get(group) ?? [],
    }));
  }, [filteredItems]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (filteredItems.length === 0) {
            return 0;
          }

          return current >= filteredItems.length - 1 ? 0 : current + 1;
        });
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => {
          if (filteredItems.length === 0) {
            return 0;
          }

          return current <= 0 ? filteredItems.length - 1 : current - 1;
        });
      }

      if (event.key === "Enter" && filteredItems[activeIndex]) {
        event.preventDefault();
        const item = filteredItems[activeIndex];
        setOpen(false);
        setQuery("");
        router.push(item.href as Route);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, filteredItems, open, router]);

  return (
    <>
      <Button className="min-w-[220px] justify-between" onClick={() => setOpen(true)} type="button" variant="secondary">
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          Search workspace
        </span>
        <span className="rounded-full border border-ink-200 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-ink-500">
          Cmd K
        </span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[60] bg-ink-900/30 px-4 py-10 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="mx-auto max-w-3xl rounded-[2rem] border border-ink-100 bg-white shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-ink-100 px-5 py-4">
              <input
                autoFocus
                className="h-12 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Shortcuts, candidates, sponsors, tasks, briefs, pipeline"
                value={query}
              />
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">
                Jump across the workspace with shortcuts, recent records, and live workflow items.
              </p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
              {filteredItems.length > 0 ? (
                <div className="space-y-5">
                  {groupedItems.map((group) => (
                    <div className="space-y-2" key={group.kind}>
                      <p className="px-2 text-[11px] uppercase tracking-[0.18em] text-ink-400">{group.kind}</p>
                      {group.items.map((item) => {
                        const itemIndex = filteredItems.findIndex((candidate) => candidate.id === item.id);
                        const active = itemIndex === activeIndex;

                        return (
                          <Link
                            className={`block rounded-[1.5rem] border px-4 py-4 transition ${
                              active
                                ? "border-sage-200 bg-sage-50"
                                : "border-transparent hover:border-ink-100 hover:bg-ink-50"
                            }`}
                            href={item.href as Route}
                            key={item.id}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-ink-500">
                                  {item.kind}
                                </span>
                                <p className="text-sm font-medium text-ink-900">{item.label}</p>
                              </div>
                              <span className="text-xs uppercase tracking-[0.18em] text-ink-400">{item.meta}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-ink-500">{item.description}</p>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-sm text-ink-500">
                  No matching candidate, sponsor, brief, task, alert, or pipeline row was found.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
