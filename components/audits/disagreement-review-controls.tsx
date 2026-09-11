"use client";

import { startTransition, useRef, useState } from "react";
import { DisagreementResolutionType } from "@prisma/client";
import { useRouter } from "next/navigation";

import {
  createTaskFromDisagreementReviewAction,
  openDisagreementReviewAction,
  resolveDisagreementReviewAction,
} from "@/app/actions";
import {
  DISAGREEMENT_RESOLUTION_LABELS,
  DISAGREEMENT_REVIEW_STATUS_LABELS,
} from "@/lib/audits/workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ReviewState = {
  id: string;
  status: string;
  autoTriggered?: boolean;
  riskScore?: number;
  triggerReason?: string | null;
  assignedUserId?: string | null;
  assignedUser?: { name: string | null } | null;
  reviewedBy?: { name: string | null } | null;
  dueAt?: string | Date | null;
  dueAtLabel?: string | null;
  resolutionType?: string | null;
  resolvedAtLabel?: string | null;
  operatorTask?: { id: string } | null;
};

export function DisagreementReviewControls({
  candidateId,
  existingReview,
  teamMembers,
  hasActiveDisagreement,
}: {
  candidateId: string;
  existingReview?: ReviewState | null;
  teamMembers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  hasActiveDisagreement: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [taskPending, setTaskPending] = useState(false);
  const [resolutionPending, setResolutionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTask, setHasTask] = useState(Boolean(existingReview?.operatorTask));
  const [assignedUserId, setAssignedUserId] = useState(existingReview?.assignedUserId ?? "");
  const [dueAt, setDueAt] = useState(
    existingReview?.dueAt
      ? new Date(existingReview.dueAt).toISOString().slice(0, 10)
      : "",
  );
  const [resolutionType, setResolutionType] = useState<DisagreementResolutionType>(
    DisagreementResolutionType.FOLLOW_SYSTEM,
  );
  const [rationale, setRationale] = useState("");
  const assignedUserIdRef = useRef(existingReview?.assignedUserId ?? "");
  const dueAtRef = useRef(
    existingReview?.dueAt
      ? new Date(existingReview.dueAt).toISOString().slice(0, 10)
      : "",
  );
  const resolutionTypeRef = useRef<DisagreementResolutionType>(DisagreementResolutionType.FOLLOW_SYSTEM);
  const rationaleRef = useRef("");
  const activeReview =
    existingReview &&
    (existingReview.status === "OPEN" ||
      existingReview.status === "IN_PROGRESS" ||
      existingReview.status === "ESCALATED")
      ? existingReview
      : null;
  const taskCreated = hasTask || Boolean(activeReview?.operatorTask);

  if (!hasActiveDisagreement && !existingReview) {
    return null;
  }

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" data-testid="disagreement-review-controls">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">Disagreement review</p>
          <p className="mt-1 text-sm text-ink-500">
            Assign a second reviewer, create a task, and explicitly resolve whether the file should follow the guardrail or the human judgment.
          </p>
        </div>
        {existingReview ? (
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                existingReview.status === "RESOLVED"
                  ? "sage"
                  : existingReview.status === "ESCALATED"
                    ? "gold"
                    : "muted"
              }
            >
              {DISAGREEMENT_REVIEW_STATUS_LABELS[existingReview.status as keyof typeof DISAGREEMENT_REVIEW_STATUS_LABELS]}
            </Badge>
            {existingReview.resolutionType ? (
              <Badge variant="muted">
                {
                  DISAGREEMENT_RESOLUTION_LABELS[
                    existingReview.resolutionType as keyof typeof DISAGREEMENT_RESOLUTION_LABELS
                  ]
                }
              </Badge>
            ) : null}
            {existingReview.autoTriggered ? <Badge variant="gold">Auto-triggered</Badge> : null}
            {typeof existingReview.riskScore === "number" && existingReview.riskScore > 0 ? (
              <Badge variant="muted">Risk {existingReview.riskScore}</Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      {existingReview ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {existingReview.assignedUser?.name ? <Badge variant="sage">Assigned to {existingReview.assignedUser.name}</Badge> : null}
            {existingReview.dueAtLabel ? <Badge variant="muted">Due {existingReview.dueAtLabel}</Badge> : null}
            {existingReview.reviewedBy?.name ? <Badge variant="muted">Reviewed by {existingReview.reviewedBy.name}</Badge> : null}
            {existingReview.resolvedAtLabel ? <Badge variant="muted">Resolved {existingReview.resolvedAtLabel}</Badge> : null}
          </div>
          {existingReview.triggerReason ? (
            <p className="text-sm leading-7 text-ink-500">{existingReview.triggerReason}</p>
          ) : null}
        </div>
      ) : null}

      {hasActiveDisagreement ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto]">
            <select
              aria-label="Assign reviewer"
              className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              onChange={(event) => {
                setAssignedUserId(event.target.value);
                assignedUserIdRef.current = event.target.value;
              }}
              value={assignedUserId}
            >
              <option value="">No reviewer assigned</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.role}
                </option>
              ))}
            </select>
            <Input
              onChange={(event) => {
                setDueAt(event.target.value);
                dueAtRef.current = event.target.value;
              }}
              type="date"
              value={dueAt}
            />
            <Button
              disabled={pending}
              onClick={() => {
                setPending(true);
                setError(null);

                startTransition(async () => {
                  const result = await openDisagreementReviewAction(candidateId, {
                    assignedUserId: assignedUserIdRef.current,
                    dueAt: dueAtRef.current,
                  });
                  setPending(false);

                  if (!result.success) {
                    setError(result.error ?? "Could not save disagreement review.");
                    return;
                  }

                  router.refresh();
                });
              }}
              size="sm"
              variant="secondary"
            >
              {pending ? "Saving..." : activeReview ? "Update review" : "Open review"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={taskPending || !activeReview?.id || taskCreated}
              onClick={() => {
                if (!activeReview?.id) {
                  return;
                }

                setTaskPending(true);
                setError(null);

                startTransition(async () => {
                  const result = await createTaskFromDisagreementReviewAction(activeReview.id);
                  setTaskPending(false);

                  if (!result.success) {
                    setError(result.error ?? "Could not create second-review task.");
                    return;
                  }

                  setHasTask(true);
                });
              }}
              size="sm"
              variant="secondary"
            >
              {taskPending
                ? "Creating second-review task..."
                : taskCreated
                  ? "Second-review task created"
                  : "Create second-review task"}
            </Button>
          </div>

          <div className="grid gap-3">
            <select
              aria-label="Resolution type"
              className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              onChange={(event) => {
                const nextValue = event.target.value as DisagreementResolutionType;
                setResolutionType(nextValue);
                resolutionTypeRef.current = nextValue;
              }}
              value={resolutionType}
            >
              {Object.values(DisagreementResolutionType).map((value) => (
                <option key={value} value={value}>
                  {DISAGREEMENT_RESOLUTION_LABELS[value]}
                </option>
              ))}
            </select>
            <Textarea
              onChange={(event) => {
                setRationale(event.target.value);
                rationaleRef.current = event.target.value;
              }}
              placeholder="What changed? Why should the file follow the system, the human reviewer, or a proof-request path?"
              rows={4}
              value={rationale}
            />
            <div className="flex justify-end">
              <Button
                disabled={resolutionPending || !activeReview?.id}
                onClick={() => {
                  if (!activeReview?.id) {
                    return;
                  }

                  setResolutionPending(true);
                  setError(null);

                  startTransition(async () => {
                    const result = await resolveDisagreementReviewAction(activeReview.id, {
                      resolutionType: resolutionTypeRef.current,
                      rationale: rationaleRef.current,
                    });
                    setResolutionPending(false);

                    if (!result.success) {
                      setError(result.error ?? "Could not resolve disagreement review.");
                      return;
                    }

                    setRationale("");
                    setResolutionType(DisagreementResolutionType.FOLLOW_SYSTEM);
                    rationaleRef.current = "";
                    resolutionTypeRef.current = DisagreementResolutionType.FOLLOW_SYSTEM;
                    router.refresh();
                  });
                }}
                size="sm"
                variant="secondary"
              >
                {resolutionPending ? "Resolving..." : activeReview ? "Resolve review" : "Open review first"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!hasActiveDisagreement && existingReview ? (
        <p className="mt-4 text-sm leading-7 text-ink-500">
          There is no current human-vs-system mismatch on this file. The history above remains as an audit record.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
