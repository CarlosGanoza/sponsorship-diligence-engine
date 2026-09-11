"use client";

import { SponsorActivityStatus, SponsorActivityType } from "@prisma/client";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { logSponsorActivityAction, syncCrmHandoffAction } from "@/app/actions";
import { requiresOutboundApprovalForActivity } from "@/lib/outreach/approvals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function OperationsControls({
  candidateId,
  sponsorId,
  opportunityBriefId,
  crmBlockedReason,
  outboundBlockedReason,
}: {
  candidateId: string;
  sponsorId: string;
  opportunityBriefId: string;
  crmBlockedReason?: string | null;
  outboundBlockedReason?: string | null;
}) {
  const router = useRouter();
  const [activityType, setActivityType] = useState<SponsorActivityType>(SponsorActivityType.INTRO_REQUESTED);
  const [status, setStatus] = useState<SponsorActivityStatus>(SponsorActivityStatus.PENDING);
  const [title, setTitle] = useState("Warm intro request sent");
  const [detail, setDetail] = useState("Shared the sponsor-ready case and requested a warm introduction.");
  const [sourceLabel, setSourceLabel] = useState("Operator update");
  const [pendingAction, setPendingAction] = useState<"sync" | "activity" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activityBlocked = Boolean(outboundBlockedReason && requiresOutboundApprovalForActivity(activityType));

  function updateTemplate(nextType: SponsorActivityType) {
    setActivityType(nextType);

    const templates: Record<SponsorActivityType, { title: string; detail: string; status: SponsorActivityStatus }> = {
      INTRO_REQUESTED: {
        title: "Warm intro request sent",
        detail: "Shared the sponsor-ready case and requested a warm introduction.",
        status: SponsorActivityStatus.PENDING,
      },
      INTRO_CONFIRMED: {
        title: "Warm intro confirmed",
        detail: "The connector agreed to make the introduction and asked for the final materials.",
        status: SponsorActivityStatus.COMPLETED,
      },
      SPONSOR_CONTACTED: {
        title: "Sponsor contacted directly",
        detail: "Sent the concise sponsor note with the current ask and proof set.",
        status: SponsorActivityStatus.PENDING,
      },
      MEETING_SCHEDULED: {
        title: "Meeting scheduled",
        detail: "A sponsor conversation is on the calendar with the brief and evidence set prepared.",
        status: SponsorActivityStatus.COMPLETED,
      },
      FOLLOW_UP_SENT: {
        title: "Follow-up sent",
        detail: "Sent the promised evidence package and clarified the immediate next step.",
        status: SponsorActivityStatus.COMPLETED,
      },
      OUTCOME_RECORDED: {
        title: "Outcome recorded",
        detail: "Logged the result of the sponsor conversation and the next advocacy path.",
        status: SponsorActivityStatus.COMPLETED,
      },
      CRM_SYNCED: {
        title: "CRM sync noted",
        detail: "The handoff record was synced into the CRM layer.",
        status: SponsorActivityStatus.COMPLETED,
      },
    };

    const template = templates[nextType];
    setTitle(template.title);
    setDetail(template.detail);
    setStatus(template.status);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink-900">Sync current handoff</p>
            <p className="mt-1 text-sm text-ink-500">
              Persist the current sponsor-path record and log the sync in the activity timeline.
            </p>
          </div>
          <Button
            disabled={pendingAction !== null || Boolean(crmBlockedReason)}
            onClick={() => {
              setPendingAction("sync");
              setError(null);
              startTransition(async () => {
                const result = await syncCrmHandoffAction(candidateId, sponsorId);
                setPendingAction(null);
                if (!result.success) {
                  setError(result.error ?? "CRM sync failed.");
                  return;
                }
                router.refresh();
              });
            }}
            size="sm"
          >
            {pendingAction === "sync" ? "Syncing..." : "Sync to CRM"}
          </Button>
        </div>
        {crmBlockedReason ? <p className="mt-3 text-sm text-rose-600">{crmBlockedReason}</p> : null}
      </div>

      <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
        <p className="text-sm font-medium text-ink-900">Log sponsor activity</p>
        <p className="mt-1 text-sm text-ink-500">
          Record what happened on this sponsor path so the ops state remains explicit.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="activity-type">Activity type</Label>
            <select
              className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              id="activity-type"
              onChange={(event) => updateTemplate(event.target.value as SponsorActivityType)}
              value={activityType}
            >
              {Object.values(SponsorActivityType).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="activity-status">Status</Label>
            <select
              className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              id="activity-status"
              onChange={(event) => setStatus(event.target.value as SponsorActivityStatus)}
              value={status}
            >
              {Object.values(SponsorActivityStatus).map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="activity-title">Title</Label>
            <Input id="activity-title" onChange={(event) => setTitle(event.target.value)} value={title} />
          </div>
          <div>
            <Label htmlFor="activity-source">Source label</Label>
            <Input id="activity-source" onChange={(event) => setSourceLabel(event.target.value)} value={sourceLabel} />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="activity-detail">Detail</Label>
          <Textarea id="activity-detail" onChange={(event) => setDetail(event.target.value)} value={detail} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            disabled={pendingAction !== null || activityBlocked}
            onClick={() => {
              setPendingAction("activity");
              setError(null);
              startTransition(async () => {
                const result = await logSponsorActivityAction({
                  candidateId,
                  sponsorId,
                  opportunityBriefId,
                  activityType,
                  status,
                  title,
                  detail,
                  sourceLabel,
                });
                setPendingAction(null);
                if (!result.success) {
                  setError(result.error ?? "Could not log sponsor activity.");
                  return;
                }
                router.refresh();
              });
            }}
            size="sm"
            variant="secondary"
          >
            {pendingAction === "activity" ? "Saving..." : "Log activity"}
          </Button>
        </div>
        {activityBlocked ? <p className="mt-3 text-sm text-rose-600">{outboundBlockedReason}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
