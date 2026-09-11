"use client";

import { useState } from "react";
import { SponsorPipelineStage } from "@prisma/client";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SPONSOR_PIPELINE_STAGE_LABELS } from "@/lib/workflow/pipeline";

const sponsorFacingStages = new Set<SponsorPipelineStage>([
  SponsorPipelineStage.CONTACTED,
  SponsorPipelineStage.INTRO_REQUESTED,
  SponsorPipelineStage.INTRO_CONFIRMED,
  SponsorPipelineStage.MEETING_SCHEDULED,
  SponsorPipelineStage.ADVOCATING,
]);

export function PipelineStageControls({
  itemId,
  initialStage,
  initialOwnerUserId,
  initialNextDueAt,
  initialNextStep,
  initialOutcomeNote,
  teamMembers,
  sponsorFacingBlocked = false,
  sponsorFacingBlockers = [],
}: {
  itemId: string;
  initialStage: SponsorPipelineStage;
  initialOwnerUserId?: string | null;
  initialNextDueAt?: string | null;
  initialNextStep?: string | null;
  initialOutcomeNote?: string | null;
  teamMembers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  sponsorFacingBlocked?: boolean;
  sponsorFacingBlockers?: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<SponsorPipelineStage>(initialStage);
  const [ownerUserId, setOwnerUserId] = useState(initialOwnerUserId ?? "");
  const [nextDueAt, setNextDueAt] = useState(initialNextDueAt ?? "");
  const [nextStep, setNextStep] = useState(initialNextStep ?? "");
  const [outcomeNote, setOutcomeNote] = useState(initialOutcomeNote ?? "");
  const preflightBlocked = sponsorFacingBlocked && !sponsorFacingStages.has(initialStage);
  const blockedForSelectedStage =
    sponsorFacingBlocked && sponsorFacingStages.has(stage) && stage !== initialStage;

  return (
    <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <div className="grid gap-3">
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setStage(event.target.value as SponsorPipelineStage)}
          value={stage}
        >
          {Object.values(SponsorPipelineStage).map((value) => (
            <option
              disabled={sponsorFacingBlocked && sponsorFacingStages.has(value) && !sponsorFacingStages.has(initialStage)}
              key={value}
              value={value}
            >
              {SPONSOR_PIPELINE_STAGE_LABELS[value]}
            </option>
          ))}
        </select>
        <div className="grid gap-3 md:grid-cols-[1fr_0.8fr]">
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            onChange={(event) => setOwnerUserId(event.target.value)}
            value={ownerUserId}
          >
            <option value="">No owner</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.role}
              </option>
            ))}
          </select>
          <Input onChange={(event) => setNextDueAt(event.target.value)} type="date" value={nextDueAt} />
        </div>
        <Input
          onChange={(event) => setNextStep(event.target.value)}
          placeholder="Next operator step"
          value={nextStep}
        />
        <Textarea
          onChange={(event) => setOutcomeNote(event.target.value)}
          placeholder="Optional outcome or caution note"
          rows={3}
          value={outcomeNote}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-ink-500">
            Pipeline stages are monotonic by default. Moving a path into sponsor-facing stages is also guarded by the current outreach release state.
          </p>
          <Button
            disabled={pending || blockedForSelectedStage}
            onClick={async () => {
              setPending(true);
              setError(null);
              const response = await fetch(`/api/pipeline/${itemId}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  stage,
                  ownerUserId,
                  nextDueAt,
                  nextStep,
                  outcomeNote,
                }),
              });
              const data = (await response.json().catch(() => null)) as { error?: string } | null;
              setPending(false);

              if (!response.ok) {
                setError(data?.error ?? "Pipeline update failed.");
                return;
              }

              router.refresh();
            }}
            size="sm"
          >
            {pending ? "Saving..." : "Save pipeline"}
          </Button>
        </div>
        {preflightBlocked ? (
          <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-sm font-medium text-amber-900">Sponsor-facing stages are preflight-blocked</p>
            <div className="mt-2 space-y-2">
              {sponsorFacingBlockers.map((blocker) => (
                <p className="text-sm leading-6 text-amber-800" key={blocker}>
                  {blocker}
                </p>
              ))}
            </div>
          </div>
        ) : null}
        {blockedForSelectedStage ? (
          <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-4">
            <p className="text-sm font-medium text-rose-900">Sponsor-facing movement is blocked</p>
            <div className="mt-2 space-y-2">
              {sponsorFacingBlockers.map((blocker) => (
                <p className="text-sm leading-6 text-rose-800" key={blocker}>
                  {blocker}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
