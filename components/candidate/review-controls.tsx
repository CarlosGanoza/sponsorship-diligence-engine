"use client";

import { ReviewStatus } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ReviewControlsProps = {
  entityType: "claim" | "recommendation";
  itemId: string;
  initialNote?: string | null;
  initialStatus: ReviewStatus;
};

export function ReviewControls({
  entityType,
  itemId,
  initialNote,
  initialStatus,
}: ReviewControlsProps) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [pendingStatus, setPendingStatus] = useState<ReviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (status: ReviewStatus) => {
    setError(null);
    setPendingStatus(status);

    void (async () => {
      const pathname =
        entityType === "claim"
          ? `/api/claims/${itemId}/review`
          : `/api/recommendations/${itemId}/review`;
      const response = await fetch(pathname, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          note,
        }),
      }).catch(() => null);

      setPendingStatus(null);

      if (!response?.ok) {
        setError("Review update failed.");
        return;
      }

      router.refresh();
    })();
  };

  return (
    <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <Label className="text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`${entityType}-${itemId}-note`}>
        Operator note
      </Label>
      <Textarea
        className="mt-3 min-h-24 bg-ink-50"
        id={`${entityType}-${itemId}-note`}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional review note on what was approved, what should be strengthened, or why outreach should wait."
        value={note}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={pendingStatus !== null}
          onClick={() => run(ReviewStatus.APPROVED)}
          size="sm"
          variant={initialStatus === ReviewStatus.APPROVED ? "primary" : "secondary"}
        >
          {pendingStatus === ReviewStatus.APPROVED ? "Saving..." : "Approve"}
        </Button>
        <Button
          disabled={pendingStatus !== null}
          onClick={() => run(ReviewStatus.FLAGGED)}
          size="sm"
          variant={initialStatus === ReviewStatus.FLAGGED ? "primary" : "subtle"}
        >
          {pendingStatus === ReviewStatus.FLAGGED ? "Saving..." : "Flag"}
        </Button>
        <Button
          disabled={pendingStatus !== null}
          onClick={() => run(ReviewStatus.PENDING)}
          size="sm"
          variant={initialStatus === ReviewStatus.PENDING ? "primary" : "ghost"}
        >
          {pendingStatus === ReviewStatus.PENDING ? "Saving..." : "Mark pending"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
