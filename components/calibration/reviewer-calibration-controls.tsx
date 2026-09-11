"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  ReviewerCalibrationActionItem,
  ReviewerCalibrationItemStatus,
  ReviewerCalibrationWorkspace,
} from "@/lib/calibration/workspace";
import { formatDate } from "@/lib/utils/format";

function CalibrationItemCard({
  item,
}: {
  item: ReviewerCalibrationActionItem;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<ReviewerCalibrationItemStatus>(item.status);
  const [owner, setOwner] = useState(item.currentOwner);
  const [dueAt, setDueAt] = useState(item.dueAt ?? "");
  const [note, setNote] = useState(item.note ?? "");

  return (
    <div
      className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4"
      data-reviewer-id={item.reviewerId}
      data-testid={`calibration-item-${item.reviewerSlug}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">{item.reviewerName}</p>
          <p className="mt-2 text-sm leading-7 text-ink-600">{item.recommendation}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={item.calibrationStatus === "watch" ? "danger" : item.calibrationStatus === "mixed" ? "gold" : item.calibrationStatus === "well_calibrated" ? "sage" : "muted"}>
            {item.calibrationStatus.replaceAll("_", " ")}
          </Badge>
          <Badge variant="muted">{status.replaceAll("_", " ")}</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-[1.25rem] border border-ink-100 bg-ink-50 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Alignment</p>
          <p className="mt-2 font-serif text-2xl text-ink-900">{item.alignmentRate}%</p>
        </div>
        <div className="rounded-[1.25rem] border border-ink-100 bg-ink-50 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Disagreement</p>
          <p className="mt-2 font-serif text-2xl text-ink-900">{item.disagreementRate}%</p>
        </div>
        <div className="rounded-[1.25rem] border border-ink-100 bg-ink-50 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Known outcomes</p>
          <p className="mt-2 font-serif text-2xl text-ink-900">{item.knownOutcomeCount}</p>
        </div>
        <div className="rounded-[1.25rem] border border-ink-100 bg-ink-50 px-3 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Optimistic misses</p>
          <p className="mt-2 font-serif text-2xl text-ink-900">{item.optimisticNegativeCount}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[0.9fr_1fr_0.9fr]">
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setStatus(event.target.value as ReviewerCalibrationItemStatus)}
          value={status}
        >
          <option value="NOT_STARTED">Not started</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="READY">Ready</option>
          <option value="ESCALATED">Escalated</option>
        </select>
        <Input onChange={(event) => setOwner(event.target.value)} placeholder="Owner" value={owner} />
        <Input onChange={(event) => setDueAt(event.target.value)} type="date" value={dueAt} />
      </div>

      <div className="mt-3">
        <Textarea
          onChange={(event) => setNote(event.target.value)}
          placeholder="Calibration note, escalation rationale, or review follow-through"
          rows={3}
          value={note}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-500">
          {item.completedAt ? `Completed ${formatDate(item.completedAt)}` : null}
          {!item.completedAt && item.updatedAt ? `Last updated ${formatDate(item.updatedAt)}` : null}
          {!item.completedAt && !item.updatedAt ? `Default owner ${item.defaultOwner}` : null}
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);
            setSuccess(null);
            startTransition(async () => {
              const response = await fetch(`/api/calibration/reviewers/${item.reviewerId}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  status,
                  owner,
                  dueAt,
                  note,
                }),
              }).catch(() => null);

              setPending(false);

              if (!response?.ok) {
                const payload = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
                setError(payload?.error ?? "Could not update the reviewer calibration state.");
                return;
              }

              setSuccess("Calibration item saved. Refreshing governance views.");
              router.refresh();
            });
          }}
          size="sm"
          variant="secondary"
        >
          {pending ? "Saving..." : "Save item"}
        </Button>
      </div>

      {success ? <p className="mt-3 text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

export function ReviewerCalibrationControls({
  workspace,
}: {
  workspace: ReviewerCalibrationWorkspace;
}) {
  return (
    <div className="space-y-4" data-testid="reviewer-calibration-workspace">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Completion</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{workspace.summary.completionRate}%</p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Escalated</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{workspace.summary.escalatedCount}</p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Watch reviewers</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{workspace.overview.watchCount}</p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Needs data</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{workspace.overview.needsDataCount}</p>
        </div>
      </div>
      {workspace.items.map((item) => (
        <CalibrationItemCard item={item} key={item.reviewerId} />
      ))}
      {workspace.items.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-ink-200 bg-white px-4 py-6">
          <p className="text-sm text-ink-500">No reviewer calibration history is available yet.</p>
        </div>
      ) : null}
    </div>
  );
}
