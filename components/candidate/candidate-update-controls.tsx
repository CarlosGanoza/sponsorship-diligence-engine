"use client";

import { CandidateUpdateStatus } from "@prisma/client";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { incorporateCandidateUpdateAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CandidateUpdateControls({
  updateId,
  initialStatus,
  initialNote,
}: {
  updateId: string;
  initialStatus: CandidateUpdateStatus;
  initialNote?: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [pendingStatus, setPendingStatus] = useState<CandidateUpdateStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (status: CandidateUpdateStatus) => {
    setPendingStatus(status);
    setError(null);

    startTransition(async () => {
      const result = await incorporateCandidateUpdateAction(updateId, {
        status,
        incorporationNote: note,
      });

      setPendingStatus(null);

      if (!result.success) {
        setError(result.error ?? "Could not update candidate update status.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <Label className="text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`candidate-update-note-${updateId}`}>
        Incorporation note
      </Label>
      <Textarea
        className="mt-3 min-h-24 bg-ink-50"
        id={`candidate-update-note-${updateId}`}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Record whether the new evidence has been incorporated, what still needs follow-through, or what should happen next."
        value={note}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={pendingStatus !== null}
          onClick={() => run(CandidateUpdateStatus.INCORPORATED)}
          size="sm"
          type="button"
          variant={initialStatus === CandidateUpdateStatus.INCORPORATED ? "primary" : "secondary"}
        >
          {pendingStatus === CandidateUpdateStatus.INCORPORATED ? "Saving..." : "Mark incorporated"}
        </Button>
        <Button
          disabled={pendingStatus !== null}
          onClick={() => run(CandidateUpdateStatus.NEEDS_FOLLOW_UP)}
          size="sm"
          type="button"
          variant={initialStatus === CandidateUpdateStatus.NEEDS_FOLLOW_UP ? "primary" : "subtle"}
        >
          {pendingStatus === CandidateUpdateStatus.NEEDS_FOLLOW_UP ? "Saving..." : "Needs follow-up"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
