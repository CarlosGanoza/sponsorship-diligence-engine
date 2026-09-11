"use client";

import { OutboundApprovalStatus, OutboundApprovalType } from "@prisma/client";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { requestOutboundApprovalAction, reviewOutboundApprovalAction } from "@/app/actions";
import { OUTBOUND_APPROVAL_TYPE_LABELS } from "@/lib/outreach/approvals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ApprovalView = {
  id: string;
  approvalType: OutboundApprovalType;
  status: OutboundApprovalStatus;
  title: string;
  rationale: string;
  decisionNote: string | null;
  reviewedAtLabel: string | null;
  reviewedBy?: { name: string | null } | null;
};

export function OutboundApprovalControls({
  candidateId,
  sponsorId,
  opportunityBriefId,
  approvalType,
  approval,
  blockers,
}: {
  candidateId: string;
  sponsorId: string;
  opportunityBriefId: string;
  approvalType: OutboundApprovalType;
  approval: ApprovalView | null;
  blockers: string[];
}) {
  const router = useRouter();
  const [rationale, setRationale] = useState(
    approval?.rationale ??
      `Requesting ${OUTBOUND_APPROVAL_TYPE_LABELS[approvalType].toLowerCase()} after reviewing the current evidence discipline and sponsor path.`,
  );
  const [decisionNote, setDecisionNote] = useState(
    approval?.decisionNote ?? "Evidence and workflow checks are clear enough to move this sponsor path forward.",
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title =
    approvalType === OutboundApprovalType.OUTREACH_RELEASE
      ? "Sponsor-facing outreach release"
      : "CRM handoff release";

  return (
    <div
      aria-label={title}
      className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4"
      role="region"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">{title}</p>
          <p className="mt-1 text-sm text-ink-500">{OUTBOUND_APPROVAL_TYPE_LABELS[approvalType]}</p>
        </div>
        <Badge
          variant={
            approval?.status === OutboundApprovalStatus.APPROVED
              ? "sage"
              : approval?.status === OutboundApprovalStatus.REJECTED
                ? "danger"
                : "gold"
          }
        >
          {approval?.status?.replaceAll("_", " ") ?? "not requested"}
        </Badge>
      </div>

      {approval?.reviewedAtLabel ? (
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">
          {approval.reviewedBy?.name ?? "Operator"} · {approval.reviewedAtLabel}
        </p>
      ) : null}

      {blockers.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-3 py-3">
          {blockers.map((item) => (
            <p className="text-sm leading-6 text-amber-900" key={item}>
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-[1.25rem] border border-sage-200 bg-sage-50 px-3 py-3 text-sm leading-6 text-sage-900">
          Release conditions are clear. This path can move once the approval state is updated.
        </p>
      )}

      <div className="mt-4">
        <Label htmlFor={`${approvalType}-rationale`}>Rationale</Label>
        <Textarea
          id={`${approvalType}-rationale`}
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
        />
      </div>

      <div className="mt-4">
        <Label htmlFor={`${approvalType}-decision`}>Decision note</Label>
        <Textarea
          id={`${approvalType}-decision`}
          value={decisionNote}
          onChange={(event) => setDecisionNote(event.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending !== null}
          onClick={() => {
            setPending("request");
            setError(null);
            startTransition(async () => {
              const result = await requestOutboundApprovalAction(candidateId, {
                sponsorId,
                opportunityBriefId,
                approvalType,
                title,
                rationale,
              });
              setPending(null);
              if (!result.success) {
                setError(result.error ?? "Could not request approval.");
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending === "request" ? "Saving..." : approval ? "Refresh request" : "Request approval"}
        </Button>
        <Button
          size="sm"
          disabled={pending !== null || !approval}
          onClick={() => {
            if (!approval) {
              return;
            }
            setPending("approve");
            setError(null);
            startTransition(async () => {
              const result = await reviewOutboundApprovalAction(approval.id, {
                status: OutboundApprovalStatus.APPROVED,
                decisionNote,
              });
              setPending(null);
              if (!result.success) {
                setError(result.error ?? "Could not approve release.");
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending === "approve" ? "Approving..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending !== null || !approval}
          onClick={() => {
            if (!approval) {
              return;
            }
            setPending("reject");
            setError(null);
            startTransition(async () => {
              const result = await reviewOutboundApprovalAction(approval.id, {
                status: OutboundApprovalStatus.REJECTED,
                decisionNote,
              });
              setPending(null);
              if (!result.success) {
                setError(result.error ?? "Could not reject release.");
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending === "reject" ? "Rejecting..." : "Reject"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
