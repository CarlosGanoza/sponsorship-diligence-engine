"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PilotLaunchItem, PilotLaunchItemStatus, PilotLaunchWorkstream } from "@/lib/pilot/workspace";
import { formatDate } from "@/lib/utils/format";

function LaunchItemCard({
  item,
}: {
  item: PilotLaunchItem;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<PilotLaunchItemStatus>(item.status);
  const [owner, setOwner] = useState(item.currentOwner);
  const [dueAt, setDueAt] = useState(item.dueAt ?? "");
  const [note, setNote] = useState(item.note ?? "");

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" data-testid={`launch-item-${item.slug}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">
            {item.index + 1}. {item.title}
          </p>
          <p className="mt-2 text-sm leading-7 text-ink-600">{item.detail}</p>
        </div>
        <div className="rounded-full bg-ink-50 px-3 py-2 text-xs uppercase tracking-[0.18em] text-ink-500">
          {status.replaceAll("_", " ")}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[0.9fr_1fr_0.9fr]">
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setStatus(event.target.value as PilotLaunchItemStatus)}
          value={status}
        >
          <option value="NOT_STARTED">Not started</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="READY">Ready</option>
        </select>
        <Input onChange={(event) => setOwner(event.target.value)} placeholder="Owner" value={owner} />
        <Input onChange={(event) => setDueAt(event.target.value)} type="date" value={dueAt} />
      </div>
      <div className="mt-3">
        <Textarea
          onChange={(event) => setNote(event.target.value)}
          placeholder="Operator note, buyer dependency, or launch blocker"
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
              const response = await fetch(`/api/pilot/launch-items/${item.slug}`, {
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
                setError(payload?.error ?? "Could not update the launch workstream.");
                return;
              }

              setSuccess("Launch item saved. Refreshing pilot views.");
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

export function PilotLaunchWorkstreamControls({
  workstream,
}: {
  workstream: PilotLaunchWorkstream;
}) {
  return (
    <div className="space-y-4" data-testid="pilot-launch-workstream">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Completion</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{workstream.summary.completionRate}%</p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Ready items</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{workstream.summary.readyCount}</p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">In progress</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{workstream.summary.inProgressCount}</p>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Overdue</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{workstream.summary.overdueCount}</p>
        </div>
      </div>
      {workstream.items.map((item) => (
        <LaunchItemCard item={item} key={item.slug} />
      ))}
    </div>
  );
}
