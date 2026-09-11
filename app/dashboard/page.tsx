import Link from "next/link";
import type { Route } from "next";

import { ArrowRight, FileText, PlusCircle, Users } from "lucide-react";

import { ActivityStatusBadge } from "@/components/dashboard/activity-status-badge";
import { OperatorAlertControls } from "@/components/alerts/operator-alert-controls";
import { AlertSeverityBadge } from "@/components/dashboard/alert-severity-badge";
import { AppShell } from "@/components/dashboard/app-shell";
import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { CrmSyncBadge } from "@/components/dashboard/crm-sync-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ReviewBadge } from "@/components/dashboard/review-badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TrajectoryBadge } from "@/components/dashboard/trajectory-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { getDashboardData } from "@/lib/db/queries";
import { formatDate, formatSignedNumber } from "@/lib/utils/format";

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

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <AppShell
      title="Dashboard"
      description="Review sponsor-ready candidates, conviction movement over time, and the profiles that still need stronger evidence before outreach."
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href={"/alerts" as Route}>
              Alerts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/briefs" as Route}>
              Opportunity briefs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/pipeline" as Route}>
              Pipeline
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/tasks" as Route}>
              Tasks
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/candidates/compare" as Route}>
              Compare
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/candidates/new">
              <PlusCircle className="h-4 w-4" />
              New candidate
            </Link>
          </Button>
          <Button asChild>
            <Link href="/candidates">
              View all candidates
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      {data.safetySettings.blindReviewMode ? (
        <Card className="px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Blind review mode is active</p>
          <p className="mt-2 text-sm leading-7 text-ink-500">
            Candidate names, headlines, and regions are masked on the main review surfaces to reduce identity-led bias during evaluation.
          </p>
        </Card>
      ) : null}
      <section className="grid gap-5 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard detail={kpi.detail} key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="px-5 py-5">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 pb-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Recent candidates</p>
              <p className="mt-1 text-sm text-ink-500">Ranked by current sponsor readiness.</p>
            </div>
            <Badge variant="muted">{data.candidates.length} total</Badge>
          </div>

          <div className="mt-4 overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Readiness</TableHead>
                  <TableHead>Trend</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead>Review</TableHead>
                </tr>
              </thead>
              <tbody>
                {data.candidates.slice(0, 6).map((candidate) => (
                  <TableRow key={candidate.id}>
                    <TableCell>
                      <Link className="font-medium text-ink-900 hover:text-sage-700" href={`/candidates/${candidate.id}`}>
                        {candidate.displayName}
                      </Link>
                      <p className="mt-1 text-xs leading-5 text-ink-500">{candidate.displayHeadline}</p>
                    </TableCell>
                    <TableCell>{candidate.displayRegion}</TableCell>
                    <TableCell>{candidate.readiness.score}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <p className="font-medium text-ink-900">{formatSignedNumber(candidate.trajectory.deltaFromPrevious)}</p>
                        <TrajectoryBadge momentum={candidate.trajectory.momentum} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={candidate.sponsorMemo?.status ?? "not_started"} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={candidate.readiness.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card aria-label="Operator alerts" className="px-5 py-5" role="region">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Operator review status</p>
              <p className="mt-1 text-sm text-ink-500">How much of the slate has been cleared, is waiting for review, or has been flagged.</p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Cleared candidates</p>
                <p className="mt-2 font-serif text-4xl text-ink-900">{data.operatorReviewStatus.approvedCandidates}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Pending items</p>
                <p className="mt-2 font-serif text-4xl text-ink-900">{data.operatorReviewStatus.pendingItems}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Flagged items</p>
                <p className="mt-2 font-serif text-4xl text-ink-900">{data.operatorReviewStatus.flaggedItems}</p>
              </div>
            </div>
            <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Generated recommendation coverage</p>
              <p className="mt-2 text-sm leading-7 text-ink-500">
                {data.recommendationStatus.ready} candidates already have recommendations, {data.recommendationStatus.pending} still need outputs, {data.recommendationStatus.needsReview} are in the caution queue, and {data.recommendationStatus.stale} have stale top-sponsor guidance.
              </p>
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Proof requests</p>
              <p className="mt-1 text-sm text-ink-500">
                Evidence gaps and contradiction reviews that still need operator follow-through.
              </p>
            </div>
            <div className="mt-5 space-y-4">
              {data.proofRequests.map((request) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={request.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        className="font-medium text-ink-900 hover:text-sage-700"
                        href={`/candidates/${request.candidateId}`}
                      >
                        {request.displayCandidateName}
                      </Link>
                      <p className="mt-1 text-sm text-ink-700">{request.title}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">{request.createdAtLabel}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="muted">{request.requestType.replaceAll("_", " ")}</Badge>
                      <Badge variant={request.status === "IN_PROGRESS" ? "gold" : "muted"}>
                        {request.status.replaceAll("_", " ")}
                      </Badge>
                      <Badge variant={request.sla.severity}>{request.sla.label}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">{request.detail}</p>
                  <p className="mt-3 text-sm text-ink-500">
                    {request.assignedUser?.name ?? "Unassigned"}
                    {` · SLA target ${request.sla.effectiveDueAtLabel}`}
                    {request.sla.usedDefaultDueAt ? " · default policy" : ""}
                  </p>
                  <p className="mt-2 text-sm text-ink-500">{request.sla.detail}</p>
                  {request.reminderCount > 0 || request.lastReminderAtLabel ? (
                    <p className="mt-2 text-sm text-ink-500">
                      {request.reminderCount > 0
                        ? `${request.reminderCount} reminder${request.reminderCount === 1 ? "" : "s"} sent`
                        : "Reminder activity recorded"}
                      {request.lastReminderAtLabel ? ` · last sent ${request.lastReminderAtLabel}` : ""}
                    </p>
                  ) : null}
                </div>
              ))}
              {data.proofRequests.length === 0 ? (
                <p className="text-sm text-ink-500">No open proof requests right now.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Queued work</p>
              <p className="mt-1 text-sm text-ink-500">
                Pending or recoverable durable jobs that can drift operator views away from live evidence if ignored.
              </p>
            </div>
            <div className="mt-5 space-y-4">
              {data.backgroundJobs.map((job) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={job.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{job.title}</p>
                      <p className="mt-1 text-sm text-ink-500">
                        {job.candidateDisplayName ? `${job.candidateDisplayName} · ` : ""}
                        {job.status.replaceAll("_", " ")}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{job.updatedAtLabel}</p>
                  </div>
                  {job.errorMessage ? <p className="mt-3 text-sm leading-7 text-rose-700">{job.errorMessage}</p> : null}
                </div>
              ))}
              {data.backgroundJobs.length === 0 ? (
                <p className="text-sm text-ink-500">No queued or recoverable background jobs are visible right now.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Operator alerts</p>
              <p className="mt-1 text-sm text-ink-500">Automation surfaces trajectory changes, blockers, and outreach-ready files here.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.alerts.map((alert) => (
                <div
                  className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4"
                  data-testid={`dashboard-alert-${alert.id}`}
                  key={alert.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link className="font-medium text-ink-900 hover:text-sage-700" href={`/candidates/${alert.candidateId}`}>
                        {alert.displayCandidateName}
                      </Link>
                      <p className="mt-1 text-sm text-ink-700">{alert.title}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">{alert.createdAtLabel}</p>
                    </div>
                    <AlertSeverityBadge severity={alert.severity} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">{alert.detail}</p>
                  <OperatorAlertControls alertId={alert.id} hasTask={Boolean(alert.operatorTask)} />
                </div>
              ))}
              {data.alerts.length === 0 ? (
                <p className="text-sm text-ink-500">No open operator alerts right now.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900">Sponsor-ready queue</p>
                <p className="text-sm text-ink-500">Candidates with the clearest current case for advocacy.</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {data.sponsorReadyQueue.map((candidate) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={candidate.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{candidate.displayName}</p>
                      <p className="mt-1 text-sm text-ink-500">{candidate.displayHeadline}</p>
                      {candidate.topSponsorNow ? (
                        <p className="mt-3 text-sm leading-7 text-ink-500">
                          Best sponsor now: {candidate.topSponsorNow.sponsor.fullName} · {candidate.topSponsorNow.result.score}/100 live fit
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-3xl text-ink-900">{candidate.advocacyPriorityScore}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Advocacy priority</p>
                      <StatusBadge status={candidate.readiness.status} />
                    </div>
                  </div>
                  {candidate.topSponsorNow ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant={getRightNowVariant(candidate.topSponsorNow.result.rightNowLabel)}>
                        {candidate.topSponsorNow.result.rightNowLabel}
                      </Badge>
                      <Badge variant="muted">Base fit {candidate.topSponsorNow.result.baseFitScore}</Badge>
                      <Badge
                        variant={candidate.topSponsorNow.result.operationalDelta >= 0 ? "sage" : "gold"}
                      >
                        Ops {candidate.topSponsorNow.result.operationalDelta >= 0 ? "+" : ""}
                        {candidate.topSponsorNow.result.operationalDelta}
                      </Badge>
                      {candidate.topSponsorRecommendationFreshness ? (
                        <Badge
                          variant={getFreshnessVariant(candidate.topSponsorRecommendationFreshness.label)}
                        >
                          {candidate.topSponsorRecommendationFreshness.label}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {candidate.topSponsorRecommendationFreshness ? (
                    <p className="mt-3 text-sm leading-7 text-ink-500">
                      {candidate.topSponsorRecommendationFreshness.summary}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Momentum watchlist</p>
              <p className="mt-1 text-sm text-ink-500">Candidates whose case is strengthening fastest across the latest snapshot window.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.momentumQueue.map((candidate) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={candidate.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{candidate.displayName}</p>
                      <p className="mt-1 text-sm text-ink-500">{candidate.displayHeadline}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-3xl text-ink-900">{formatSignedNumber(candidate.trajectory.deltaFromPrevious)}</p>
                      <TrajectoryBadge momentum={candidate.trajectory.momentum} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">
                    {candidate.trajectory.latest?.label ?? "Latest snapshot"} · {candidate.trajectory.latest?.artifactCount ?? 0} artifacts ·{" "}
                    {candidate.trajectory.latest?.evidenceClaimCount ?? 0} claims
                  </p>
                </div>
              ))}
              {data.momentumQueue.length === 0 ? (
                <p className="text-sm text-ink-500">No movement has been captured yet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Flat or blocked cases</p>
              <p className="mt-1 text-sm text-ink-500">Profiles that are not gaining conviction yet or still carry review friction.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.stallRiskQueue.map((candidate) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={candidate.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{candidate.displayName}</p>
                      <p className="mt-1 text-sm text-ink-500">{candidate.displayHeadline}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-3xl text-ink-900">{formatSignedNumber(candidate.trajectory.deltaFromPrevious)}</p>
                      <TrajectoryBadge momentum={candidate.trajectory.momentum} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">
                    {candidate.trajectory.latest?.flaggedItemCount ?? 0} flagged items · readiness {candidate.readiness.score}
                  </p>
                </div>
              ))}
              {data.stallRiskQueue.length === 0 ? (
                <p className="text-sm text-ink-500">No flat or blocked cases right now.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Operator review queue</p>
              <p className="mt-1 text-sm text-ink-500">Candidates with pending or flagged human review items.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.operatorReviewQueue.map((candidate) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={candidate.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{candidate.displayName}</p>
                      <p className="mt-1 text-sm text-ink-500">{candidate.displayHeadline}</p>
                    </div>
                    <ReviewBadge status={candidate.reviewSummary.status} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">
                    {candidate.reviewSummary.approved} approved · {candidate.reviewSummary.pending} pending · {candidate.reviewSummary.flagged} flagged
                  </p>
                </div>
              ))}
              {data.operatorReviewQueue.length === 0 ? (
                <p className="text-sm text-ink-500">No candidates are currently waiting on human review.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Candidates needing review</p>
              <p className="mt-1 text-sm text-ink-500">Profiles that still need stronger evidence before confident sponsorship.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.reviewQueue.slice(0, 4).map((candidate) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={candidate.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{candidate.displayName}</p>
                      <p className="mt-1 text-sm text-ink-500">{candidate.displayHeadline}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-3xl text-ink-900">{candidate.readiness.score}</p>
                      <StatusBadge status={candidate.readiness.status} />
                    </div>
                  </div>
                </div>
              ))}
              {data.reviewQueue.length === 0 ? (
                <p className="text-sm text-ink-500">No candidates currently flagged for review.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Operator task queue</p>
              <p className="mt-1 text-sm text-ink-500">Assigned follow-up created from alerts, pipeline friction, and sponsor ops.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.tasks.map((task) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={task.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{task.title}</p>
                      <p className="mt-1 text-sm text-ink-500">
                        {task.owner?.name ?? "Unowned"} · {task.displayCandidateName ?? "No candidate link"}
                      </p>
                    </div>
                    <Badge variant="muted">{task.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">{task.detail}</p>
                </div>
              ))}
              {data.tasks.length === 0 ? (
                <p className="text-sm text-ink-500">No tasks have been created yet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Active sponsor pipeline</p>
              <p className="mt-1 text-sm text-ink-500">Who is moving from recommendation into real sponsor advocacy.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.pipeline.map((item) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{item.displayCandidateName}</p>
                      <p className="mt-1 text-sm text-ink-500">
                        {item.sponsor.fullName} · {item.owner?.name ?? "Unowned"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif text-3xl text-ink-900">{item.currentMatch.score}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Live fit</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="sage">{item.stage.replaceAll("_", " ")}</Badge>
                    <Badge variant={getRightNowVariant(item.currentMatch.rightNowLabel)}>
                      {item.currentMatch.rightNowLabel}
                    </Badge>
                    <Badge variant="muted">Stored {Math.round(item.score)}</Badge>
                    {item.recommendationFreshness ? (
                      <Badge variant={getFreshnessVariant(item.recommendationFreshness.label)}>
                        {item.recommendationFreshness.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">{item.nextStep ?? item.rationale}</p>
                  <p className="mt-2 text-sm leading-7 text-ink-500">{item.currentMatch.rightNowSummary}</p>
                  {item.recommendationFreshness ? (
                    <p className="mt-2 text-sm leading-7 text-ink-500">
                      {item.recommendationFreshness.summary}
                    </p>
                  ) : null}
                </div>
              ))}
              {data.pipeline.length === 0 ? (
                <p className="text-sm text-ink-500">No sponsor pipeline items exist yet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900">Recent memos</p>
                <p className="text-sm text-ink-500">Printable one-page reviews for sponsor conversations.</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {data.memos.map((memo) => (
                <Link
                  className="block rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4 transition hover:border-sage-200 hover:bg-white"
                  href={`/memos/${memo.candidateId}`}
                  key={memo.id}
                >
                  <p className="font-medium text-ink-900">{memo.candidateDisplayName}</p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-500">{memo.summary}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">{formatDate(memo.updatedAt)}</p>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900">Recent opportunity briefs</p>
                <p className="text-sm text-ink-500">Sponsor-targeted asks ready for internal review or print.</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {data.briefs.map((brief) => (
                <Link
                  className="block rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4 transition hover:border-sage-200 hover:bg-white"
                  href={`/briefs/${brief.candidateId}?sponsor=${brief.sponsorId}` as Route}
                  key={brief.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{brief.candidateDisplayName}</p>
                      <p className="mt-1 text-sm text-ink-500">{brief.sponsor.fullName}</p>
                    </div>
                    <BriefStatusBadge status={brief.status} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink-500">{brief.summary}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">{formatDate(brief.updatedAt)}</p>
                </Link>
              ))}
              {data.briefs.length === 0 ? (
                <p className="text-sm text-ink-500">No opportunity briefs have been generated yet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Recent CRM syncs</p>
              <p className="mt-1 text-sm text-ink-500">Latest sponsor-path handoffs recorded to the CRM layer.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.crmSyncs.map((sync) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={sync.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{sync.candidateDisplayName}</p>
                      <p className="mt-1 text-sm text-ink-500">{sync.sponsor.fullName}</p>
                    </div>
                    <CrmSyncBadge status={sync.status} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">{sync.syncNote}</p>
                </div>
              ))}
              {data.crmSyncs.length === 0 ? (
                <p className="text-sm text-ink-500">No CRM syncs have been recorded yet.</p>
              ) : null}
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Recent sponsor activity</p>
              <p className="mt-1 text-sm text-ink-500">Tracked operational events across current sponsor paths.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.sponsorActivities.map((activity) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={activity.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{activity.title}</p>
                      <p className="mt-1 text-sm text-ink-500">
                        {activity.candidateDisplayName} · {activity.sponsor.fullName}
                      </p>
                    </div>
                    <ActivityStatusBadge status={activity.status} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-500">{activity.detail}</p>
                </div>
              ))}
              {data.sponsorActivities.length === 0 ? (
                <p className="text-sm text-ink-500">No sponsor activity has been logged yet.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
