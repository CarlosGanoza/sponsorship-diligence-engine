"use client";

import { startTransition, useState } from "react";

import { retryBackgroundJobAction, retryCrmSyncRecordAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function RecoveryQueueControls({
  backgroundJobs,
  crmSyncs,
}: {
  backgroundJobs: Array<{
    id: string;
    title: string;
    status: string;
    candidate?: {
      fullName: string;
    } | null;
    errorMessage?: string | null;
    updatedAtLabel: string;
  }>;
  crmSyncs: Array<{
    id: string;
    status: string;
    syncNote: string;
    candidate: {
      fullName: string;
    };
    sponsor: {
      fullName: string;
    };
    updatedAtLabel: string;
  }>;
}) {
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [pendingSyncId, setPendingSyncId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-4">
        {backgroundJobs.map((job) => (
          <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={job.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-900">{job.title}</p>
                <p className="mt-1 text-sm text-ink-500">
                  {job.candidate?.fullName ? `${job.candidate.fullName} · ` : ""}
                  {job.status.replaceAll("_", " ")} · {job.updatedAtLabel}
                </p>
              </div>
              <Button
                disabled={pendingJobId === job.id}
                onClick={() => {
                  setPendingJobId(job.id);
                  setMessage(null);

                  startTransition(async () => {
                    const result = await retryBackgroundJobAction(job.id);
                    setPendingJobId(null);
                    setMessage(result.success ? "Background job requeued." : result.error ?? "Could not requeue job.");
                  });
                }}
                type="button"
                variant="secondary"
              >
                {pendingJobId === job.id ? "Requeueing..." : "Requeue"}
              </Button>
            </div>
            {job.errorMessage ? <p className="mt-3 text-sm leading-6 text-rose-700">{job.errorMessage}</p> : null}
          </div>
        ))}
        {backgroundJobs.length === 0 ? <p className="text-sm text-ink-500">No retryable background jobs are waiting.</p> : null}
      </div>

      <div className="space-y-4">
        {crmSyncs.map((sync) => (
          <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={sync.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-900">
                  {sync.candidate.fullName} → {sync.sponsor.fullName}
                </p>
                <p className="mt-1 text-sm text-ink-500">
                  {sync.status.replaceAll("_", " ")} · {sync.updatedAtLabel}
                </p>
              </div>
              <Button
                disabled={pendingSyncId === sync.id}
                onClick={() => {
                  setPendingSyncId(sync.id);
                  setMessage(null);

                  startTransition(async () => {
                    const result = await retryCrmSyncRecordAction(sync.id);
                    setPendingSyncId(null);
                    setMessage(result.success ? "CRM sync retry queued." : result.error ?? "Could not retry CRM sync.");
                  });
                }}
                type="button"
                variant="secondary"
              >
                {pendingSyncId === sync.id ? "Retrying..." : "Retry sync"}
              </Button>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-600">{sync.syncNote}</p>
          </div>
        ))}
        {crmSyncs.length === 0 ? <p className="text-sm text-ink-500">No failed or fallback CRM syncs are waiting.</p> : null}
      </div>

      {message ? <p className="text-sm text-ink-600 xl:col-span-2">{message}</p> : null}
    </div>
  );
}
