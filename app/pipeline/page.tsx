import Link from "next/link";
import { SavedViewPage } from "@prisma/client";

import { AppShell } from "@/components/dashboard/app-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SavedViewControls } from "@/components/dashboard/saved-view-controls";
import { PipelineOutcomeControls } from "@/components/pipeline/pipeline-outcome-controls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSavedViews, getSponsorPipelineData, searchValueToString } from "@/lib/db/queries";
import { SPONSOR_OUTCOME_TYPE_LABELS, SPONSOR_OUTCOME_VERDICT_LABELS } from "@/lib/outcomes";
import { buildSavedViewQueryString } from "@/lib/saved-views";
import { SPONSOR_PIPELINE_STAGE_LABELS } from "@/lib/workflow/pipeline";
import { PipelineStageControls } from "@/components/pipeline/pipeline-stage-controls";

function getRightNowVariant(label?: string | null) {
  if (!label) {
    return "muted" as const;
  }

  if (label === "Ready now") {
    return "sage" as const;
  }

  if (label === "Paused right now" || label === "Capacity constrained") {
    return "danger" as const;
  }

  return "gold" as const;
}

function getFreshnessVariant(label?: string | null) {
  if (!label) {
    return "muted" as const;
  }

  if (label.includes("Fresh") || label.includes("current")) {
    return "sage" as const;
  }

  if (label.includes("Stale")) {
    return "danger" as const;
  }

  return "gold" as const;
}

const stageOrder = [
  "RECOMMENDED",
  "UNDER_REVIEW",
  "BRIEF_READY",
  "OUTREACH_DRAFTED",
  "CONTACTED",
  "INTRO_REQUESTED",
  "INTRO_CONFIRMED",
  "MEETING_SCHEDULED",
  "ADVOCATING",
  "PASSED",
  "CLOSED",
] as const;

export default async function PipelinePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const filters = {
    query: searchValueToString(resolved.q),
    stage: searchValueToString(resolved.stage) || "all",
    owner: searchValueToString(resolved.owner) || "all",
    score: searchValueToString(resolved.score) || "all",
  };
  const [data, savedViews] = await Promise.all([
    getSponsorPipelineData(filters),
    getSavedViews(SavedViewPage.PIPELINE),
  ]);
  const currentQueryString = buildSavedViewQueryString({
    q: filters.query,
    stage: filters.stage !== "all" ? filters.stage : undefined,
    owner: filters.owner !== "all" ? filters.owner : undefined,
    score: filters.score !== "all" ? filters.score : undefined,
  });

  return (
    <AppShell
      title="Sponsor pipeline"
      description="Track who is moving from recommendation into live advocacy, who owns the next step, and where the sponsor path is blocked."
    >
      <section className="grid gap-5 xl:grid-cols-8">
        <KpiCard detail="All sponsor paths" label="Total items" value={data.stats.total} />
        <KpiCard detail="Still in motion" label="Active" value={data.stats.active} />
        <KpiCard detail="Ready to advocate" label="Advocating" value={data.stats.advocacy} />
        <KpiCard detail="Scheduled sponsor conversations" label="Meetings" value={data.stats.meetingScheduled} />
        <KpiCard detail="Explicitly paused or passed" label="Blocked" value={data.stats.blocked} />
        <KpiCard detail="Stored recommendation no longer matches live context" label="Stale recs" value={data.stats.stale} />
        <KpiCard detail="Retryable or failed durable work" label="Recovery jobs" value={data.stats.recoveryJobs} />
        <KpiCard detail="Failed or fallback CRM handoffs" label="CRM recovery" value={data.stats.recoveryCrmSyncs} />
      </section>

      {data.stats.recoveryJobs > 0 || data.stats.recoveryCrmSyncs > 0 ? (
        <Card className="px-5 py-5">
          <p className="text-sm font-medium text-ink-900">Operational recovery needed</p>
          <p className="mt-2 text-sm leading-7 text-ink-600">
            {data.stats.recoveryJobs} background job{data.stats.recoveryJobs === 1 ? "" : "s"} and{" "}
            {data.stats.recoveryCrmSyncs} CRM sync{data.stats.recoveryCrmSyncs === 1 ? "" : "s"} currently need attention.
            Resolve them from Settings so live sponsor motion does not drift away from the recorded system state.
          </p>
        </Card>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-3">
        <Card className="px-5 py-5">
          <p className="text-sm font-medium text-ink-900">Sponsor-path overlap</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{data.stats.duplicateRisk}</p>
          <p className="mt-2 text-sm leading-7 text-ink-500">
            Pipeline rows with overlapping briefs, outbound sends, or live motion already recorded for the same sponsor path.
          </p>
        </Card>
        <Card className="px-5 py-5">
          <p className="text-sm font-medium text-ink-900">Timing blackout</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{data.stats.blackout}</p>
          <p className="mt-2 text-sm leading-7 text-ink-500">
            Current sponsor paths whose right-now fit is constrained by an active blackout window.
          </p>
        </Card>
        <Card className="px-5 py-5">
          <p className="text-sm font-medium text-ink-900">Unreleased paths</p>
          <p className="mt-2 font-serif text-3xl text-ink-900">{data.stats.unreleased}</p>
          <p className="mt-2 text-sm leading-7 text-ink-500">
            Sponsor paths that still lack an approved outreach release or remain blocked by path-level operating conditions.
          </p>
        </Card>
      </section>

      <Card className="px-5 py-5">
        <form className="grid gap-4 lg:grid-cols-[1.2fr_repeat(3,0.9fr)_auto]" method="get">
          <Input defaultValue={filters.query} name="q" placeholder="Search candidate, sponsor, or rationale" />
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.stage}
            name="stage"
          >
            <option value="all">All stages</option>
            {stageOrder.map((stage) => (
              <option key={stage} value={stage}>
                {SPONSOR_PIPELINE_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.owner}
            name="owner"
          >
            <option value="all">All owners</option>
            <option value="unowned">Unowned</option>
            {data.teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.score}
            name="score"
          >
            <option value="all">All fit bands</option>
            <option value="high">High fit</option>
            <option value="medium">Medium fit</option>
            <option value="low">Low fit</option>
          </select>
          <button
            className="h-11 rounded-2xl bg-ink-900 px-4 text-sm font-medium text-white transition hover:bg-ink-800"
            type="submit"
          >
            Apply filters
          </button>
        </form>
      </Card>

      <SavedViewControls
        currentQueryString={currentQueryString}
        page={SavedViewPage.PIPELINE}
        pagePath="/pipeline"
        savedViews={savedViews}
      />

      <section className="grid gap-5 xl:grid-cols-3">
        {stageOrder.map((stage) => {
          const items = data.items.filter((item) => item.stage === stage);

          return (
            <Card className="px-5 py-5" key={stage}>
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 pb-4">
                <div>
                  <p className="text-sm font-medium text-ink-900">{SPONSOR_PIPELINE_STAGE_LABELS[stage]}</p>
                  <p className="mt-1 text-sm text-ink-500">{items.length} items in this stage.</p>
                </div>
                <Badge variant="muted">{items.length}</Badge>
              </div>
              <div className="mt-5 space-y-4">
                {items.map((item) => (
                  <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" data-testid={`pipeline-item-${item.id}`} key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link className="font-medium text-ink-900 hover:text-sage-700" href={`/candidates/${item.candidateId}`}>
                          {item.candidate.fullName}
                        </Link>
                        <p className="mt-1 text-sm text-ink-500">
                          {item.sponsor.fullName} · {item.sponsor.organization}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-serif text-3xl text-ink-900">{item.currentMatch.score}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Live fit</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-ink-600">{item.rationale}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.owner ? <Badge variant="sage">{item.owner.name}</Badge> : <Badge variant="muted">Unowned</Badge>}
                      {item.nextDueAtLabel ? <Badge variant="muted">Due {item.nextDueAtLabel}</Badge> : null}
                      {item.opportunityBrief ? <Badge variant="muted">{item.opportunityBrief.opportunityType.replaceAll("_", " ")}</Badge> : null}
                      <Badge variant={getRightNowVariant(item.currentMatch.rightNowLabel)}>{item.currentMatch.rightNowLabel}</Badge>
                      <Badge variant="muted">Stored {Math.round(item.score)}</Badge>
                      {item.recommendationFreshness ? (
                        <Badge variant={getFreshnessVariant(item.recommendationFreshness.label)}>
                          {item.recommendationFreshness.label}
                        </Badge>
                      ) : null}
                      <Badge variant={item.currentMatch.operationalDelta >= 0 ? "sage" : "gold"}>
                        Ops {item.currentMatch.operationalDelta >= 0 ? "+" : ""}
                        {item.currentMatch.operationalDelta}
                      </Badge>
                      <Badge variant={item.outreachApprovalSummary.variant}>{item.outreachApprovalSummary.label}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-ink-500">{item.currentMatch.rightNowSummary}</p>
                    {item.recommendationFreshness ? (
                      <p className="mt-2 text-sm leading-7 text-ink-500">{item.recommendationFreshness.summary}</p>
                    ) : null}
                    {item.sponsorPathHistory.duplicateAskRisk || item.sponsorPathHistory.negativeMemory.length > 0 || item.outreachApprovalSummary.state !== "approved" ? (
                      <div className="mt-3 rounded-[1.25rem] border border-ink-100 bg-white px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {item.sponsorPathHistory.duplicateAskRisk ? <Badge variant="danger">Overlap flagged</Badge> : null}
                          {item.sponsorPathHistory.blackoutActive ? <Badge variant="danger">Blackout</Badge> : null}
                          {item.sponsorPathHistory.negativeMemory.map((memory) => (
                            <Badge key={memory} variant="gold">
                              {memory}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-3 text-sm leading-7 text-ink-600">{item.outreachApprovalSummary.detail}</p>
                        {item.sponsorPathHistory.duplicateAskReason ? (
                          <p className="mt-2 text-sm leading-7 text-rose-700">{item.sponsorPathHistory.duplicateAskReason}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {item.nextStep ? <p className="mt-3 text-sm leading-7 text-ink-500">Next step: {item.nextStep}</p> : null}
                    {item.outcomeNote ? <p className="mt-2 text-sm leading-7 text-ink-500">Note: {item.outcomeNote}</p> : null}
                    {item.latestOutcome ? (
                      <div className="mt-3 rounded-[1.25rem] border border-ink-100 bg-white px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={item.latestOutcome.verdict === "POSITIVE" ? "sage" : item.latestOutcome.verdict === "NEGATIVE" ? "danger" : "gold"}>
                            {SPONSOR_OUTCOME_VERDICT_LABELS[item.latestOutcome.verdict]}
                          </Badge>
                          <Badge variant="muted">{SPONSOR_OUTCOME_TYPE_LABELS[item.latestOutcome.outcomeType]}</Badge>
                          <Badge variant="muted">{item.latestOutcome.occurredAtLabel}</Badge>
                        </div>
                        <p className="mt-3 text-sm font-medium text-ink-900">{item.latestOutcome.title}</p>
                        <p className="mt-2 text-sm leading-7 text-ink-600">{item.latestOutcome.detail}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">
                          Recorded by {item.latestOutcome.recordedBy?.name ?? "Operator"} · {item.latestOutcome.recordedAtLabel}
                        </p>
                      </div>
                    ) : null}
                    <PipelineStageControls
                      initialNextDueAt={item.nextDueAt ? item.nextDueAt.toISOString().slice(0, 10) : null}
                      initialNextStep={item.nextStep}
                      initialOutcomeNote={item.outcomeNote}
                      initialOwnerUserId={item.ownerUserId}
                      initialStage={item.stage}
                      itemId={item.id}
                      sponsorFacingBlocked={item.outreachApprovalSummary.state !== "approved"}
                      sponsorFacingBlockers={[
                        item.outreachApprovalSummary.detail,
                        item.sponsorPathHistory.duplicateAskReason,
                        item.sponsorPathHistory.blackoutActive
                          ? item.sponsorPathHistory.blackoutReason
                            ? `Timing blackout: ${item.sponsorPathHistory.blackoutReason}`
                            : item.sponsorPathHistory.blackoutUntilLabel
                              ? `Timing blackout through ${item.sponsorPathHistory.blackoutUntilLabel}.`
                              : "Timing blackout is active on this sponsor path."
                          : null,
                      ].filter((value): value is string => Boolean(value))}
                      teamMembers={data.teamMembers.map((member) => ({
                        id: member.id,
                        name: member.name,
                        role: member.role,
                      }))}
                    />
                    <PipelineOutcomeControls itemId={item.id} />
                  </div>
                ))}
                {items.length === 0 ? <p className="text-sm text-ink-500">No sponsor paths currently sit in this stage.</p> : null}
              </div>
            </Card>
          );
        })}
      </section>
    </AppShell>
  );
}
