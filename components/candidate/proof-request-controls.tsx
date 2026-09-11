"use client";

import { startTransition, useEffect, useState } from "react";
import { ProofRequestStatus } from "@prisma/client";
import { useRouter } from "next/navigation";

import {
  createTaskFromProofRequestAction,
  updateProofRequestWorkflowAction,
} from "@/app/actions";
import { UpdateAccessLinkControls } from "@/components/candidate/update-access-link-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ProofRequestControls({
  requestId,
  initialAssignedUserId,
  initialDueAt,
  initialStatus,
  reminderCount,
  lastReminderAtLabel,
  lastReminderNote,
  hasTask,
  candidateUpdateAccessLink,
  teamMembers,
}: {
  requestId: string;
  initialAssignedUserId?: string | null;
  initialDueAt?: string | null;
  initialStatus: ProofRequestStatus;
  reminderCount: number;
  lastReminderAtLabel?: string | null;
  lastReminderNote?: string | null;
  hasTask?: boolean;
  candidateUpdateAccessLink?: {
    id: string;
    token: string;
    status: string;
    expiresAtLabel: string;
    lastUsedAtLabel: string | null;
  } | null;
  teamMembers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"save" | "task" | "remind" | "resolve" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignedUserId, setAssignedUserId] = useState(initialAssignedUserId ?? "");
  const [dueAt, setDueAt] = useState(initialDueAt ?? "");
  const [resolutionNote, setResolutionNote] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const isClosed = initialStatus === ProofRequestStatus.RESOLVED || initialStatus === ProofRequestStatus.CANCELED;

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (isClosed) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <div className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto]">
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setAssignedUserId(event.target.value)}
          value={assignedUserId}
        >
          <option value="">Unassigned</option>
          {teamMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} · {member.role}
            </option>
          ))}
        </select>
        <Input onChange={(event) => setDueAt(event.target.value)} type="date" value={dueAt} />
        <Button
          disabled={pending !== null || !hydrated}
          onClick={() => {
            setPending("save");
            setError(null);
            setSuccess(null);

            startTransition(async () => {
              const result = await updateProofRequestWorkflowAction(requestId, {
                assignedUserId,
                dueAt,
              });
              setPending(null);

              if (!result.success) {
                setError(result.error ?? "Could not update proof request.");
                return;
              }

              router.refresh();
            });
          }}
          size="sm"
          variant="secondary"
        >
          {pending === "save" ? "Saving..." : "Save queue"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          disabled={pending !== null || !hydrated || Boolean(hasTask)}
          onClick={() => {
            setPending("task");
            setError(null);
            setSuccess(null);

            startTransition(async () => {
              const result = await createTaskFromProofRequestAction(requestId);
              setPending(null);

              if (!result.success) {
                setError(result.error ?? "Could not create task.");
                return;
              }

              router.refresh();
            });
          }}
          size="sm"
          variant="secondary"
        >
          {pending === "task" ? "Creating task..." : hasTask ? "Task created" : "Create task"}
        </Button>
        <Button
          disabled={pending !== null || !hydrated}
          onClick={async () => {
            setPending("remind");
            setError(null);
            setSuccess(null);

            const response = await fetch(`/api/proof-requests/${requestId}/remind`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            }).catch(() => null);
            setPending(null);

            if (!response?.ok) {
              setError("Could not send reminder.");
              return;
            }

            setSuccess("Reminder sent. Refreshing workflow.");
            router.refresh();
          }}
          size="sm"
          variant="ghost"
        >
          {pending === "remind" ? "Sending reminder..." : "Send reminder"}
        </Button>
      </div>

      {reminderCount > 0 || lastReminderAtLabel || lastReminderNote ? (
        <p className="mt-3 text-sm leading-6 text-ink-500">
          {reminderCount > 0 ? `${reminderCount} reminder${reminderCount === 1 ? "" : "s"} sent` : "Reminder history available"}
          {lastReminderAtLabel ? ` · last sent ${lastReminderAtLabel}` : ""}
          {lastReminderNote ? ` · ${lastReminderNote}` : ""}
        </p>
      ) : null}

      <UpdateAccessLinkControls existingLink={candidateUpdateAccessLink} proofRequestId={requestId} />

      <Textarea
        className="mt-3"
        onChange={(event) => setResolutionNote(event.target.value)}
        placeholder="What proof was gathered, what contradiction was resolved, or why this request should be closed."
        rows={3}
        value={resolutionNote}
      />

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          disabled={pending !== null || !hydrated}
          onClick={async () => {
            setPending("resolve");
            setError(null);
            setSuccess(null);

            const response = await fetch(`/api/proof-requests/${requestId}/resolve`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                resolutionNote,
                status: ProofRequestStatus.RESOLVED,
              }),
            }).catch(() => null);
            setPending(null);

            if (!response?.ok) {
              setError("Could not resolve proof request.");
              return;
            }

            setSuccess("Proof request resolved. Refreshing workflow.");
            router.refresh();
          }}
          size="sm"
        >
          {pending === "resolve" ? "Resolving..." : "Resolve request"}
        </Button>
        <Button
          disabled={pending !== null || !hydrated}
          onClick={async () => {
            setPending("cancel");
            setError(null);
            setSuccess(null);

            const response = await fetch(`/api/proof-requests/${requestId}/resolve`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                resolutionNote,
                status: ProofRequestStatus.CANCELED,
              }),
            }).catch(() => null);
            setPending(null);

            if (!response?.ok) {
              setError("Could not cancel proof request.");
              return;
            }

            setSuccess("Proof request canceled. Refreshing workflow.");
            router.refresh();
          }}
          size="sm"
          variant="ghost"
        >
          {pending === "cancel" ? "Canceling..." : "Cancel request"}
        </Button>
      </div>
      {success ? <p className="mt-2 text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
