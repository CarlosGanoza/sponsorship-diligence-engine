import Link from "next/link";
import type { Route } from "next";

import { ArrowRight, Compass, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAnalyticsData, getAuditData, getDashboardData, getSettingsSnapshot } from "@/lib/db/queries";
import { buildPilotRoiModel, getPilotTemplate } from "@/lib/pilot/templates";

export default async function PilotPage() {
  const [settings, analytics, audits, dashboard] = await Promise.all([
    getSettingsSnapshot(),
    getAnalyticsData(),
    getAuditData(),
    getDashboardData(),
  ]);

  const openAlerts = Number(analytics.kpis.find((kpi) => kpi.label === "Open alerts")?.value ?? 0);
  const openTasks = Number(analytics.kpis.find((kpi) => kpi.label === "Open tasks")?.value ?? 0);
  const activePipelineCount = Number(analytics.kpis.find((kpi) => kpi.label === "Active pipeline")?.value ?? 0);

  const template = getPilotTemplate(settings.pilotTemplate);
  const roiModel = buildPilotRoiModel(template.key, {
    candidateCount: settings.counts.candidates,
    memoReadyCount: dashboard.candidates.filter((candidate) => candidate.sponsorMemo?.status === "READY").length,
    sponsorReadyCount: dashboard.sponsorReadyQueue.length,
    activePipelineCount,
    openAlerts,
    openTasks,
    knownOutcomeCount: analytics.outcomes.positive + analytics.outcomes.negative,
    positiveOutcomeCount: analytics.outcomes.positive,
    disagreementRate: audits.summary.disagreementRate,
    blindReviewMode: settings.blindReviewMode,
    strictEvidenceMode: settings.strictEvidenceMode,
    requireOutboundApproval: settings.requireOutboundApproval,
  });

  const featuredCandidate = dashboard.sponsorReadyQueue[0] ?? dashboard.candidates[0] ?? null;

  const walkthroughSteps = featuredCandidate
    ? [
        {
          label: "Open a sponsor-ready candidate",
          href: `/candidates/${featuredCandidate.id}` as Route,
          detail: "Start from a live file with evidence, readiness scoring, and traceability already visible.",
        },
        {
          label: "Read the memo variant",
          href: `/memos/${featuredCandidate.id}` as Route,
          detail: "Show how the same evidence base becomes an advocacy memo without inflating the case.",
        },
        {
          label: "Package the ask",
          href: `/briefs/${featuredCandidate.id}` as Route,
          detail: "Move from a memo to a sponsor-specific brief with proof to bring and success criteria.",
        },
        {
          label: "Pressure-test the execution path",
          href: `/outreach/${featuredCandidate.id}` as Route,
          detail: "Show approvals, outreach planning, and CRM handoff before anything leaves the workspace.",
        },
        {
          label: "Close with operating proof",
          href: "/roi" as Route,
          detail: "Finish with explicit pilot assumptions, current queue pressure, and governance controls.",
        },
      ]
    : [];

  return (
    <AppShell
      title="Pilot readiness"
      description="Frame the current workspace as a serious design-partner pilot, with a clear rollout, explicit success metrics, and a guided path for buyers."
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href={"/onboarding" as Route}>Pilot launch</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/commercial" as Route}>Commercial proof</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/calibration" as Route}>Calibration</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/pilot/report" as Route}>Proof report</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/pilot/pack" as Route}>Pilot brief</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/demo" as Route}>Guided demo</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/settings" as Route}>Pilot settings</Link>
          </Button>
          <Button asChild>
            <Link href={"/roi" as Route}>
              Executive ROI
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-6 py-6">
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Current pilot posture</p>
              <p className="mt-1 text-sm text-ink-500">
                The workspace is currently positioned for <span className="font-medium text-ink-700">{template.label.toLowerCase()}</span>.
              </p>
            </div>
            <Badge variant="sage">{template.label}</Badge>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Best first buyer</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.audience}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Why this template fits</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.whyItFits}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">First pilot goal</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.firstPilotGoal}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Current pilot identity</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">
                {settings.pilotProfile.pilotName} · {settings.pilotProfile.designPartnerName}
              </p>
            </div>
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Guided demo mode</p>
              <p className="mt-1 text-sm text-ink-500">
                {settings.guidedDemoMode
                  ? "Enabled. Use this as the recommended buyer walkthrough."
                  : "Disabled. The routes remain available, but the workspace is not pushing a default walkthrough."}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {walkthroughSteps.map((step, index) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={step.href}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">
                    {index + 1}. {step.label}
                  </p>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={step.href}>Open</Link>
                  </Button>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{step.detail}</p>
              </div>
            ))}
            {walkthroughSteps.length === 0 ? (
              <p className="text-sm text-ink-500">Seeded demo data is required before a guided walkthrough can be suggested.</p>
            ) : null}
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Launch state</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">
                {settings.pilotLaunchWorkstream.summary.readyCount} of {settings.pilotLaunchWorkstream.summary.total} launch items are ready. Use the guided demo only if that operating state matches the buyer conversation you want to have.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-4">
        <KpiCard
          detail="Current workspace slate"
          label="Active candidates"
          value={settings.counts.candidates}
        />
        <KpiCard
          detail="Files already ready for advocacy"
          label="Sponsor-ready files"
          value={dashboard.sponsorReadyQueue.length}
        />
        <KpiCard
          detail="Active sponsor paths in motion"
          label="Pipeline paths"
          value={roiModel.modeled.activePipelineCount}
        />
        <KpiCard
          detail="Known sponsor outcomes on record"
          label="Observed outcomes"
          value={analytics.outcomes.positive + analytics.outcomes.negative}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Pilot success criteria</p>
            <p className="mt-1 text-sm text-ink-500">These are the conditions this template should prove in the first live pilot.</p>
          </div>
          <div className="mt-5 space-y-4">
            {template.successMetrics.map((metric) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={metric}>
                <p className="text-sm leading-7 text-ink-600">{metric}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Thirty-day rollout</p>
            <p className="mt-1 text-sm text-ink-500">Use the product as a contained operating pilot, not a broad deployment.</p>
          </div>
          <div className="mt-5 space-y-4">
            {template.rolloutSteps.map((step) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={step}>
                <p className="text-sm leading-7 text-ink-600">{step}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Current workspace proof</p>
            <p className="mt-1 text-sm text-ink-500">Observed operating signals already present in this workspace.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Memo coverage</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{roiModel.modeled.memoCoverage}%</p>
              <p className="mt-2 text-sm text-ink-500">Candidates with a ready memo today</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Positive outcome rate</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{roiModel.modeled.positiveOutcomeRate}%</p>
              <p className="mt-2 text-sm text-ink-500">Among files with known outcomes</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Workflow pressure</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{roiModel.modeled.workflowPressure}</p>
              <p className="mt-2 text-sm text-ink-500">Open alerts plus open tasks</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Disagreement rate</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{roiModel.modeled.disagreementRate}%</p>
              <p className="mt-2 text-sm text-ink-500">Human vs guardrail underwriting disagreements</p>
            </div>
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Control posture</p>
              <p className="mt-1 text-sm text-ink-500">The pilot story is stronger when governance controls are explicit.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant={settings.blindReviewMode ? "sage" : "muted"}>
              Blind review {settings.blindReviewMode ? "on" : "off"}
            </Badge>
            <Badge variant={settings.strictEvidenceMode ? "sage" : "gold"}>
              Strict evidence {settings.strictEvidenceMode ? "on" : "off"}
            </Badge>
            <Badge variant={settings.requireOutboundApproval ? "sage" : "gold"}>
              Outbound approval {settings.requireOutboundApproval ? "required" : "optional"}
            </Badge>
          </div>
          <div className="mt-5 space-y-4">
            {template.demoFocus.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
