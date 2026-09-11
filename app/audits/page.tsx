import Link from "next/link";
import type { Route } from "next";

import { DisagreementReviewControls } from "@/components/audits/disagreement-review-controls";
import { formatDisagreementDirection, formatUnderwritingDecision } from "@/lib/audits/report";
import { AppShell } from "@/components/dashboard/app-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAuditData } from "@/lib/db/queries";

function disagreementVariant(direction: ReturnType<typeof formatDisagreementDirection>) {
  if (direction === "Human more optimistic") {
    return "gold" as const;
  }

  if (direction === "System more optimistic") {
    return "danger" as const;
  }

  if (direction === "Aligned") {
    return "sage" as const;
  }

  return "muted" as const;
}

export default async function AuditsPage() {
  const data = await getAuditData();
  const disagreements = data.candidateRows.filter((row) => row.hasDisagreement);

  return (
    <AppShell
      title="Decision audits"
      description="Inspect where operator judgments diverge from the current underwriting guardrail and review decision patterns without pretending the system is inherently fair."
      actions={
        <>
          <Button asChild size="sm" variant="secondary">
            <Link href={"/api/audits/export?format=json" as Route}>Export JSON</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href={"/api/audits/export?format=csv" as Route}>Export CSV</Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-5 xl:grid-cols-6">
        <KpiCard detail="Files with a human underwriting decision" label="Compared" value={data.summary.comparedCandidates} />
        <KpiCard detail="Human vs system underwriting mismatch" label="Disagreements" value={data.summary.disagreementCount} />
        <KpiCard detail="Human advanced more aggressively" label="Human optimistic" value={data.summary.humanMoreOptimisticCount} />
        <KpiCard detail="System advanced more aggressively" label="System optimistic" value={data.summary.systemMoreOptimisticCount} />
        <KpiCard detail="Candidates without a logged human underwriting call" label="No human decision" value={data.summary.noHumanDecisionCount} />
        <KpiCard detail="Share of compared files with disagreement" label="Disagreement rate" value={`${data.summary.disagreementRate}%`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Reviewer disagreement</p>
            <p className="mt-1 text-sm text-ink-500">
              These files deserve a second look because the logged operator decision and the current evidence guardrail do not point the same way.
            </p>
          </div>
          <div className="mt-5 space-y-4">
            {disagreements.slice(0, 6).map((row) => (
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
                  <Badge variant={disagreementVariant(formatDisagreementDirection(row.disagreementDirection))}>
                    {formatDisagreementDirection(row.disagreementDirection)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="muted">Stage {row.stage.replaceAll("_", " ")}</Badge>
                  <Badge variant="muted">Readiness {row.readinessScore}</Badge>
                  <Badge variant="muted">System {formatUnderwritingDecision(row.systemDecision)}</Badge>
                  <Badge variant="muted">Human {formatUnderwritingDecision(row.humanDecision)}</Badge>
                  {row.disagreementReview?.autoTriggered ? <Badge variant="gold">Auto-triggered</Badge> : null}
                  {typeof row.disagreementReview?.riskScore === "number" && row.disagreementReview.riskScore > 0 ? (
                    <Badge variant="muted">Risk {row.disagreementReview.riskScore}</Badge>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-7 text-ink-600">{row.systemRationale}</p>
                {row.humanDecisionRationale ? (
                  <p className="mt-3 text-sm leading-7 text-ink-500">{row.humanDecisionRationale}</p>
                ) : null}
                {row.disagreementReview?.triggerReason ? (
                  <p className="mt-3 text-sm leading-7 text-ink-500">{row.disagreementReview.triggerReason}</p>
                ) : null}
                <div className="mt-4">
                  <DisagreementReviewControls
                    candidateId={row.candidateId}
                    existingReview={row.disagreementReview}
                    hasActiveDisagreement={row.hasDisagreement}
                    teamMembers={data.teamMembers.map((member) => ({
                      id: member.id,
                      name: member.name,
                      role: member.role,
                    }))}
                  />
                </div>
              </div>
            ))}
            {disagreements.length === 0 ? (
              <p className="text-sm text-ink-500">No current human-vs-system underwriting disagreements are recorded.</p>
            ) : null}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Audit caveats</p>
            <p className="mt-1 text-sm text-ink-500">
              This view is for inspection and challenge. It should not be mistaken for a mathematical fairness guarantee.
            </p>
          </div>
          <div className="mt-5 space-y-4">
            {data.caveats.map((caveat) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={caveat}>
                <p className="text-sm leading-7 text-ink-600">{caveat}</p>
              </div>
            ))}
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Coverage</p>
              <p className="mt-2 text-sm leading-7 text-ink-500">
                Human underwriting coverage is {data.summary.humanDecisionCoverage}% across the current workspace.
                {data.safetySettings.blindReviewMode ? " Blind review masking is currently on for live candidate review surfaces." : " Blind review masking is currently off."}
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Decision patterns by stage</p>
            <p className="mt-1 text-sm text-ink-500">Useful for spotting where workflow state may be influencing the decision style.</p>
          </div>
          <div className="mt-5 space-y-4">
            {data.patternBreakdowns.stage.map((row) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={row.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{row.label}</p>
                  <Badge variant="muted">{row.totalCandidates} files</Badge>
                </div>
                <p className="mt-3 text-sm text-ink-500">
                  {row.disagreementRate}% disagreement across {row.comparedCandidates} compared decisions
                </p>
                <p className="mt-2 text-sm text-ink-600">
                  System: {row.systemAdvance} advance · {row.systemHold} hold · {row.systemDoNotAdvance} do not advance
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  Human: {row.humanAdvance} advance · {row.humanHold} hold · {row.humanDoNotAdvance} do not advance
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Decision patterns by evidence depth</p>
            <p className="mt-1 text-sm text-ink-500">Shows whether thin files are getting advanced more aggressively than the proof base supports.</p>
          </div>
          <div className="mt-5 space-y-4">
            {data.patternBreakdowns.evidenceDepth.map((row) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={row.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{row.label}</p>
                  <Badge variant="muted">Avg readiness {row.averageReadinessScore}</Badge>
                </div>
                <p className="mt-3 text-sm text-ink-500">
                  {row.disagreementRate}% disagreement across {row.comparedCandidates} compared decisions
                </p>
                <p className="mt-2 text-sm text-ink-600">
                  System: {row.systemAdvance} / {row.systemHold} / {row.systemDoNotAdvance}
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  Human: {row.humanAdvance} / {row.humanHold} / {row.humanDoNotAdvance}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Decision patterns by review state</p>
            <p className="mt-1 text-sm text-ink-500">Shows whether flagged or pending review states are still drifting into optimistic decisions.</p>
          </div>
          <div className="mt-5 space-y-4">
            {data.patternBreakdowns.reviewState.map((row) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={row.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{row.label}</p>
                  <Badge variant="muted">{row.noHumanDecisionCount} without human call</Badge>
                </div>
                <p className="mt-3 text-sm text-ink-500">
                  {row.disagreementRate}% disagreement across {row.comparedCandidates} compared decisions
                </p>
                <p className="mt-2 text-sm text-ink-600">
                  System: {row.systemAdvance} advance · {row.systemHold} hold · {row.systemDoNotAdvance} do not advance
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  Human: {row.humanAdvance} advance · {row.humanHold} hold · {row.humanDoNotAdvance} do not advance
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Decision patterns by region</p>
            <p className="mt-1 text-sm text-ink-500">Use this to inspect concentration patterns, not to infer fairness conclusions by itself.</p>
          </div>
          <div className="mt-5 space-y-4">
            {data.patternBreakdowns.region.map((row) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={row.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{row.label}</p>
                  <Badge variant="muted">{row.totalCandidates} files</Badge>
                </div>
                <p className="mt-3 text-sm text-ink-500">
                  {row.disagreementRate}% disagreement across {row.comparedCandidates} compared decisions
                </p>
                <p className="mt-2 text-sm text-ink-600">
                  System: {row.systemAdvance} advance · {row.systemHold} hold · {row.systemDoNotAdvance} do not advance
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  Human: {row.humanAdvance} advance · {row.humanHold} hold · {row.humanDoNotAdvance} do not advance
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="px-6 py-6">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Candidate-level audit table</p>
          <p className="mt-1 text-sm text-ink-500">Every row is inspectable, exportable, and grounded in the same guardrail logic used on the candidate detail view.</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-100 text-left text-sm">
            <thead className="text-ink-500">
              <tr>
                <th className="pb-3 pr-4 font-medium">Candidate</th>
                <th className="pb-3 pr-4 font-medium">Stage</th>
                <th className="pb-3 pr-4 font-medium">System</th>
                <th className="pb-3 pr-4 font-medium">Human</th>
                <th className="pb-3 pr-4 font-medium">Direction</th>
                <th className="pb-3 pr-4 font-medium">Trigger</th>
                <th className="pb-3 pr-4 font-medium">Proof depth</th>
                <th className="pb-3 pr-4 font-medium">Support</th>
                <th className="pb-3 font-medium">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {data.candidateRows.map((row) => (
                <tr key={row.candidateId}>
                  <td className="py-4 pr-4 align-top">
                    <Link
                      className="font-medium text-ink-900 hover:text-sage-700"
                      href={`/candidates/${row.candidateId}` as Route}
                    >
                      {row.displayName}
                    </Link>
                    <p className="mt-1 text-ink-500">{row.displayHeadline}</p>
                  </td>
                  <td className="py-4 pr-4 align-top text-ink-600">{row.stage.replaceAll("_", " ")}</td>
                  <td className="py-4 pr-4 align-top">
                    <Badge
                      variant={
                        row.systemDecision === "advance"
                          ? "sage"
                          : row.systemDecision === "hold"
                            ? "gold"
                            : "danger"
                      }
                    >
                      {formatUnderwritingDecision(row.systemDecision)}
                    </Badge>
                  </td>
                  <td className="py-4 pr-4 align-top">
                    <Badge
                      variant={
                        row.humanDecision === "advance"
                          ? "sage"
                          : row.humanDecision === "hold"
                            ? "gold"
                            : row.humanDecision === "do_not_advance"
                              ? "danger"
                              : "muted"
                      }
                    >
                      {formatUnderwritingDecision(row.humanDecision)}
                    </Badge>
                    {row.humanDecisionAtLabel ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">{row.humanDecisionAtLabel}</p>
                    ) : null}
                  </td>
                  <td className="py-4 pr-4 align-top">
                    <Badge variant={disagreementVariant(formatDisagreementDirection(row.disagreementDirection))}>
                      {formatDisagreementDirection(row.disagreementDirection)}
                    </Badge>
                  </td>
                  <td className="py-4 pr-4 align-top text-ink-600">
                    {row.disagreementReview?.autoTriggered
                      ? `Auto · ${row.disagreementReview.riskScore ?? 0}`
                      : row.disagreementReview
                        ? "Manual"
                        : "None"}
                  </td>
                  <td className="py-4 pr-4 align-top text-ink-600">
                    <p>{row.evidenceDepth}</p>
                    <p className="mt-1 text-ink-500">{row.artifactCount} artifacts · {row.claimCount} claims</p>
                  </td>
                  <td className="py-4 pr-4 align-top text-ink-600">
                    <p>{row.supportCoverage}% cited support</p>
                    <p className="mt-1 text-ink-500">{row.missingProofCount} gaps · {row.cautionFlagCount} cautions</p>
                  </td>
                  <td className="py-4 align-top text-ink-600">
                    <p>{row.reviewState.replaceAll("_", " ")}</p>
                    {row.disagreementReview ? (
                      <p className="mt-1 text-ink-500">
                        Audit {String(row.disagreementReview.status).replaceAll("_", " ").toLowerCase()}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
