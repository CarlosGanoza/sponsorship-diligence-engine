"use client";

import { ReviewStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ReviewBadge } from "@/components/dashboard/review-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ReviewItem = {
  id: string;
  entityType: "claim" | "recommendation";
  title: string;
  detail: string;
  status: ReviewStatus;
  note: string | null;
  meta: string;
};

export function BulkReviewWorkbench({
  entityType,
  title,
  description,
  items,
}: {
  entityType: "claim" | "recommendation";
  title: string;
  description: string;
  items: ReviewItem[];
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [pendingStatus, setPendingStatus] = useState<ReviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allSelected = useMemo(() => items.length > 0 && selectedIds.length === items.length, [items.length, selectedIds.length]);

  const toggle = (itemId: string) => {
    setSelectedIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : items.map((item) => item.id));
  };

  const run = async (status: ReviewStatus) => {
    if (selectedIds.length === 0) {
      setError("Select at least one item first.");
      return;
    }

    setPendingStatus(status);
    setError(null);

    try {
      const response = await fetch("/api/reviews/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityType,
          itemIds: selectedIds,
          status,
          note,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
          }
        | null;

      setPendingStatus(null);

      if (!response.ok || !result?.success) {
        setError(result?.error ?? "Could not apply bulk review.");
        return;
      }

      setSelectedIds([]);
      setNote("");
      router.refresh();
    } catch {
      setPendingStatus(null);
      setError("Could not apply bulk review.");
    }
  };

  return (
    <div aria-label={title} className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" role="region">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-4">
        <div>
          <p className="text-sm font-medium text-ink-900">{title}</p>
          <p className="mt-1 text-sm text-ink-500">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">{items.length} pending or flagged</Badge>
          {items.length > 0 ? (
            <Button onClick={toggleAll} size="sm" type="button" variant="ghost">
              {allSelected ? "Clear selection" : "Select all"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <label
            className="flex cursor-pointer gap-3 rounded-[1.25rem] border border-ink-100 bg-ink-50 px-4 py-4"
            key={item.id}
          >
            <input
              checked={selectedIds.includes(item.id)}
              className="mt-1 h-4 w-4 rounded border-ink-300 text-sage-700"
              onChange={() => toggle(item.id)}
              type="checkbox"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{item.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">{item.meta}</p>
                </div>
                <ReviewBadge status={item.status} />
              </div>
              <p className="mt-3 text-sm leading-7 text-ink-600">{item.detail}</p>
              {item.note ? <p className="mt-3 text-sm leading-7 text-ink-500">{item.note}</p> : null}
            </div>
          </label>
        ))}
        {items.length === 0 ? <p className="text-sm leading-7 text-ink-500">No pending review items in this section.</p> : null}
      </div>

      {items.length > 0 ? (
        <>
          <div className="mt-4">
            <Label className="text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`${entityType}-bulk-note`}>
              Shared note
            </Label>
            <Textarea
              className="mt-2 min-h-24 bg-ink-50"
              id={`${entityType}-bulk-note`}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note applied to all selected items."
              value={note}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={pendingStatus !== null} onClick={() => run(ReviewStatus.APPROVED)} size="sm" type="button" variant="secondary">
              {pendingStatus === ReviewStatus.APPROVED ? "Saving..." : "Approve selected"}
            </Button>
            <Button disabled={pendingStatus !== null} onClick={() => run(ReviewStatus.FLAGGED)} size="sm" type="button" variant="subtle">
              {pendingStatus === ReviewStatus.FLAGGED ? "Saving..." : "Flag selected"}
            </Button>
            <Button disabled={pendingStatus !== null} onClick={() => run(ReviewStatus.PENDING)} size="sm" type="button" variant="ghost">
              {pendingStatus === ReviewStatus.PENDING ? "Saving..." : "Mark pending"}
            </Button>
          </div>
        </>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
