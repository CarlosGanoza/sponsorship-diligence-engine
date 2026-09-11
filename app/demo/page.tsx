import Link from "next/link";
import type { Route } from "next";

import { ArrowRight, Compass, FileSearch, Presentation, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAnalyticsData, getDashboardData, getPilotMeasurementData, getSettingsSnapshot } from "@/lib/db/queries";
import { buildCommercialReadinessModel } from "@/lib/pilot/commercial";
import { getPilotTemplate } from "@/lib/pilot/templates";
import { getDeploymentHealthSnapshot } from "@/lib/runtime/health";
import { formatDate } from "@/lib/utils/format";

export default async function DemoPage() {
  const [settings, dashboard, pilotData, analytics, health] = await Promise.all([
    getSettingsSnapshot(),
    getDashboardData(),
    getPilotMeasurementData(),
    getAnalyticsData(),
    getDeploymentHealthSnapshot(),
  ]);

  const template = getPilotTemplate(settings.pilotTemplate);
  const featuredCandidate = dashboard.sponsorReadyQueue[0] ?? dashboard.candidates[0] ?? null;
  const checkpointCount = pilotData.recentSnapshots.filter((snapshot) => snapshot.snapshotType === "CHECKPOINT").length;
  const readiness = buildCommercialReadinessModel({
    candidateCount: pilotData.currentMetrics.candidateCount,
    memoReadyCount: pilotData.currentMetrics.memoReadyCount,
    sponsorReadyCount: pilotData.currentMetrics.sponsorReadyCount,
    activePipelineCount: pilotData.currentMetrics.activePipelineCount,
    knownOutcomeCount: pilotData.currentMetrics.knownOutcomeCount,
    positiveOutcomeCount: pilotData.currentMetrics.positiveOutcomeCount,
    openAlerts: pilotData.currentMetrics.openAlertsCount,
    openTasks: pilotData.currentMetrics.openTasksCount,
    checkpointCount,
    hasMeasuredBaseline: Boolean(pilotData.baseline),
    guidedDemoMode: settings.guidedDemoMode,
    blindReviewMode: settings.blindReviewMode,
    strictEvidenceMode: settings.strictEvidenceMode,
    requireOutboundApproval: settings.requireOutboundApproval,
    healthStatus: health.status === "down" ? "unhealthy" : health.status,
  });

  const walkthroughSteps = featuredCandidate
    ? [
        {
          title: "Start with the underwriting file",
          href: `/candidates/${featuredCandidate.id}` as Route,
          whyItMatters: "This is the fastest way to prove the product is not a social profile or a generic CRM record.",
          operatorTalkTrack:
            "Open the evidence panel, score breakdown, and missing-proof state first. Make the buyer see restraint before recommendation.",
        },
        {
          title: "Read the sponsor memo variant",
          href: `/memos/${featuredCandidate.id}` as Route,
          whyItMatters: "Show that the narrative changes by sponsor target while remaining grounded in the same proof base.",
          operatorTalkTrack:
            "Emphasize that every strong statement is tied back to evidence claims and that weak support pushes the file into hold or review.",
        },
        {
          title: "Package the ask",
          href: `/briefs/${featuredCandidate.id}` as Route,
          whyItMatters: "This makes the jump from internal conviction to an explicit sponsor ask with success criteria and proof to bring.",
          operatorTalkTrack:
            "Position the brief as the operational unit of sponsorship, not as polished applicant marketing.",
        },
        {
          title: "Pressure-test execution",
          href: `/outreach/${featuredCandidate.id}` as Route,
          whyItMatters: "Approvals, CRM handoff, and sponsor activity all need to exist before a buyer trusts external motion.",
          operatorTalkTrack:
            "Use the approval gates and outbound controls to show that the system is willing to block movement when the file is not strong enough.",
        },
        {
          title: "Close with buyer proof",
          href: "/commercial" as Route,
          whyItMatters: "Commercial proof, ROI, and launch workstream status tell the buyer what is earned already versus what still needs proof.",
          operatorTalkTrack:
            "Finish by separating observed outcomes from modeled benefits. It keeps the pitch sober and credible.",
        },
        {
          title: "Hand over the proof report",
          href: "/pilot/report" as Route,
          whyItMatters: "A single measured report is easier for a design partner to review than a stitched-together walkthrough of multiple product pages.",
          operatorTalkTrack:
            "Use the report to restate the recommendation, go or hold criteria, calibration posture, and what remains modeled instead of proven.",
        },
      ]
    : [];

  return (
    <AppShell
      title="Guided demo"
      description="A recommended buyer walkthrough for the current pilot posture, grounded in the same launch profile, workstream, and operating proof used across the workspace."
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href={"/pilot" as Route}>Pilot readiness</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/onboarding" as Route}>Pilot launch</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/commercial" as Route}>Commercial proof</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/pilot/report" as Route}>Proof report</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/calibration" as Route}>Calibration</Link>
          </Button>
          <Button asChild>
            <Link href={"/pilot/pack" as Route}>
              Pilot brief
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-5 xl:grid-cols-4">
        <KpiCard detail="Current buyer-motion posture" label="Commercial stage" value={readiness.stageLabel} />
        <KpiCard detail="Template launch workstream completion" label="Launch completion" value={`${settings.pilotLaunchWorkstream.summary.completionRate}%`} />
        <KpiCard detail="Files already strong enough for the walkthrough" label="Sponsor-ready files" value={dashboard.sponsorReadyQueue.length} />
        <KpiCard detail="Positive and negative sponsor outcomes logged" label="Known outcomes" value={analytics.outcomes.positive + analytics.outcomes.negative} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6" data-testid="pilot-profile-card">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <Presentation className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">{settings.pilotProfile.pilotName}</p>
              <p className="mt-1 text-sm text-ink-500">
                Prepared for <span className="font-medium text-ink-700">{settings.pilotProfile.designPartnerName}</span> · {settings.pilotProfile.programName}
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Pilot summary</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{settings.pilotProfile.packSummary}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Primary contact</p>
                <p className="mt-2 text-sm font-medium text-ink-900">{settings.pilotProfile.primaryContactName}</p>
                <p className="mt-1 text-sm text-ink-500">{settings.pilotProfile.primaryContactEmail}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Target launch</p>
                <p className="mt-2 text-sm font-medium text-ink-900">
                  {settings.pilotProfile.targetLaunchDate ? formatDate(settings.pilotProfile.targetLaunchDate) : "Not scheduled"}
                </p>
                <p className="mt-1 text-sm text-ink-500">{template.label} template selected</p>
              </div>
            </div>
            {featuredCandidate ? (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Recommended anchor candidate</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">
                  Start with <span className="font-medium text-ink-700">{featuredCandidate.fullName}</span> to make the demo concrete. The file already has a memo path, visible evidence, and a live sponsor-fit surface.
                </p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Launch and buyer posture</p>
              <p className="mt-1 text-sm text-ink-500">Use this to decide whether the walkthrough should stay internal or be used in a real design-partner conversation.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="sage">{settings.pilotLaunchWorkstream.summary.statusLabel}</Badge>
            <Badge variant={settings.guidedDemoMode ? "sage" : "muted"}>Guided demo {settings.guidedDemoMode ? "on" : "off"}</Badge>
            <Badge variant={health.status === "healthy" ? "sage" : health.status === "degraded" ? "gold" : "danger"}>Deployment {health.status}</Badge>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Ready launch items</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{settings.pilotLaunchWorkstream.summary.readyCount}</p>
              <p className="mt-2 text-sm text-ink-500">Out of {settings.pilotLaunchWorkstream.summary.total} total checklist items</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Next due item</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">
                {settings.pilotLaunchWorkstream.summary.nextDueAt ? formatDate(settings.pilotLaunchWorkstream.summary.nextDueAt) : "None"}
              </p>
              <p className="mt-2 text-sm text-ink-500">Overdue items: {settings.pilotLaunchWorkstream.summary.overdueCount}</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {settings.pilotLaunchWorkstream.summary.blockers.length > 0 ? (
              settings.pilotLaunchWorkstream.summary.blockers.map((blocker) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={blocker}>
                  <p className="text-sm leading-7 text-ink-600">{blocker}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-sm leading-7 text-ink-600">The current template checklist is fully ready. This is the right time to run a live buyer walkthrough instead of an internal rehearsal.</p>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]" data-testid="guided-demo-steps">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Recommended walkthrough</p>
            <p className="mt-1 text-sm text-ink-500">A sober sequence for design partners: start with proof, then show narrative, then show operational controls.</p>
          </div>
          <div className="mt-5 space-y-4">
            {walkthroughSteps.map((step, index) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={step.href}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">
                    {index + 1}. {step.title}
                  </p>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={step.href}>Open</Link>
                  </Button>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{step.whyItMatters}</p>
                <p className="mt-3 text-sm text-ink-500">Talk track: {step.operatorTalkTrack}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">What to emphasize in the room</p>
              <p className="mt-1 text-sm text-ink-500">Keep the buyer focused on underwriting discipline, not product theater.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {template.demoFocus.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-sage-700" />
              <p className="text-sm leading-7 text-ink-600">
                The demo should end on governance and outcome proof, not on AI novelty. If the buyer leaves remembering controls, proof requests, and sponsor-path discipline, the product is being positioned correctly.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="sm" variant="secondary">
              <Link href={"/commercial" as Route}>Open commercial proof</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={"/roi" as Route}>Open ROI page</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={"/pilot/pack" as Route}>Open pilot brief</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={"/pilot/report" as Route}>Open proof report</Link>
            </Button>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
