import Link from "next/link";
import type { Route } from "next";

import { ArrowRight, ShieldCheck, UsersRound } from "lucide-react";

import { ReviewerCalibrationControls } from "@/components/calibration/reviewer-calibration-controls";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCalibrationWorkspaceData } from "@/lib/db/queries";
import { formatDate } from "@/lib/utils/format";

export default async function CalibrationPage() {
  const data = await getCalibrationWorkspaceData();

  return (
    <AppShell
      title="Calibration workspace"
      description="Turn reviewer calibration from a passive analytic into an explicit operating workflow with owners, due dates, and escalation state."
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href={"/analytics" as Route}>Analytics</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/onboarding" as Route}>Pilot launch</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/commercial" as Route}>Commercial proof</Link>
          </Button>
          <Button asChild>
            <Link href={"/audits" as Route}>
              Open audits
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Calibration posture</p>
              <p className="mt-1 text-sm text-ink-500">
                {data.pilotProfile.pilotName} is currently packaged for {data.template.label.toLowerCase()} buyers. This workspace makes reviewer discipline inspectable before sponsor-facing movement.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="sage">{data.calibrationWorkspace.summary.statusLabel}</Badge>
            <Badge variant="muted">{data.calibrationWorkspace.summary.readyCount}/{data.calibrationWorkspace.summary.total} ready</Badge>
            {data.calibrationWorkspace.summary.nextDueAt ? (
              <Badge variant="gold">Next due {formatDate(data.calibrationWorkspace.summary.nextDueAt)}</Badge>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            {data.calibrationWorkspace.summary.blockers.length > 0 ? (
              data.calibrationWorkspace.summary.blockers.map((blocker) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={blocker}>
                  <p className="text-sm leading-7 text-ink-600">{blocker}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm leading-7 text-ink-600">
                  Current reviewer calibration items are fully ready. Use this state as proof that disagreement handling is operational, not only observed.
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Outcome-backed reviewer mix</p>
              <p className="mt-1 text-sm text-ink-500">Use this to see where the team is already calibrated and where extra committee discipline is still required.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Well calibrated</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.calibrationWorkspace.overview.wellCalibratedCount}</p>
              <p className="mt-2 text-sm text-ink-500">Reviewers whose override pattern is holding up against outcomes.</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Mixed</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.calibrationWorkspace.overview.mixedCount}</p>
              <p className="mt-2 text-sm text-ink-500">Files where calibration still needs tighter operating follow-through.</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Watch</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.calibrationWorkspace.overview.watchCount}</p>
              <p className="mt-2 text-sm text-ink-500">Reviewers whose overrides need direct governance attention.</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Needs data</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{data.calibrationWorkspace.overview.needsDataCount}</p>
              <p className="mt-2 text-sm text-ink-500">Reviewers who still need more observed outcomes before any conclusion is strong.</p>
            </div>
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-sm font-medium text-ink-900">Current pilot context</p>
            <p className="mt-2 text-sm leading-7 text-ink-600">
              {data.pilotProfile.designPartnerName} currently has {data.outcomes.positive + data.outcomes.negative} known sponsor outcomes recorded across the active workspace. That gives the calibration recommendations a real operating base rather than pure theory.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Reviewer calibration workstream</p>
            <p className="mt-1 text-sm text-ink-500">Persist owners, due dates, and escalation state for the reviewers who most affect underwriting quality.</p>
          </div>
          <div className="mt-5">
            <ReviewerCalibrationControls workspace={data.calibrationWorkspace} />
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Score recalibration queue</p>
            <p className="mt-1 text-sm text-ink-500">Outcome-backed suggestions for where the underlying heuristic should stay put, tighten, or loosen.</p>
          </div>
          <div className="mt-5 space-y-4">
            {data.recalibrationSuggestions.slice(0, 5).map((suggestion) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={suggestion.bucketLabel}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{suggestion.bucketLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={suggestion.priority === "high" ? "danger" : suggestion.priority === "medium" ? "gold" : "muted"}>
                      {suggestion.priority} priority
                    </Badge>
                    <Badge variant={suggestion.direction === "tighten" ? "danger" : suggestion.direction === "loosen" ? "gold" : "sage"}>
                      {suggestion.direction}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{suggestion.recommendation}</p>
                <p className="mt-3 text-sm text-ink-500">
                  {suggestion.knownOutcomeCount} known outcomes · {suggestion.falsePositiveCount} false positives · {suggestion.falseNegativeCount} false negatives
                </p>
              </div>
            ))}
            {data.recalibrationSuggestions.length === 0 ? (
              <p className="text-sm text-ink-500">No score recalibration suggestions are available yet.</p>
            ) : null}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
