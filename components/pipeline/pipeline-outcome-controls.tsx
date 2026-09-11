"use client";

import { SponsorOutcomeType, SponsorOutcomeVerdict } from "@prisma/client";
import { startTransition, useState } from "react";
import { recordSponsorOutcomeAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SPONSOR_OUTCOME_TYPE_LABELS, SPONSOR_OUTCOME_VERDICT_LABELS } from "@/lib/outcomes";

function getTodayValue() {
  return new Date().toISOString().slice(0, 10);
}

const outcomeTemplates: Record<
  SponsorOutcomeType,
  {
    verdict: SponsorOutcomeVerdict;
    title: string;
    detail: string;
  }
> = {
  ADVOCACY_COMMITTED: {
    verdict: SponsorOutcomeVerdict.POSITIVE,
    title: "Sponsor committed to advocate",
    detail: "The sponsor agreed to actively champion the candidate for the next concrete opportunity.",
  },
  INTRO_COMPLETED: {
    verdict: SponsorOutcomeVerdict.POSITIVE,
    title: "Warm introduction completed",
    detail: "The sponsor or connector completed the introduction and opened the next conversation.",
  },
  OPPORTUNITY_SECURED: {
    verdict: SponsorOutcomeVerdict.POSITIVE,
    title: "Opportunity secured",
    detail: "The path produced a concrete role, fellowship, project, or sponsor-backed opportunity.",
  },
  FOLLOW_ON_SUPPORT: {
    verdict: SponsorOutcomeVerdict.POSITIVE,
    title: "Follow-on support confirmed",
    detail: "The sponsor did not just meet; they stayed engaged and offered another concrete step.",
  },
  TIMING_MISMATCH: {
    verdict: SponsorOutcomeVerdict.NEGATIVE,
    title: "Timing mismatch",
    detail: "The sponsor did not move now because the timing or ask was not right for this path.",
  },
  DECLINED: {
    verdict: SponsorOutcomeVerdict.NEGATIVE,
    title: "Sponsor declined",
    detail: "The sponsor reviewed the case and decided not to back the candidate on this path.",
  },
  NO_MOVEMENT: {
    verdict: SponsorOutcomeVerdict.NEGATIVE,
    title: "No movement after outreach",
    detail: "The path did not progress into real advocacy, follow-through, or another concrete step.",
  },
  NEEDS_MORE_PROOF: {
    verdict: SponsorOutcomeVerdict.MIXED,
    title: "More proof requested",
    detail: "The sponsor was interested but asked for stronger proof before committing reputational capital.",
  },
};

export function PipelineOutcomeControls({
  itemId,
}: {
  itemId: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomeType, setOutcomeType] = useState<SponsorOutcomeType>(SponsorOutcomeType.ADVOCACY_COMMITTED);
  const [verdict, setVerdict] = useState<SponsorOutcomeVerdict>(SponsorOutcomeVerdict.POSITIVE);
  const [title, setTitle] = useState(outcomeTemplates.ADVOCACY_COMMITTED.title);
  const [detail, setDetail] = useState(outcomeTemplates.ADVOCACY_COMMITTED.detail);
  const [occurredAt, setOccurredAt] = useState(getTodayValue());
  const [latestRecordedOutcome, setLatestRecordedOutcome] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  function applyTemplate(nextType: SponsorOutcomeType) {
    const template = outcomeTemplates[nextType];
    setOutcomeType(nextType);
    setVerdict(template.verdict);
    setTitle(template.title);
    setDetail(template.detail);
  }

  return (
    <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" data-testid={`pipeline-outcome-${itemId}`}>
      <div className="border-b border-ink-100 pb-4">
        <p className="text-sm font-medium text-ink-900">Record sponsor outcome</p>
        <p className="mt-1 text-sm text-ink-500">
          Capture the actual result of this sponsor path so scoring and calibration can learn from observed advocacy outcomes.
        </p>
      </div>
      {latestRecordedOutcome ? (
        <div className="mt-4 rounded-[1.25rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-sm font-medium text-ink-900">{latestRecordedOutcome.title}</p>
          <p className="mt-2 text-sm leading-7 text-ink-600">{latestRecordedOutcome.detail}</p>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor={`outcome-type-${itemId}`}>Outcome type</Label>
          <select
            className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            id={`outcome-type-${itemId}`}
            onChange={(event) => applyTemplate(event.target.value as SponsorOutcomeType)}
            value={outcomeType}
          >
            {Object.values(SponsorOutcomeType).map((value) => (
              <option key={value} value={value}>
                {SPONSOR_OUTCOME_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`outcome-verdict-${itemId}`}>Verdict</Label>
          <select
            className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            id={`outcome-verdict-${itemId}`}
            onChange={(event) => setVerdict(event.target.value as SponsorOutcomeVerdict)}
            value={verdict}
          >
            {Object.values(SponsorOutcomeVerdict).map((value) => (
              <option key={value} value={value}>
                {SPONSOR_OUTCOME_VERDICT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`outcome-date-${itemId}`}>Outcome date</Label>
          <Input id={`outcome-date-${itemId}`} onChange={(event) => setOccurredAt(event.target.value)} type="date" value={occurredAt} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Label htmlFor={`outcome-title-${itemId}`}>Title</Label>
          <Input id={`outcome-title-${itemId}`} onChange={(event) => setTitle(event.target.value)} value={title} />
        </div>
        <div>
          <Label htmlFor={`outcome-detail-${itemId}`}>What actually happened</Label>
          <Textarea id={`outcome-detail-${itemId}`} onChange={(event) => setDetail(event.target.value)} rows={4} value={detail} />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-ink-500">
          Positive and negative outcomes become measured learning inputs. Mixed outcomes stay visible but are excluded from false-positive and false-negative tallies.
        </p>
        <Button
          disabled={pending}
          onClick={() => {
            const optimisticOutcome = {
              title,
              detail,
            };
            setPending(true);
            setError(null);
            setLatestRecordedOutcome(optimisticOutcome);
            startTransition(async () => {
              const result = await recordSponsorOutcomeAction(itemId, {
                outcomeType,
                verdict,
                title,
                detail,
                occurredAt,
              });

              setPending(false);

              if (!result.success) {
                setLatestRecordedOutcome(null);
                setError(result.error ?? "Outcome could not be recorded.");
                return;
              }
            });
          }}
          size="sm"
          variant="secondary"
        >
          {pending ? "Recording..." : "Record outcome"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
