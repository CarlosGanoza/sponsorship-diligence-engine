import Link from "next/link";
import type { Route } from "next";
import { SavedViewPage } from "@prisma/client";

import { ArrowRight, PlusCircle } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { SavedViewControls } from "@/components/dashboard/saved-view-controls";
import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { ReviewBadge } from "@/components/dashboard/review-badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TrajectoryBadge } from "@/components/dashboard/trajectory-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { getCandidatesList, getSavedViews, searchValueToString } from "@/lib/db/queries";
import { buildSavedViewQueryString } from "@/lib/saved-views";
import { formatSignedNumber } from "@/lib/utils/format";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const filters = {
    query: searchValueToString(resolved.q),
    readiness: searchValueToString(resolved.readiness) || "all",
    memoStatus: searchValueToString(resolved.memoStatus) || "all",
    stage: searchValueToString(resolved.stage) || "all",
    automation: searchValueToString(resolved.automation) || "all",
    opportunityFit: searchValueToString(resolved.opportunityFit),
    reviewState: searchValueToString(resolved.reviewState) || "all",
  };
  const [candidates, savedViews] = await Promise.all([
    getCandidatesList(filters),
    getSavedViews(SavedViewPage.CANDIDATES),
  ]);
  const currentQueryString = buildSavedViewQueryString({
    q: filters.query,
    readiness: filters.readiness !== "all" ? filters.readiness : undefined,
    memoStatus: filters.memoStatus !== "all" ? filters.memoStatus : undefined,
    stage: filters.stage !== "all" ? filters.stage : undefined,
    automation: filters.automation !== "all" ? filters.automation : undefined,
    opportunityFit: filters.opportunityFit,
    reviewState: filters.reviewState !== "all" ? filters.reviewState : undefined,
  });

  return (
    <AppShell
      title="Candidates"
      description="Search and filter the current candidate slate by readiness, memo status, workflow stage, and signal profile."
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href={"/candidates/compare" as Route}>
              Compare candidates
            </Link>
          </Button>
          <Button asChild>
            <Link href="/candidates/new">
              <PlusCircle className="h-4 w-4" />
              New candidate
            </Link>
          </Button>
        </>
      }
    >
      <Card className="px-5 py-5">
        <form className="grid gap-4 lg:grid-cols-[1.3fr_repeat(6,0.8fr)]" method="get">
          <Input defaultValue={filters.query} name="q" placeholder="Search name, headline, or bio" />
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.readiness}
            name="readiness"
          >
            <option value="all">All readiness</option>
            <option value="high">High readiness</option>
            <option value="medium">Medium readiness</option>
            <option value="low">Low readiness</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.memoStatus}
            name="memoStatus"
          >
            <option value="all">All memo states</option>
            <option value="READY">Ready</option>
            <option value="PROCESSING">Processing</option>
            <option value="NOT_STARTED">Not started</option>
            <option value="NEEDS_REVIEW">Needs review</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.stage}
            name="stage"
          >
            <option value="all">All stages</option>
            <option value="INTAKE">Intake</option>
            <option value="REVIEW">Review</option>
            <option value="MEMO_READY">Memo ready</option>
            <option value="SPONSOR_OUTREACH">Sponsor outreach</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.automation}
            name="automation"
          >
            <option value="all">Automation state</option>
            <option value="AUTOMATED">Automation on</option>
            <option value="MANUAL_OVERRIDE">Manual override</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.reviewState}
            name="reviewState"
          >
            <option value="all">All review states</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending review</option>
            <option value="flagged">Flagged</option>
            <option value="not_started">Not reviewed</option>
          </select>
          <Input defaultValue={filters.opportunityFit} name="opportunityFit" placeholder="Keyword fit" />
        </form>
      </Card>

      <SavedViewControls
        currentQueryString={currentQueryString}
        page={SavedViewPage.CANDIDATES}
        pagePath="/candidates"
        savedViews={savedViews}
      />

      <Card className="px-5 py-5">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 pb-4">
          <div>
            <p className="text-sm font-medium text-ink-900">Candidate review table</p>
            <p className="mt-1 text-sm text-ink-500">Every score is inspectable and tied back to evidence artifacts.</p>
          </div>
          <Badge variant="muted">{candidates.length} results</Badge>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <TableHead>Candidate</TableHead>
                <TableHead>Artifacts</TableHead>
                <TableHead>Signals</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Alerts</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead>Briefs</TableHead>
                <TableHead>Human review</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead />
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const briefStatuses = candidate.opportunityBriefs.map((brief) => brief.status);
                const briefStatus =
                  briefStatuses.length === 0
                    ? null
                    : briefStatuses.includes("HOLD")
                      ? "HOLD"
                      : briefStatuses.includes("DRAFT")
                        ? "DRAFT"
                        : "READY";

                return (
                  <TableRow key={candidate.id}>
                    <TableCell>
                      <Link className="font-medium text-ink-900 hover:text-sage-700" href={`/candidates/${candidate.id}`}>
                        {candidate.displayName}
                      </Link>
                      <p className="mt-1 text-xs leading-5 text-ink-500">{candidate.displayHeadline}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">{candidate.displayRegion}</p>
                    </TableCell>
                    <TableCell>{candidate.artifacts.length}</TableCell>
                    <TableCell>{candidate.evidenceClaims.length}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <p className="font-medium text-ink-900">{candidate.readiness.score}</p>
                        <StatusBadge status={candidate.readiness.status} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <p className="font-medium text-ink-900">{formatSignedNumber(candidate.trajectory.deltaFromPrevious)}</p>
                        <TrajectoryBadge momentum={candidate.trajectory.momentum} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {candidate.operatorAlerts.length > 0 ? (
                        <Badge variant="danger">{candidate.operatorAlerts.length} open</Badge>
                      ) : (
                        <Badge variant="muted">Clear</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={candidate.sponsorMemo?.status ?? "not_started"} />
                    </TableCell>
                    <TableCell>
                      {briefStatus ? (
                        <div className="space-y-2">
                          <BriefStatusBadge status={briefStatus} />
                          <p className="text-xs leading-5 text-ink-500">{candidate.opportunityBriefs.length} generated</p>
                        </div>
                      ) : (
                        <p className="text-xs leading-5 text-ink-500">Not started</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <ReviewBadge status={candidate.reviewSummary.status} />
                        <p className="text-xs leading-5 text-ink-500">
                          {candidate.reviewSummary.approved} approved · {candidate.reviewSummary.pending} pending ·{" "}
                          {candidate.reviewSummary.flagged} flagged
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Badge variant="muted">{candidate.currentStage.replaceAll("_", " ")}</Badge>
                        {candidate.automationMode === "MANUAL_OVERRIDE" ? (
                          <Badge variant="danger">Manual override</Badge>
                        ) : (
                          <Badge variant="sage">Automation on</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700" href={`/candidates/${candidate.id}`}>
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}
