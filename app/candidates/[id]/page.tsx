import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { ArrowUpRight, MapPin, Network, Sparkles } from "lucide-react";

import { StageOverrideControls } from "@/components/alerts/stage-override-controls";
import { OperatorAlertControls } from "@/components/alerts/operator-alert-controls";
import { DisagreementReviewControls } from "@/components/audits/disagreement-review-controls";
import { CandidateActions } from "@/components/candidate/candidate-actions";
import { CommitteeReviewControls } from "@/components/candidate/committee-review-controls";
import { CandidateDecisionForm } from "@/components/candidate/candidate-decision-form";
import { CandidateNoteForm } from "@/components/candidate/candidate-note-form";
import { CandidateUpdateControls } from "@/components/candidate/candidate-update-controls";
import { CandidateUpdateForm } from "@/components/candidate/candidate-update-form";
import { BulkReviewWorkbench } from "@/components/candidate/bulk-review-workbench";
import { ProofRequestControls } from "@/components/candidate/proof-request-controls";
import { ProofRequestForm } from "@/components/candidate/proof-request-form";
import { ProgressTimeline } from "@/components/candidate/progress-timeline";
import { ReadinessTrendCard } from "@/components/candidate/readiness-trend-card";
import { AlertSeverityBadge } from "@/components/dashboard/alert-severity-badge";
import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { ReviewControls } from "@/components/candidate/review-controls";
import { AppShell } from "@/components/dashboard/app-shell";
import { ReviewBadge } from "@/components/dashboard/review-badge";
import { ScoreBreakdownCard } from "@/components/dashboard/score-breakdown-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TrajectoryBadge } from "@/components/dashboard/trajectory-badge";
import { ArtifactCreateForm } from "@/components/forms/artifact-create-form";
import { MemoDocument } from "@/components/memo/memo-document";
import { PipelineStageControls } from "@/components/pipeline/pipeline-stage-controls";
import { TaskControls } from "@/components/tasks/task-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDisagreementDirection, formatUnderwritingDecision } from "@/lib/audits/report";
import { CANDIDATE_UPDATE_STATUS_LABELS } from "@/lib/candidate-updates";
import { getCandidateDetail } from "@/lib/db/queries";
import { formatDate, formatSignedNumber } from "@/lib/utils/format";
import { titleCase } from "@/lib/utils/strings";

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

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const data = await getCandidateDetail(id);

  if (!data) {
    notFound();
  }

  const bestSponsorRecommendationById = new Map(
    data.recommendations.bestSponsors.map((item) => [item.sponsorId, item]),
  );
  const warmPathRecommendationById = new Map(
    data.recommendations.warmPaths.map((item) => [item.sponsorId, item]),
  );
  const opportunityBriefBySponsorId = new Map(
    data.opportunityBriefs.map((brief) => [brief.sponsorId, brief]),
  );
  const topSponsorScore = data.sponsorMatches[0]?.result.score ?? 0;
  const hasStrongSponsorMatch = topSponsorScore >= 60;
  const candidateTabs = new Set(["evidence", "memo", "sponsors", "briefs", "trajectory", "workflow", "actions"]);
  const initialTab = candidateTabs.has(resolvedSearchParams.tab ?? "") ? resolvedSearchParams.tab! : "evidence";

  return (
    <AppShell
      title={data.candidateDisplay.displayName}
      description={data.candidateDisplay.displayHeadline}
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href={`/briefs/${data.candidate.id}` as Route}>
              Opportunity briefs
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/packets/${data.candidate.id}`}>
              Internal packet
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/memos/${data.candidate.id}`}>
              Printable memo
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/candidates/compare?ids=${data.candidate.id}` as Route}>
              Compare
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <CandidateActions
            candidateId={data.candidate.id}
            staleRecommendationCount={data.recommendationFreshnessSummary.stale}
            watchRecommendationCount={data.recommendationFreshnessSummary.watch}
          />
        </>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={data.readiness.status} />
                <Badge variant="muted">{data.candidate.currentStage.replaceAll("_", " ")}</Badge>
                <Badge variant="muted">
                  <MapPin className="mr-1 h-3.5 w-3.5" />
                  {data.candidateDisplay.displayRegion}
                </Badge>
                {data.safetySettings.blindReviewMode ? <Badge variant="gold">Blind review</Badge> : null}
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-ink-600">{data.candidate.bio}</p>
            </div>
            <div className="rounded-[2rem] bg-ink-900 px-5 py-4 text-right text-white">
              <p className="text-sm uppercase tracking-[0.2em] text-white/60">Readiness</p>
              <p className="mt-2 font-serif text-5xl">{data.readiness.score}</p>
              <p className="mt-3 text-sm text-white/70">{formatSignedNumber(data.trajectory.deltaFromStart)} since intake</p>
              <div className="mt-3 flex justify-end">
                <TrajectoryBadge momentum={data.trajectory.momentum} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Artifacts</p>
              <p className="mt-2 font-serif text-4xl text-ink-900">{data.candidate.artifacts.length}</p>
            </div>
            <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Claims</p>
              <p className="mt-2 font-serif text-4xl text-ink-900">{data.candidate.evidenceClaims.length}</p>
            </div>
            <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Top sponsor fit</p>
              <p className="mt-2 font-serif text-4xl text-ink-900">{data.sponsorMatches[0]?.result.score ?? 0}</p>
            </div>
            <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Human review</p>
              <div className="mt-3 flex items-center gap-2">
                <ReviewBadge status={data.overallReviewSummary.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                {data.overallReviewSummary.approved} approved · {data.overallReviewSummary.pending} pending ·{" "}
                {data.overallReviewSummary.flagged} flagged
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-[2rem] border border-ink-100 bg-white px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-900">Automation and alerts</p>
                <p className="mt-1 text-sm text-ink-500">
                  Current stage is maintained from readiness, review friction, trajectory movement, and sponsor-path activity.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="muted">{data.candidate.currentStage.replaceAll("_", " ")}</Badge>
                {data.candidate.automationMode === "MANUAL_OVERRIDE" ? (
                  <Badge variant="danger">Manual override</Badge>
                ) : (
                  <Badge variant="sage">Automation on</Badge>
                )}
                {data.operatorAlerts.length > 0 ? (
                  <Badge variant="danger">{data.operatorAlerts.length} open alerts</Badge>
                ) : (
                  <Badge variant="sage">No open alerts</Badge>
                )}
              </div>
            </div>
            <div className="mt-4">
              <StageOverrideControls
                automationMode={data.candidate.automationMode}
                candidateId={data.candidate.id}
                currentStage={data.candidate.currentStage}
                initialNote={data.candidate.automationNote}
              />
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <ScoreBreakdownCard
            breakdown={data.readiness.breakdown}
            score={data.readiness.score}
            title="Sponsor readiness breakdown"
          />
          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Evidence discipline</p>
              <p className="mt-1 text-sm text-ink-500">
                Guardrails keep the file willing to say hold or do not advance when proof is weak or unsupported.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge
                variant={
                  data.safetyReport.decision === "advance"
                    ? "sage"
                    : data.safetyReport.decision === "hold"
                      ? "gold"
                      : "danger"
                }
              >
                {data.safetyReport.decision.replaceAll("_", " ")}
              </Badge>
              <Badge variant="muted">{data.safetyReport.supportCoverage}% memo support coverage</Badge>
              <Badge variant="muted">{data.safetyReport.citationCoverage}% citation coverage</Badge>
              <Badge variant="muted">{data.safetyReport.thirdPartyArtifactCount} third-party artifacts</Badge>
              <Badge variant="muted">{data.safetyReport.sourceQualityScore}/10 source quality</Badge>
              <Badge variant="muted">{data.safetyReport.evidenceFreshnessScore}/10 freshness</Badge>
              <Badge variant="muted">
                {data.safetyReport.sponsorFacingContactDetailCount} sponsor-facing contact details
              </Badge>
              {data.proofRequests.filter((request) => request.status === "OPEN" || request.status === "IN_PROGRESS").length > 0 ? (
                <Badge variant="gold">
                  {
                    data.proofRequests.filter(
                      (request) => request.status === "OPEN" || request.status === "IN_PROGRESS",
                    ).length
                  }{" "}
                  open proof requests
                </Badge>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-7 text-ink-600">{data.safetyReport.rationale}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Missing proof</p>
                <div className="mt-3 space-y-2">
                  {data.safetyReport.missingProof.map((item) => (
                    <p className="text-sm leading-6 text-ink-600" key={item}>
                      {item}
                    </p>
                  ))}
                  {data.safetyReport.missingProof.length === 0 ? (
                    <p className="text-sm leading-6 text-ink-500">No major proof gaps detected.</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Caution flags</p>
                <div className="mt-3 space-y-2">
                  {data.safetyReport.cautionFlags.map((item) => (
                    <p className="text-sm leading-6 text-ink-600" key={item}>
                      {item}
                    </p>
                  ))}
                  {data.safetyReport.cautionFlags.length === 0 ? (
                    <p className="text-sm leading-6 text-ink-500">No major caution flags detected.</p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Stale artifacts</p>
                <p className="mt-2 font-serif text-3xl text-ink-900">{data.safetyReport.staleArtifactCount}</p>
                <p className="mt-2 text-sm text-ink-500">Artifacts older than one year.</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Oldest artifact</p>
                <p className="mt-2 font-serif text-3xl text-ink-900">{data.safetyReport.oldestArtifactAgeDays}</p>
                <p className="mt-2 text-sm text-ink-500">Days since the oldest artifact was updated.</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Duplicate claims</p>
                <p className="mt-2 font-serif text-3xl text-ink-900">{data.safetyReport.duplicateClaimCount}</p>
                <p className="mt-2 text-sm text-ink-500">Repeated extracted claims that can inflate confidence.</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Uncited statements</p>
                <p className="mt-2 font-serif text-3xl text-ink-900">{data.safetyReport.uncitedStatementCount}</p>
                <p className="mt-2 text-sm text-ink-500">Sponsor-facing sentences still missing explicit artifact citations.</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Contact details</p>
                <p className="mt-2 font-serif text-3xl text-ink-900">{data.safetyReport.sponsorFacingContactDetailCount}</p>
                <p className="mt-2 text-sm text-ink-500">Sponsor-facing email addresses or phone numbers still needing redaction.</p>
              </div>
            </div>
            {data.safetyReport.unsupportedStatements.length > 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4">
                <p className="text-sm font-medium text-rose-900">Statements needing evidence review</p>
                <div className="mt-3 space-y-2">
                  {data.safetyReport.unsupportedStatements.map((item) => (
                    <p className="text-sm leading-6 text-rose-800" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {data.safetyReport.uncitedStatements?.length > 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-medium text-amber-900">Statements still missing explicit citations</p>
                <div className="mt-3 space-y-2">
                  {data.safetyReport.uncitedStatements.map((item) => (
                    <p className="text-sm leading-6 text-amber-900" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {data.safetyReport.invalidCitations?.length > 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-medium text-amber-900">Invalid citation labels</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.safetyReport.invalidCitations.map((item) => (
                    <Badge key={item} variant="muted">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {data.safetyReport.sponsorFacingContactDetails?.length > 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4">
                <p className="text-sm font-medium text-rose-900">Contact details still exposed in sponsor-facing text</p>
                <div className="mt-3 space-y-2">
                  {data.safetyReport.sponsorFacingContactDetails.map((item) => (
                    <p className="text-sm leading-6 text-rose-800" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {data.safetyReport.internalContactDetails?.length > 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-medium text-amber-900">Internal source artifacts still contain contact details</p>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  Keep sponsor-facing exports redacted even if the internal file preserves the original source text.
                </p>
                <div className="mt-3 space-y-2">
                  {data.safetyReport.internalContactDetails.map((item) => (
                    <p className="text-sm leading-6 text-amber-900" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {data.safetyReport.potentialContradictions.length > 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-medium text-amber-900">Potential contradictions</p>
                <div className="mt-3 space-y-2">
                  {data.safetyReport.potentialContradictions.map((item) => (
                    <p className="text-sm leading-6 text-amber-900" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            {data.safetyReport.blockingContradictions?.length > 0 ? (
              <div className="mt-4 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4">
                <p className="text-sm font-medium text-rose-900">Blocking contradictions</p>
                <div className="mt-3 space-y-2">
                  {data.safetyReport.blockingContradictions.map((item) => (
                    <p className="text-sm leading-6 text-rose-800" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Operator vs guardrail</p>
              <p className="mt-1 text-sm text-ink-500">
                Compare the latest human underwriting call to the current evidence guardrail before moving the file.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge
                variant={
                  data.decisionAudit.systemDecision === "advance"
                    ? "sage"
                    : data.decisionAudit.systemDecision === "hold"
                      ? "gold"
                      : "danger"
                }
              >
                System {formatUnderwritingDecision(data.decisionAudit.systemDecision)}
              </Badge>
              <Badge
                variant={
                  data.decisionAudit.humanDecision === "advance"
                    ? "sage"
                    : data.decisionAudit.humanDecision === "hold"
                      ? "gold"
                      : data.decisionAudit.humanDecision === "do_not_advance"
                        ? "danger"
                        : "muted"
                }
              >
                Human {formatUnderwritingDecision(data.decisionAudit.humanDecision)}
              </Badge>
              <Badge
                variant={
                  data.decisionAudit.disagreementDirection === "aligned"
                    ? "sage"
                    : data.decisionAudit.disagreementDirection === "human_more_optimistic"
                      ? "gold"
                      : data.decisionAudit.disagreementDirection === "system_more_optimistic"
                        ? "danger"
                        : "muted"
                }
              >
                {formatDisagreementDirection(data.decisionAudit.disagreementDirection)}
              </Badge>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Guardrail read</p>
                <p className="mt-3 text-sm leading-7 text-ink-600">{data.decisionAudit.systemRationale}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Latest human decision</p>
                {data.decisionAudit.humanDecisionSummary ? (
                  <>
                    <p className="mt-3 text-sm text-ink-700">{data.decisionAudit.humanDecisionSummary}</p>
                    <p className="mt-2 text-sm leading-7 text-ink-500">{data.decisionAudit.humanDecisionRationale}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">
                      {data.decisionAudit.humanDecidedByName ?? "Operator"} ·{" "}
                      {data.decisionAudit.humanDecisionAtLabel ?? "Date unavailable"}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-ink-500">
                    No underwriting decision has been logged yet for this candidate.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <DisagreementReviewControls
                candidateId={data.candidate.id}
                existingReview={data.activeDisagreementReview}
                hasActiveDisagreement={data.decisionAudit.hasDisagreement}
                teamMembers={data.teamMembers.map((member) => ({
                  id: member.id,
                  name: member.name,
                  role: member.role,
                }))}
              />
            </div>
          </Card>
          {data.learningInsight ? (
            <Card className="px-5 py-5">
              <div className="border-b border-ink-100 pb-4">
                <p className="text-sm font-medium text-ink-900">Outcome learning</p>
                <p className="mt-1 text-sm text-ink-500">
                  Similar files in this workspace have already produced sponsor outcomes. Use that history to pressure-test the current threshold.
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge
                  variant={
                    data.learningInsight.severity === "caution"
                      ? "danger"
                      : data.learningInsight.severity === "positive"
                        ? "sage"
                        : data.learningInsight.severity === "watch"
                          ? "gold"
                          : "muted"
                  }
                >
                  {data.learningInsight.severity}
                </Badge>
                <Badge variant="muted">{data.learningInsight.bucketLabel}</Badge>
                <Badge variant="muted">{data.learningInsight.knownOutcomeCount} known outcomes</Badge>
              </div>
              <p className="mt-4 text-sm leading-7 text-ink-600">{data.learningInsight.recommendation}</p>
            </Card>
          ) : null}
        </div>
      </section>

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="memo">Memo</TabsTrigger>
          <TabsTrigger value="sponsors">Sponsor fit</TabsTrigger>
          <TabsTrigger value="briefs">Briefs</TabsTrigger>
          <TabsTrigger value="trajectory">Trajectory</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="evidence">
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              {data.claimsByArtifact.map(({ artifact, claims }) => (
                <Card className="px-5 py-5" id={`artifact-${artifact.id}`} key={artifact.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="muted">{artifact.artifactType.replaceAll("_", " ")}</Badge>
                        <Badge variant={artifact.isCurrentVersion ? "sage" : "muted"}>
                          {artifact.isCurrentVersion ? `Current v${artifact.versionNumber}` : `Archived v${artifact.versionNumber}`}
                        </Badge>
                        {artifact.supersedesArtifact ? (
                          <Badge variant="gold">Replaces {artifact.supersedesArtifact.title}</Badge>
                        ) : null}
                        <span className="text-xs uppercase tracking-[0.18em] text-ink-400">
                          {formatDate(artifact.createdAt)}
                        </span>
                        {artifact.storedFile ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/api/storage/${artifact.storedFile.id}` as Route}>
                              Download original
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                      <h2 className="mt-3 font-serif text-3xl text-ink-900">{artifact.title}</h2>
                      <p className="mt-2 text-sm text-ink-500">{artifact.sourceLabel}</p>
                      {artifact.storedFile ? (
                        <p className="mt-2 text-sm text-ink-500">
                          Original file stored as {artifact.storedFile.originalFileName} for operator inspection.
                        </p>
                      ) : null}
                      {artifact.replacementArtifacts.length > 0 ? (
                        <p className="mt-2 text-sm text-ink-500">
                          Superseded by {artifact.replacementArtifacts[0].title} · v{artifact.replacementArtifacts[0].versionNumber}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-5 text-sm leading-7 text-ink-600">{artifact.rawText}</p>

                  <div className="mt-6 space-y-4">
                    {claims.length > 0 ? (
                      claims.map((claim) => (
                        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={claim.id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="sage">{titleCase(claim.category)}</Badge>
                              <ReviewBadge status={claim.reviewStatus} />
                            </div>
                            <span className="text-xs uppercase tracking-[0.18em] text-ink-400">
                              Confidence {Math.round(claim.confidence * 100)}%
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-7 text-ink-700">{claim.claim}</p>
                          <p className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm italic leading-7 text-ink-500">
                            &ldquo;{claim.supportingExcerpt}&rdquo;
                          </p>
                          {claim.reviewNote ? (
                            <p className="mt-3 text-sm leading-7 text-ink-500">{claim.reviewNote}</p>
                          ) : null}
                          <ReviewControls
                            entityType="claim"
                            initialNote={claim.reviewNote}
                            initialStatus={claim.reviewStatus}
                            itemId={claim.id}
                          />
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ink-500">No extracted claims yet for this artifact.</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <div className="space-y-5">
              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Operator review state</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Human review stays separate from model output and is visible across evidence and recommendations.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink-900">Evidence claims</p>
                      <ReviewBadge status={data.claimReviewSummary.status} />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-ink-500">
                      {data.claimReviewSummary.approved} approved · {data.claimReviewSummary.pending} pending ·{" "}
                      {data.claimReviewSummary.flagged} flagged
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink-900">Recommendations</p>
                      <ReviewBadge status={data.recommendationReviewSummary.status} />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-ink-500">
                      {data.recommendationReviewSummary.approved} approved · {data.recommendationReviewSummary.pending} pending
                      {" "}· {data.recommendationReviewSummary.flagged} flagged
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink-900">Recommendation drift</p>
                      <Badge variant={getFreshnessVariant(data.recommendationFreshnessSummary.label)}>
                        {data.recommendationFreshnessSummary.label}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-ink-500">
                      {data.recommendationFreshnessSummary.summary}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-ink-500">
                      {data.recommendationFreshnessSummary.fresh} fresh · {data.recommendationFreshnessSummary.watch} watch ·{" "}
                      {data.recommendationFreshnessSummary.stale} stale
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                    <p className="text-sm font-medium text-ink-900">Flagged items</p>
                    <div className="mt-3 space-y-3">
                      {data.flaggedReviewItems.length > 0 ? (
                        data.flaggedReviewItems.map((item) => (
                          <div key={item.id}>
                            <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{item.kind}</p>
                            <p className="mt-1 text-sm leading-6 text-ink-700">{item.label}</p>
                            {item.note ? <p className="mt-1 text-sm leading-6 text-ink-500">{item.note}</p> : null}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-ink-500">No flagged items right now.</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <ArtifactCreateForm candidateId={data.candidate.id} replaceableArtifacts={data.replaceableArtifacts} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="memo">
          {data.memo ? (
            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <MemoDocument
                candidateName={data.candidateDisplay.displayName}
                rationale={data.memo.rationale}
                recommendedAction={data.memo.recommendedAction}
                risks={data.memo.risksList}
                status={data.memo.status}
                strengths={data.memo.strengthsList}
                summary={data.memo.summary}
              />

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
                      <Network className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-900">Memo traceability</p>
                      <p className="text-sm text-ink-500">Inspect the strongest claims behind the memo language.</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-4">
                  {data.traceability.map((claim) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={claim.id}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="muted">{titleCase(claim.category)}</Badge>
                        <Badge variant="sage">{claim.artifactTitle}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-ink-700">{claim.claim}</p>
                      <p className="mt-3 text-sm italic leading-7 text-ink-500">
                        &ldquo;{claim.supportingExcerpt}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <Card className="px-6 py-8">
              <p className="font-medium text-ink-900">No sponsor memo yet</p>
              <p className="mt-3 text-sm leading-7 text-ink-500">
                Run evidence extraction and memo generation to produce a sponsor-ready one-page review.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sponsors">
          {!hasStrongSponsorMatch ? (
            <Card className="mb-5 px-5 py-5">
              <p className="text-sm font-medium text-ink-900">No strong sponsor target yet</p>
              <p className="mt-3 text-sm leading-7 text-ink-600">
                The current evidence profile does not yet produce a high-conviction sponsor match. Use the monitored targets below as directional fits, but strengthen proof before formal outreach.
              </p>
            </Card>
          ) : null}
          <div className="grid gap-5 xl:grid-cols-2">
            {data.sponsorMatches.slice(0, 4).map((match) => (
              <Card className="px-5 py-5" key={match.sponsor.id}>
                <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
                  <div>
                    <p className="font-serif text-3xl text-ink-900">{match.sponsor.fullName}</p>
                    <p className="mt-2 text-sm text-ink-500">
                      {match.sponsor.title} · {match.sponsor.organization}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-4xl text-ink-900">{match.result.score}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Match score</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {Object.entries(match.result.breakdown).map(([key, value]) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={key}>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{titleCase(key)}</p>
                      <p className="mt-2 font-serif text-3xl text-ink-900">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={getRightNowVariant(match.result.rightNowLabel)}>{match.result.rightNowLabel}</Badge>
                  <Badge variant="muted">Base fit {match.result.baseFitScore}</Badge>
                  <Badge variant={match.result.operationalDelta >= 0 ? "sage" : "gold"}>
                    Ops {match.result.operationalDelta >= 0 ? "+" : ""}
                    {match.result.operationalDelta}
                  </Badge>
                </div>
                <p className="mt-4 text-sm leading-7 text-ink-600">{match.result.rightNowSummary}</p>
                <p className="mt-4 text-sm leading-7 text-ink-500">
                  Operating context: {match.result.operatingProfile.activePipelineCount} active paths,{" "}
                  {match.result.operatingProfile.completedExternalActions} completed sponsor actions,{" "}
                  {match.result.operatingProfile.positiveOutcomes} positive outcomes.
                </p>

                <div className="mt-5 rounded-[1.5rem] bg-ink-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-900">Why this sponsor fits</p>
                    {bestSponsorRecommendationById.get(match.sponsor.id) ? (
                      <ReviewBadge status={bestSponsorRecommendationById.get(match.sponsor.id)!.reviewStatus} />
                    ) : null}
                  </div>
                  {bestSponsorRecommendationById.get(match.sponsor.id)?.freshness ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge
                        variant={getFreshnessVariant(bestSponsorRecommendationById.get(match.sponsor.id)?.freshness.label)}
                      >
                        {bestSponsorRecommendationById.get(match.sponsor.id)?.freshness.label}
                      </Badge>
                      <Badge variant="muted">
                        Live {bestSponsorRecommendationById.get(match.sponsor.id)?.freshness.currentScore}/100
                      </Badge>
                      <Badge
                        variant={
                          (bestSponsorRecommendationById.get(match.sponsor.id)?.freshness.scoreDrift ?? 0) >= 0
                            ? "sage"
                            : "gold"
                        }
                      >
                        Drift {(bestSponsorRecommendationById.get(match.sponsor.id)?.freshness.scoreDrift ?? 0) >= 0 ? "+" : ""}
                        {bestSponsorRecommendationById.get(match.sponsor.id)?.freshness.scoreDrift ?? 0}
                      </Badge>
                    </div>
                  ) : null}
                  <p className="mt-3 text-sm leading-7 text-ink-600">
                    {bestSponsorRecommendationById.get(match.sponsor.id)?.explanation ??
                      "This sponsor has not yet received a generated recommendation explanation."}
                  </p>
                  {bestSponsorRecommendationById.get(match.sponsor.id)?.freshness ? (
                    <p className="mt-3 text-sm leading-7 text-ink-500">
                      {bestSponsorRecommendationById.get(match.sponsor.id)?.freshness.summary}
                    </p>
                  ) : null}
                  {bestSponsorRecommendationById.get(match.sponsor.id)?.reviewNote ? (
                    <p className="mt-3 text-sm leading-7 text-ink-500">
                      {bestSponsorRecommendationById.get(match.sponsor.id)?.reviewNote}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {opportunityBriefBySponsorId.get(match.sponsor.id) ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/briefs/${data.candidate.id}?sponsor=${match.sponsor.id}` as Route}>Open brief</Link>
                      </Button>
                    ) : null}
                    {opportunityBriefBySponsorId.get(match.sponsor.id) ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/outreach/${data.candidate.id}?sponsor=${match.sponsor.id}` as Route}>Outreach plan</Link>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/memos/${data.candidate.id}?sponsor=${match.sponsor.id}`}>Preview memo variant</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/packets/${data.candidate.id}?sponsor=${match.sponsor.id}`}>Open packet</Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.5rem] bg-ink-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-900">Warm path</p>
                    <Badge variant="muted">{match.warmPathInsight.confidence}/100 confidence</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {match.connectionPath.map((step) => (
                      <p className="text-sm leading-7 text-ink-600" key={step}>
                        {step}
                      </p>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-ink-500">{match.warmPathInsight.summary}</p>
                  <div className="mt-4 space-y-2">
                    {match.warmPathInsight.provenance.map((item) => (
                      <p className="text-sm leading-6 text-ink-500" key={item}>
                        {item}
                      </p>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-ink-500">
                    {warmPathRecommendationById.get(match.sponsor.id)?.actionSuggestion ??
                      "No additional proof gap has been recorded for this path yet."}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="briefs">
          {data.opportunityBriefs.length > 0 ? (
            <div className="grid gap-5 xl:grid-cols-2">
              {data.opportunityBriefs.map((brief) => (
                <Card className="px-5 py-5" key={brief.id}>
                  <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <BriefStatusBadge status={brief.status} />
                        <Badge variant="muted">{brief.opportunityType.replaceAll("_", " ")}</Badge>
                      </div>
                      <p className="mt-3 font-serif text-3xl text-ink-900">{brief.sponsor.fullName}</p>
                      <p className="mt-2 text-sm text-ink-500">
                        {brief.sponsor.title} · {brief.sponsor.organization}
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.18em] text-ink-400">
                      {formatDate(brief.updatedAt)}
                    </span>
                  </div>

                  <p className="mt-5 text-sm leading-7 text-ink-600">{brief.summary}</p>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                      <p className="text-sm font-medium text-ink-900">Talking points</p>
                      <div className="mt-3 space-y-2">
                        {brief.talkingPointsList.slice(0, 3).map((item) => (
                          <p className="text-sm leading-7 text-ink-600" key={item}>
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                      <p className="text-sm font-medium text-ink-900">Proof to bring</p>
                      <div className="mt-3 space-y-2">
                        {brief.proofToBringList.slice(0, 3).map((item) => (
                          <p className="text-sm leading-7 text-ink-600" key={item}>
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/briefs/${data.candidate.id}?sponsor=${brief.sponsorId}` as Route}>Open brief</Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/packets/${data.candidate.id}?sponsor=${brief.sponsorId}`}>Open packet</Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/outreach/${data.candidate.id}?sponsor=${brief.sponsorId}` as Route}>Outreach plan</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/memos/${data.candidate.id}?sponsor=${brief.sponsorId}`}>Memo variant</Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="px-6 py-8">
              <p className="font-medium text-ink-900">No opportunity briefs yet</p>
              <p className="mt-3 text-sm leading-7 text-ink-500">
                Generate briefs after the memo and recommendation pass to turn sponsor fit into concrete asks.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trajectory">
          {data.trajectory.hasSnapshots ? (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <ReadinessTrendCard
                  artifactDelta={data.trajectory.artifactDelta}
                  claimDelta={data.trajectory.claimDelta}
                  deltaFromPrevious={data.trajectory.deltaFromPrevious}
                  deltaFromStart={data.trajectory.deltaFromStart}
                  momentum={data.trajectory.momentum}
                  points={data.trajectory.snapshots.map((snapshot) => ({
                    id: snapshot.id,
                    label: snapshot.label,
                    readinessScore: snapshot.readinessScore,
                    topSponsorMatchScore: snapshot.topSponsorMatchScore,
                    capturedAtLabel: snapshot.capturedAtLabel,
                  }))}
                  score={data.readiness.score}
                  sponsorMatchDelta={data.trajectory.sponsorMatchDelta}
                />

                <ProgressTimeline
                  items={data.trajectory.snapshots.map((snapshot) => ({
                    id: snapshot.id,
                    label: snapshot.label,
                    summary: snapshot.summary,
                    stage: snapshot.stage,
                    readinessScore: snapshot.readinessScore,
                    topSponsorMatchScore: snapshot.topSponsorMatchScore,
                    artifactCount: snapshot.artifactCount,
                    evidenceClaimCount: snapshot.evidenceClaimCount,
                    highSignalClaimCount: snapshot.highSignalClaimCount,
                    approvedItemCount: snapshot.approvedItemCount,
                    flaggedItemCount: snapshot.flaggedItemCount,
                    capturedAtLabel: snapshot.capturedAtLabel,
                  }))}
                  momentum={data.trajectory.momentum}
                />
              </div>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Automation alerts</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Operator-facing signals created from stage automation, trajectory movement, and review blockers.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  {data.operatorAlerts.map((alert) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={alert.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink-900">{alert.title}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">{alert.createdAtLabel}</p>
                        </div>
                        <AlertSeverityBadge severity={alert.severity} />
                      </div>
                      <p className="mt-3 text-sm leading-7 text-ink-600">{alert.detail}</p>
                      <OperatorAlertControls alertId={alert.id} hasTask={Boolean(alert.operatorTask)} />
                    </div>
                  ))}
                  {data.operatorAlerts.length === 0 ? (
                    <p className="text-sm text-ink-500">No open operator alerts for this candidate.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Stage history</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Every automated stage move and manual override is recorded with the underlying rationale.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  {data.stageEvents.map((event) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={event.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink-900">{event.eventType.replaceAll("_", " ")}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink-400">{event.createdAtLabel}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {event.fromStage ? <Badge variant="muted">{event.fromStage.replaceAll("_", " ")}</Badge> : null}
                          {event.toStage ? <Badge variant="sage">{event.toStage.replaceAll("_", " ")}</Badge> : null}
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-ink-600">{event.rationale}</p>
                      {event.actorLabel ? <p className="mt-2 text-sm text-ink-500">{event.actorLabel}</p> : null}
                    </div>
                  ))}
                  {data.stageEvents.length === 0 ? (
                    <p className="text-sm text-ink-500">No stage history has been recorded yet.</p>
                  ) : null}
                </div>
              </Card>
            </div>
          ) : (
            <Card className="px-6 py-8">
              <p className="font-medium text-ink-900">No trajectory history yet</p>
              <p className="mt-3 text-sm leading-7 text-ink-500">
                Progress snapshots appear after intake, evidence updates, memo generation, recommendation refreshes, and sponsor operations steps.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="workflow">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Sponsor pipeline</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Operator-owned path from recommended sponsor target into live advocacy.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  {data.sponsorPipelineItems.map((item) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink-900">{item.sponsor.fullName}</p>
                          <p className="mt-1 text-sm text-ink-500">
                            {item.sponsor.organization} · {Math.round(item.score)}
                          </p>
                        </div>
                        <Badge variant="sage">{item.stage.replaceAll("_", " ")}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-ink-600">{item.rationale}</p>
                      {item.nextStep ? <p className="mt-3 text-sm leading-7 text-ink-500">Next step: {item.nextStep}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.owner ? <Badge variant="muted">{item.owner.name}</Badge> : <Badge variant="muted">Unowned</Badge>}
                        {item.nextDueAtLabel ? <Badge variant="muted">Due {item.nextDueAtLabel}</Badge> : null}
                        {item.opportunityBrief ? <Badge variant="muted">{item.opportunityBrief.opportunityType.replaceAll("_", " ")}</Badge> : null}
                      </div>
                      <PipelineStageControls
                        initialNextDueAt={item.nextDueAt ? item.nextDueAt.toISOString().slice(0, 10) : null}
                        initialNextStep={item.nextStep}
                        initialOutcomeNote={item.outcomeNote}
                        initialOwnerUserId={item.ownerUserId}
                        initialStage={item.stage}
                        itemId={item.id}
                        teamMembers={data.teamMembers.map((member) => ({
                          id: member.id,
                          name: member.name,
                          role: member.role,
                        }))}
                      />
                    </div>
                  ))}
                  {data.sponsorPipelineItems.length === 0 ? (
                    <p className="text-sm text-ink-500">Generate sponsor recommendations to initialize the sponsor pipeline.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Operator tasks</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Follow-up work created from alerts, sponsor-path friction, and outbound coordination.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  {data.operatorTasks.map((task) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={task.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink-900">{task.title}</p>
                          <p className="mt-1 text-sm text-ink-500">
                            {task.owner?.name ?? "Unowned"}{task.sponsor ? ` · ${task.sponsor.fullName}` : ""}
                          </p>
                        </div>
                        <Badge variant="muted">{task.status.replaceAll("_", " ")}</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-ink-600">{task.detail}</p>
                      <TaskControls
                        initialDueAt={task.dueAt ? task.dueAt.toISOString().slice(0, 10) : null}
                        initialOwnerUserId={task.ownerUserId}
                        initialStatus={task.status}
                        taskId={task.id}
                        teamMembers={data.teamMembers.map((member) => ({
                          id: member.id,
                          name: member.name,
                          role: member.role,
                        }))}
                      />
                    </div>
                  ))}
                  {data.operatorTasks.length === 0 ? (
                    <p className="text-sm text-ink-500">No tasks exist for this candidate yet.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Bulk review workbench</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Clear straightforward pending review items in batches before you move back into line-by-line evidence inspection.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  <BulkReviewWorkbench
                    description="Approve or flag unresolved extracted claims with one shared note."
                    entityType="claim"
                    items={data.reviewWorkbench.claims}
                    title="Evidence claims"
                  />
                  <BulkReviewWorkbench
                    description="Review sponsor, path, opportunity, and next-action recommendations in one pass."
                    entityType="recommendation"
                    items={data.reviewWorkbench.recommendations}
                    title="Recommendations"
                  />
                </div>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Committee review</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Use explicit multi-operator signoff when the sponsorship call needs committee-level judgment.
                  </p>
                </div>
                <div className="mt-5">
                  <CommitteeReviewControls
                    candidateId={data.candidate.id}
                    reviews={data.committeeReviews}
                    teamMembers={data.teamMembers.map((member) => ({
                      id: member.id,
                      name: member.name,
                      role: member.role,
                    }))}
                  />
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Proof requests</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Track missing proof, contradiction review, and corroboration work before sponsor-facing movement.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  <ProofRequestForm
                    candidateId={data.candidate.id}
                    suggestions={data.proofRequestSuggestions}
                    teamMembers={data.teamMembers.map((member) => ({
                      id: member.id,
                      name: member.name,
                      role: member.role,
                    }))}
                  />
                  {data.proofRequests.map((request) => (
                    <div
                      className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4"
                      data-testid={`proof-request-card-${request.id}`}
                      key={request.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant={
                                request.status === "RESOLVED"
                                  ? "sage"
                                  : request.status === "CANCELED"
                                    ? "muted"
                                    : "gold"
                              }
                            >
                              {request.status.replaceAll("_", " ")}
                            </Badge>
                            <Badge variant="muted">{request.requestType.replaceAll("_", " ")}</Badge>
                            <Badge variant={request.sla.severity}>{request.sla.label}</Badge>
                            {request.sourceDisagreementReviewId ? <Badge variant="danger">Linked disagreement</Badge> : null}
                          </div>
                          <p className="mt-3 font-medium text-ink-900">{request.title}</p>
                          <p className="mt-2 text-sm leading-7 text-ink-600">{request.detail}</p>
                          {request.resolutionNote ? (
                            <p className="mt-3 text-sm leading-7 text-ink-500">{request.resolutionNote}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{request.createdAtLabel}</p>
                          <p className="mt-2 text-sm text-ink-500">
                            {request.assignedUser?.name ? `Assigned ${request.assignedUser.name}` : "No assignee"}
                          </p>
                          {request.requestedBy?.name ? (
                            <p className="mt-1 text-sm text-ink-500">Opened by {request.requestedBy.name}</p>
                          ) : null}
                          {request.resolvedBy?.name ? (
                            <p className="mt-1 text-sm text-ink-500">Closed by {request.resolvedBy.name}</p>
                          ) : null}
                          <p className="mt-1 text-sm text-ink-500">
                            SLA target {request.effectiveDueAtLabel}
                            {request.sla.usedDefaultDueAt ? " · default policy" : ""}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-ink-500">{request.sla.detail}</p>
                      <ProofRequestControls
                        candidateUpdateAccessLink={request.candidateUpdateAccessLink}
                        hasTask={Boolean(request.operatorTask)}
                        initialAssignedUserId={request.assignedUserId}
                        initialDueAt={request.dueAt}
                        initialStatus={request.status}
                        reminderCount={request.reminderCount}
                        lastReminderAtLabel={request.lastReminderAtLabel}
                        lastReminderNote={request.lastReminderNote}
                        requestId={request.id}
                        teamMembers={data.teamMembers.map((member) => ({
                          id: member.id,
                          name: member.name,
                          role: member.role,
                        }))}
                      />
                    </div>
                  ))}
                  {data.proofRequests.length === 0 ? (
                    <p className="text-sm text-ink-500">No proof requests have been opened for this candidate yet.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Candidate updates</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Turn proof requests and new submissions into structured evidence refresh cycles instead of loose notes.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  <CandidateUpdateForm
                    candidateId={data.candidate.id}
                    proofRequests={data.proofRequests
                      .filter((request) => request.status === "OPEN" || request.status === "IN_PROGRESS")
                      .map((request) => ({
                        id: request.id,
                        title: request.title,
                        status: request.status,
                      }))}
                    replaceableArtifacts={data.replaceableArtifacts}
                  />
                  {data.candidateUpdates.map((update) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={update.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant={
                                update.status === "INCORPORATED"
                                  ? "sage"
                                  : update.status === "NEEDS_FOLLOW_UP"
                                    ? "gold"
                                    : "muted"
                              }
                            >
                              {CANDIDATE_UPDATE_STATUS_LABELS[update.status]}
                            </Badge>
                            {update.sourceProofRequest ? <Badge variant="muted">{update.sourceProofRequest.title}</Badge> : null}
                            {update.artifact ? <Badge variant="muted">{update.artifact.artifactType.replaceAll("_", " ")}</Badge> : null}
                          </div>
                          <p className="mt-3 font-medium text-ink-900">{update.title}</p>
                          <p className="mt-2 text-sm leading-7 text-ink-600">{update.summary}</p>
                          {update.incorporationNote ? (
                            <p className="mt-3 text-sm leading-7 text-ink-500">{update.incorporationNote}</p>
                          ) : null}
                          {update.artifact ? (
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm leading-7 text-ink-500">
                              <p>Stored artifact: {update.artifact.title} · {update.artifact.sourceLabel}</p>
                              <Badge variant={update.artifact.isCurrentVersion ? "sage" : "muted"}>
                                v{update.artifact.versionNumber}
                              </Badge>
                              {update.artifact.supersedesArtifact ? (
                                <Badge variant="gold">Replaces {update.artifact.supersedesArtifact.title}</Badge>
                              ) : null}
                              {update.artifact.storedFile ? (
                                <Link
                                  className="inline-flex items-center gap-1 text-sage-700 transition hover:text-sage-900"
                                  href={`/api/storage/${update.artifact.storedFile.id}` as Route}
                                >
                                  Download original
                                  <ArrowUpRight className="h-4 w-4" />
                                </Link>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{update.submittedAtLabel}</p>
                          <p className="mt-2 text-sm text-ink-500">{update.submittedByLabel}</p>
                          {update.submittedBy?.name ? (
                            <p className="mt-1 text-sm text-ink-500">Logged by {update.submittedBy.name}</p>
                          ) : null}
                          {update.incorporatedBy?.name ? (
                            <p className="mt-1 text-sm text-ink-500">Reviewed by {update.incorporatedBy.name}</p>
                          ) : null}
                          {update.incorporatedAtLabel ? (
                            <p className="mt-1 text-sm text-ink-500">Closed {update.incorporatedAtLabel}</p>
                          ) : null}
                        </div>
                      </div>
                      <CandidateUpdateControls
                        initialNote={update.incorporationNote}
                        initialStatus={update.status}
                        updateId={update.id}
                      />
                    </div>
                  ))}
                  {data.candidateUpdates.length === 0 ? (
                    <p className="text-sm text-ink-500">
                      No structured update cycles have been submitted for this candidate yet.
                    </p>
                  ) : null}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Queued work</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Durable jobs attached to this candidate, including pending refreshes and recoverable failures.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  {data.backgroundJobs.map((job) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={job.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-ink-900">{job.title}</p>
                          <p className="mt-2 text-sm leading-7 text-ink-500">
                            {job.status.replaceAll("_", " ").toLowerCase()} · attempts {job.attemptCount}/{job.maxAttempts}
                          </p>
                          {job.errorMessage ? (
                            <p className="mt-2 text-sm leading-7 text-rose-700">{job.errorMessage}</p>
                          ) : null}
                        </div>
                        <div className="text-right text-sm text-ink-500">
                          <p>{job.updatedAtLabel}</p>
                          {job.requestedBy?.name ? <p className="mt-1">Requested by {job.requestedBy.name}</p> : null}
                          <p className="mt-1">Available {job.availableAtLabel}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.backgroundJobs.length === 0 ? (
                    <p className="text-sm text-ink-500">No queued or recoverable work is attached to this candidate right now.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Operator notes</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Human judgment, caveats, and follow-through context that should not be merged into model output.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  <CandidateNoteForm candidateId={data.candidate.id} />
                  {data.candidateNotes.map((note) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={note.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="muted">{note.noteType.replaceAll("_", " ")}</Badge>
                            {note.title ? <Badge variant="sage">{note.title}</Badge> : null}
                          </div>
                          <p className="mt-3 text-sm leading-7 text-ink-600">{note.content}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{note.createdAtLabel}</p>
                          <p className="mt-2 text-sm text-ink-500">{note.author?.name ?? "System"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.candidateNotes.length === 0 ? (
                    <p className="text-sm text-ink-500">No operator notes yet.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Disagreement review history</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Traceable second-review assignments and resolutions when the human underwriting call diverges from the current guardrail.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  {data.disagreementReviews.map((review) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={review.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant={
                                review.status === "RESOLVED"
                                  ? "sage"
                                  : review.status === "ESCALATED"
                                    ? "gold"
                                    : "muted"
                              }
                            >
                              {review.status.replaceAll("_", " ")}
                            </Badge>
                            {review.resolutionType ? (
                              <Badge variant="muted">{review.resolutionType.replaceAll("_", " ")}</Badge>
                            ) : null}
                          </div>
                          <p className="mt-3 font-medium text-ink-900">{review.summary}</p>
                          {review.rationale ? (
                            <p className="mt-2 text-sm leading-7 text-ink-600">{review.rationale}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{review.createdAtLabel}</p>
                          <p className="mt-2 text-sm text-ink-500">
                            {review.assignedUser?.name ? `Assigned ${review.assignedUser.name}` : "No assignee"}
                          </p>
                          {review.reviewedBy?.name ? (
                            <p className="mt-1 text-sm text-ink-500">Reviewed {review.reviewedBy.name}</p>
                          ) : null}
                          {review.dueAtLabel ? <p className="mt-1 text-sm text-ink-500">Due {review.dueAtLabel}</p> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.disagreementReviews.length === 0 ? (
                    <p className="text-sm text-ink-500">No disagreement reviews have been opened for this candidate yet.</p>
                  ) : null}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Decision log</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Why the case advanced, paused, or stayed internal across the review lifecycle.
                  </p>
                </div>
                <div className="mt-5 space-y-4">
                  <CandidateDecisionForm candidateId={data.candidate.id} />
                  {data.candidateDecisions.map((decision) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={decision.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="sage">{decision.decisionType.replaceAll("_", " ")}</Badge>
                            {decision.stageAtDecision ? (
                              <Badge variant="muted">{decision.stageAtDecision.replaceAll("_", " ")}</Badge>
                            ) : null}
                          </div>
                          <p className="mt-3 font-medium text-ink-900">{decision.summary}</p>
                          <p className="mt-2 text-sm leading-7 text-ink-600">{decision.rationale}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{decision.createdAtLabel}</p>
                          <p className="mt-2 text-sm text-ink-500">{decision.decidedBy?.name ?? "System"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.candidateDecisions.length === 0 ? (
                    <p className="text-sm text-ink-500">No explicit decisions have been recorded yet.</p>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="actions">
          <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
            <Card className="px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-900">Recommended next action</p>
                  <p className="text-sm text-ink-500">Traceable recommendation generated from the current profile.</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                {data.recommendations.actions.length > 0 ? (
                  data.recommendations.actions.map((item) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.id}>
                      <div className="flex items-center justify-between gap-3">
                        <ReviewBadge status={item.reviewStatus} />
                        <span className="text-xs uppercase tracking-[0.18em] text-ink-400">
                          Score {Math.round(item.score)}
                        </span>
                      </div>
                      <p className="text-sm leading-7 text-ink-700">{item.actionSuggestion}</p>
                      <p className="mt-3 text-sm leading-7 text-ink-500">{item.explanation}</p>
                      {item.reviewNote ? <p className="mt-3 text-sm leading-7 text-ink-500">{item.reviewNote}</p> : null}
                      <ReviewControls
                        entityType="recommendation"
                        initialNote={item.reviewNote}
                        initialStatus={item.reviewStatus}
                        itemId={item.id}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-500">No action recommendation yet.</p>
                )}
              </div>
            </Card>

            <Card className="px-5 py-5">
              <p className="text-sm font-medium text-ink-900">Best sponsor targets</p>
              <div className="mt-5 space-y-4">
                {data.recommendations.bestSponsors.length > 0 ? (
                  data.recommendations.bestSponsors.map((item) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-ink-900">{item.sponsor?.fullName ?? "Unassigned sponsor"}</p>
                        <ReviewBadge status={item.reviewStatus} />
                      </div>
                      <p className="mt-2 text-sm leading-7 text-ink-700">{item.explanation}</p>
                      <p className="mt-3 text-sm leading-7 text-ink-500">{item.actionSuggestion}</p>
                      {item.reviewNote ? <p className="mt-3 text-sm leading-7 text-ink-500">{item.reviewNote}</p> : null}
                      <ReviewControls
                        entityType="recommendation"
                        initialNote={item.reviewNote}
                        initialStatus={item.reviewStatus}
                        itemId={item.id}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-500">No sponsor recommendations yet.</p>
                )}
              </div>
            </Card>

            <Card className="px-5 py-5">
              <p className="text-sm font-medium text-ink-900">Best-fit opportunity types</p>
              <div className="mt-5 space-y-4">
                {data.recommendations.opportunityTypes.length > 0 ? (
                  data.recommendations.opportunityTypes.map((item) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.id}>
                      <ReviewBadge status={item.reviewStatus} />
                      <p className="text-sm leading-7 text-ink-700">{item.explanation}</p>
                      <p className="mt-3 text-sm leading-7 text-ink-500">{item.actionSuggestion}</p>
                      {item.reviewNote ? <p className="mt-3 text-sm leading-7 text-ink-500">{item.reviewNote}</p> : null}
                      <ReviewControls
                        entityType="recommendation"
                        initialNote={item.reviewNote}
                        initialStatus={item.reviewStatus}
                        itemId={item.id}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-500">No opportunity recommendation yet.</p>
                )}
              </div>
            </Card>

            <Card className="px-5 py-5">
              <p className="text-sm font-medium text-ink-900">Warm path recommendations</p>
              <div className="mt-5 space-y-4">
                {data.recommendations.warmPaths.length > 0 ? (
                  data.recommendations.warmPaths.map((item) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.id}>
                      <ReviewBadge status={item.reviewStatus} />
                      <p className="text-sm leading-7 text-ink-700">{item.explanation}</p>
                      <p className="mt-3 text-sm leading-7 text-ink-500">{item.actionSuggestion}</p>
                      {item.reviewNote ? <p className="mt-3 text-sm leading-7 text-ink-500">{item.reviewNote}</p> : null}
                      <ReviewControls
                        entityType="recommendation"
                        initialNote={item.reviewNote}
                        initialStatus={item.reviewStatus}
                        itemId={item.id}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-500">No warm paths found yet.</p>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
