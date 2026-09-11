import Link from "next/link";
import type { Route } from "next";

import { AppShell } from "@/components/dashboard/app-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDisagreementDirection, formatUnderwritingDecision } from "@/lib/audits/report";
import { getAnalyticsData, getAuditData } from "@/lib/db/queries";

export default async function AnalyticsPage() {
  const [data, audits] = await Promise.all([getAnalyticsData(), getAuditData()]);
  const topDisagreements = audits.candidateRows.filter((row) => row.hasDisagreement).slice(0, 4);

  return (
    <AppShell
      title="Analytics"
      description="Review operator workload, stage movement, and the current health of the sponsorship pipeline across the active workspace."
    >
      <section className="grid gap-5 xl:grid-cols-3">
        {data.kpis.map((kpi) => (
          <KpiCard detail={kpi.detail} key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card aria-label="Decision audit summary" className="px-6 py-6" role="region">
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Decision audit summary</p>
              <p className="mt-1 text-sm text-ink-500">
                Pattern reporting for where the underwriting guardrail and operator judgment diverge.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href={"/audits" as Route}>Open audits</Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Compared files</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{audits.summary.comparedCandidates}</p>
              <p className="mt-2 text-sm text-ink-500">{audits.summary.humanDecisionCoverage}% human decision coverage</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Disagreement rate</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{audits.summary.disagreementRate}%</p>
              <p className="mt-2 text-sm text-ink-500">{audits.summary.disagreementCount} mismatched underwriting calls</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Human more optimistic</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{audits.summary.humanMoreOptimisticCount}</p>
              <p className="mt-2 text-sm text-ink-500">Cases where operators advanced more aggressively than the guardrail</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">System more optimistic</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{audits.summary.systemMoreOptimisticCount}</p>
              <p className="mt-2 text-sm text-ink-500">Cases where the local guardrail is more permissive than the operator</p>
            </div>
          </div>
        </Card>

        <Card aria-label="Disagreement queue" className="px-6 py-6" role="region">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Top disagreement queue</p>
            <p className="mt-1 text-sm text-ink-500">These files are the highest-signal candidates for a second review.</p>
          </div>
          <div className="mt-5 space-y-4">
            {topDisagreements.map((row) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={row.candidateId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      className="text-sm font-medium text-ink-900 hover:text-sage-700"
                      href={`/candidates/${row.candidateId}` as Route}
                    >
                      {row.displayName}
                    </Link>
                    <p className="mt-1 text-sm text-ink-500">{row.displayHeadline}</p>
                  </div>
                  <Badge
                    variant={
                      row.disagreementDirection === "aligned"
                        ? "sage"
                        : row.disagreementDirection === "human_more_optimistic"
                          ? "gold"
                          : "danger"
                    }
                  >
                    {formatDisagreementDirection(row.disagreementDirection)}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-ink-600">
                  System {formatUnderwritingDecision(row.systemDecision)} · Human{" "}
                  {formatUnderwritingDecision(row.humanDecision)}
                </p>
              </div>
            ))}
            {topDisagreements.length === 0 ? (
              <p className="text-sm text-ink-500">No current disagreement queue items.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card aria-label="Stage distribution" className="px-6 py-6" role="region">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Stage distribution</p>
            <p className="mt-1 text-sm text-ink-500">Current candidate load across the sponsorship workflow.</p>
          </div>
          <div className="mt-5 space-y-4">
            {data.stageBreakdown.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{item.label}</p>
                  <p className="font-serif text-3xl text-ink-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card aria-label="Queue ownership" className="px-6 py-6" role="region">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Operator queue ownership</p>
            <p className="mt-1 text-sm text-ink-500">Open and resolved alerts by workspace member.</p>
          </div>
          <div className="mt-5 space-y-4">
            {data.assigneeBreakdown.map((member) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={member.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{member.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="muted">{member.membershipRole}</Badge>
                      <Badge variant="muted">{member.role}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-ink-500">Open alerts</p>
                    <p className="font-serif text-3xl text-ink-900">{member.openAlerts}</p>
                    <p className="mt-2 text-sm text-ink-500">Resolved {member.resolvedAlerts}</p>
                    <p className="mt-2 text-sm text-ink-500">Open tasks {member.openTasks}</p>
                    <p className="mt-2 text-sm text-ink-500">Pipeline owned {member.activePipeline}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card aria-label="Reviewer calibration" className="px-6 py-6" role="region">
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Reviewer calibration</p>
              <p className="mt-1 text-sm text-ink-500">
                Compare each reviewer’s override pattern against the sponsor outcomes that eventually followed.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href={"/calibration" as Route}>Open workspace</Link>
            </Button>
          </div>
          <div className="mt-5 space-y-4">
            {data.reviewerCalibration.map((reviewer) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={reviewer.reviewerId}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{reviewer.reviewerName}</p>
                    <p className="mt-1 text-sm text-ink-500">
                      {reviewer.comparedFiles} compared files · {reviewer.knownOutcomeCount} known outcomes
                    </p>
                  </div>
                  <Badge
                    variant={
                      reviewer.status === "well_calibrated"
                        ? "sage"
                        : reviewer.status === "watch"
                          ? "danger"
                          : reviewer.status === "mixed"
                            ? "gold"
                            : "muted"
                    }
                  >
                    {reviewer.status.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Alignment</p>
                    <p className="mt-2 font-serif text-3xl text-ink-900">{reviewer.alignmentRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Disagreement</p>
                    <p className="mt-2 font-serif text-3xl text-ink-900">{reviewer.disagreementRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Optimistic wins</p>
                    <p className="mt-2 font-serif text-3xl text-ink-900">{reviewer.optimisticPositiveCount}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Optimistic misses</p>
                    <p className="mt-2 font-serif text-3xl text-ink-900">{reviewer.optimisticNegativeCount}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-ink-600">{reviewer.recommendation}</p>
              </div>
            ))}
            {data.reviewerCalibration.length === 0 ? (
              <p className="text-sm text-ink-500">No reviewer calibration history yet.</p>
            ) : null}
          </div>
        </Card>

        <Card aria-label="Outcome learning" className="px-6 py-6" role="region">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Outcome learning</p>
            <p className="mt-1 text-sm text-ink-500">
              Outcome-backed pattern learning by evidence depth and readiness bucket.
            </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Positive outcomes</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.outcomes.positive}</p>
              <p className="mt-2 text-sm text-ink-500">Paths that produced a favorable sponsor result</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Negative outcomes</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.outcomes.negative}</p>
              <p className="mt-2 text-sm text-ink-500">Paths that stalled, blocked, or closed without movement</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">In progress</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.outcomes.inProgress}</p>
              <p className="mt-2 text-sm text-ink-500">Sponsor paths with activity but no final outcome yet</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">No outcome signal</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.outcomes.none}</p>
              <p className="mt-2 text-sm text-ink-500">Files with no material sponsor result recorded yet</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {data.outcomeLearningPatterns.slice(0, 4).map((pattern) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={pattern.bucketLabel}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{pattern.bucketLabel}</p>
                    <p className="mt-1 text-sm text-ink-500">
                      {pattern.comparedFiles} compared files · {pattern.knownOutcomeCount} known outcomes
                    </p>
                  </div>
                  <Badge
                    variant={
                      pattern.severity === "caution"
                        ? "danger"
                        : pattern.severity === "positive"
                          ? "sage"
                          : pattern.severity === "watch"
                            ? "gold"
                            : "muted"
                    }
                  >
                    {pattern.severity}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{pattern.recommendation}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card aria-label="Decision quality" className="px-6 py-6" role="region">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Decision quality</p>
            <p className="mt-1 text-sm text-ink-500">
              False positives and false negatives from known sponsor outcomes. This is measured learning, not modeled ROI.
            </p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">System false positives</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.decisionQuality.systemFalsePositiveCount}</p>
              <p className="mt-2 text-sm text-ink-500">
                {data.decisionQuality.systemFalsePositiveRate}% of system advances with known outcomes turned negative
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">System false negatives</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.decisionQuality.systemFalseNegativeCount}</p>
              <p className="mt-2 text-sm text-ink-500">
                {data.decisionQuality.systemFalseNegativeRate}% of non-advance system calls later turned positive
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Human false positives</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.decisionQuality.humanFalsePositiveCount}</p>
              <p className="mt-2 text-sm text-ink-500">
                {data.decisionQuality.humanFalsePositiveRate}% of human advances with known outcomes turned negative
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Human false negatives</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.decisionQuality.humanFalseNegativeCount}</p>
              <p className="mt-2 text-sm text-ink-500">
                {data.decisionQuality.humanFalseNegativeRate}% of human holds or declines later turned positive
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-ink-600">
            {data.decisionQuality.knownOutcomeCount} files currently have known positive or negative sponsor outcomes.
          </p>
        </Card>

        <Card aria-label="Score recalibration" className="px-6 py-6" role="region">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Score recalibration</p>
            <p className="mt-1 text-sm text-ink-500">
              Transparent suggestions for where the score threshold should tighten, loosen, or stay unchanged.
            </p>
          </div>
          <div className="mt-5 space-y-4">
            {data.recalibrationSuggestions.map((suggestion) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={suggestion.bucketLabel}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900">{suggestion.bucketLabel}</p>
                    <p className="mt-1 text-sm text-ink-500">
                      {suggestion.knownOutcomeCount} known outcomes · {suggestion.falsePositiveCount} false positives ·{" "}
                      {suggestion.falseNegativeCount} false negatives
                    </p>
                  </div>
                  <Badge
                    variant={
                      suggestion.direction === "tighten"
                        ? "danger"
                        : suggestion.direction === "loosen"
                          ? "sage"
                          : "muted"
                    }
                  >
                    {suggestion.direction}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{suggestion.recommendation}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="px-6 py-6">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Recent stage events</p>
          <p className="mt-1 text-sm text-ink-500">Latest automated changes, manual overrides, and automation resumes.</p>
        </div>
        <div className="mt-5 space-y-4">
          {data.recentStageEvents.map((event) => (
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={event.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{event.candidate.fullName}</p>
                  <p className="mt-1 text-sm text-ink-500">{event.eventType.replaceAll("_", " ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.fromStage ? <Badge variant="muted">{event.fromStage.replaceAll("_", " ")}</Badge> : null}
                  {event.toStage ? <Badge variant="sage">{event.toStage.replaceAll("_", " ")}</Badge> : null}
                  <Badge variant="muted">{event.createdAtLabel}</Badge>
                </div>
              </div>
              <p className="mt-3 text-sm leading-7 text-ink-600">{event.rationale}</p>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
