import Link from "next/link";
import type { Route } from "next";

import { AppShell } from "@/components/dashboard/app-shell";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TrajectoryBadge } from "@/components/dashboard/trajectory-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCandidateCompareData, searchValueToString } from "@/lib/db/queries";
import { formatSignedNumber } from "@/lib/utils/format";
import { titleCase } from "@/lib/utils/strings";

export default async function CandidateComparePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const ids = searchValueToString(resolved.ids)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const data = await getCandidateCompareData(ids);

  return (
    <AppShell
      title="Candidate compare"
      description="Use a side-by-side view when the decision is relative, not absolute: readiness, movement, best sponsor, strongest proof, and workflow load all in one frame."
      actions={
        <Button asChild variant="secondary">
          <Link href={"/candidates" as Route}>Back to candidates</Link>
        </Button>
      }
    >
      <Card className="px-5 py-5">
        <p className="text-sm font-medium text-ink-900">Quick compare presets</p>
        {data.safetySettings.blindReviewMode ? (
          <p className="mt-2 text-sm text-ink-500">Blind review mode is active. Identity cues are masked on this page.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {data.availableCandidates.slice(0, 6).map((candidate) => {
            const compareIds = [candidate.id, ...data.selected.map((item) => item.id).filter((id) => id !== candidate.id)]
              .slice(0, 3)
              .join(",");

            return (
              <Button asChild key={candidate.id} size="sm" variant="ghost">
                <Link href={`/candidates/compare?ids=${compareIds}` as Route}>
                  {candidate.fullName}
                </Link>
              </Button>
            );
          })}
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-3">
        {data.selected.map((candidate) => (
          <Card className="px-5 py-5" key={candidate.id}>
            <div className="border-b border-ink-100 pb-4">
              <Link className="font-serif text-3xl text-ink-900 hover:text-sage-700" href={`/candidates/${candidate.id}`}>
                {candidate.displayName}
              </Link>
              <p className="mt-2 text-sm text-ink-500">{candidate.displayHeadline}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={candidate.readiness.status} />
                <Badge variant="muted">{candidate.currentStage.replaceAll("_", " ")}</Badge>
                <TrajectoryBadge momentum={candidate.trajectory.momentum} />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Readiness</p>
                <p className="mt-2 font-serif text-4xl text-ink-900">{candidate.readiness.score}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Latest movement</p>
                <p className="mt-2 font-serif text-4xl text-ink-900">{formatSignedNumber(candidate.trajectory.deltaFromPrevious)}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Workflow notes</p>
                <p className="mt-2 font-serif text-4xl text-ink-900">{candidate.noteCount}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Decision logs</p>
                <p className="mt-2 font-serif text-4xl text-ink-900">{candidate.decisionCount}</p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Best current sponsor</p>
              {candidate.topSponsor ? (
                <>
                  <p className="mt-2 text-lg font-medium text-ink-900">{candidate.topSponsor.sponsor.fullName}</p>
                  <p className="mt-1 text-sm text-ink-500">
                    {candidate.topSponsor.sponsor.organization} · {Math.round(candidate.topSponsor.result.score)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-500">No sponsor target yet.</p>
              )}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Strongest signals</p>
              <div className="mt-3 space-y-3">
                {candidate.topClaims.map((claim) => (
                  <div key={claim.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="sage">{titleCase(claim.category)}</Badge>
                      <span className="text-xs uppercase tracking-[0.18em] text-ink-400">
                        {Math.round(claim.confidence * 100)}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-ink-600">{claim.claim}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Operational load</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">
                {candidate.operatorAlerts.length} open alerts · {candidate.activePipelineCount} active sponsor paths · {candidate.artifacts.length} artifacts
              </p>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Committee review</p>
              {candidate.latestCommitteeReview ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={candidate.latestCommitteeReview.status === "FINALIZED" ? "sage" : "gold"}>
                      {candidate.latestCommitteeReview.statusLabel}
                    </Badge>
                    <Badge variant="muted">{candidate.latestCommitteeReview.consensusLabel}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-600">
                    {candidate.latestCommitteeReview.voteSummary.total} votes recorded.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-500">No committee review opened yet.</p>
              )}
            </div>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
