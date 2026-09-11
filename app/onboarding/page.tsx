import Link from "next/link";
import type { Route } from "next";
import { PilotReviewShareLinkType, ReviewShareLinkStatus } from "@prisma/client";

import { ArrowRight, CheckSquare2, ShieldCheck, UsersRound } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { PilotLaunchWorkstreamControls } from "@/components/pilot/pilot-launch-workstream-controls";
import { PilotProfileControls } from "@/components/pilot/pilot-profile-controls";
import { PilotReviewShareLinkControls } from "@/components/pilot/pilot-review-share-link-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";
import { requirePageSession } from "@/lib/auth/session";
import { getPilotLaunchData } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";

export default async function OnboardingPage() {
  const session = await requirePageSession();
  const [data, activeShareLink] = await Promise.all([
    getPilotLaunchData(),
    prisma.pilotReviewShareLink.findFirst({
      where: {
        organizationId: session.organizationId,
        linkType: PilotReviewShareLinkType.ONBOARDING,
        status: ReviewShareLinkStatus.ACTIVE,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const { settings, dashboard, health, template } = data;

  return (
    <AppShell
      title="Pilot launch"
      description="Template-specific onboarding, calibration, and buyer-readiness guidance for the first design-partner deployment."
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href={"/pilot" as Route}>Pilot readiness</Link>
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
          <Button asChild>
            <Link href={"/roi" as Route}>
              Executive ROI
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <Card className="print-hidden px-5 py-5">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Share-safe buyer review</p>
          <p className="mt-1 text-sm text-ink-500">
            Create a time-bounded read-only link for the pilot launch brief without exposing the wider workspace.
          </p>
        </div>
        <div className="mt-5">
          <PilotReviewShareLinkControls
            existingLink={
              activeShareLink
                ? {
                    id: activeShareLink.id,
                    token: activeShareLink.token,
                    expiresAtLabel: activeShareLink.expiresAt.toLocaleDateString(),
                    lastUsedAtLabel: activeShareLink.lastUsedAt ? activeShareLink.lastUsedAt.toLocaleDateString() : null,
                  }
                : null
            }
            linkType="ONBOARDING"
          />
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-6 py-6">
          <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Current design-partner template</p>
              <p className="mt-1 text-sm leading-7 text-ink-500">
                The current workspace is packaged for <span className="font-medium text-ink-700">{template.label.toLowerCase()}</span>.
              </p>
            </div>
            <Badge variant="sage">{template.label}</Badge>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Best first buyer</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.audience}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Pilot goal</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.firstPilotGoal}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Current slate</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{dashboard.candidates.length}</p>
              <p className="mt-2 text-sm text-ink-500">Candidates currently available for launch-week calibration.</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Sponsor-ready now</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{dashboard.sponsorReadyQueue.length}</p>
              <p className="mt-2 text-sm text-ink-500">Files already strong enough to anchor a buyer walkthrough.</p>
            </div>
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Launch posture</p>
              <p className="mt-1 text-sm text-ink-500">Use this to judge whether the workspace is credible enough for a live pilot conversation.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant={settings.guidedDemoMode ? "sage" : "muted"}>
              Guided demo {settings.guidedDemoMode ? "enabled" : "off"}
            </Badge>
            <Badge variant={settings.blindReviewMode ? "sage" : "muted"}>
              Blind review {settings.blindReviewMode ? "enabled" : "off"}
            </Badge>
            <Badge variant={settings.strictEvidenceMode ? "sage" : "gold"}>
              Strict evidence {settings.strictEvidenceMode ? "enabled" : "off"}
            </Badge>
            <Badge variant={settings.requireOutboundApproval ? "sage" : "gold"}>
              Outbound approval {settings.requireOutboundApproval ? "required" : "optional"}
            </Badge>
            <Badge variant={health.status === "healthy" ? "sage" : health.status === "degraded" ? "gold" : "danger"}>
              Deployment {health.status}
            </Badge>
          </div>
          <div className="mt-5 space-y-4">
            {template.designPartnerCommitments.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Buyer-facing pilot identity</p>
            <p className="mt-1 text-sm text-ink-500">Keep the launch narrative explicit so the buyer knows who the pilot is for, who owns it, and when it is meant to go live.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Pilot name</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{settings.pilotProfile.pilotName}</p>
              <p className="mt-2 text-sm text-ink-500">{settings.pilotProfile.packSummary}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Design partner</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{settings.pilotProfile.designPartnerName}</p>
              <p className="mt-2 text-sm text-ink-500">{settings.pilotProfile.programName}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Primary contact</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{settings.pilotProfile.primaryContactName}</p>
              <p className="mt-2 text-sm text-ink-500">{settings.pilotProfile.primaryContactEmail}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Target launch</p>
              <p className="mt-2 text-sm font-medium text-ink-900">
                {settings.pilotProfile.targetLaunchDate ? formatDate(settings.pilotProfile.targetLaunchDate) : "Not scheduled"}
              </p>
              <p className="mt-2 text-sm text-ink-500">{settings.pilotLaunchWorkstream.summary.statusLabel}</p>
            </div>
          </div>
          <div className="mt-5">
            <PilotProfileControls profile={settings.pilotProfile} />
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Launch workstream</p>
            <p className="mt-1 text-sm text-ink-500">Turn the template checklist into explicit operating state instead of leaving it as a static page.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="sage">{settings.pilotLaunchWorkstream.summary.statusLabel}</Badge>
            <Badge variant="muted">{settings.pilotLaunchWorkstream.summary.readyCount}/{settings.pilotLaunchWorkstream.summary.total} ready</Badge>
            {settings.pilotLaunchWorkstream.summary.nextDueAt ? (
              <Badge variant="gold">Next due {formatDate(settings.pilotLaunchWorkstream.summary.nextDueAt)}</Badge>
            ) : null}
          </div>
          <div className="mt-5">
            <PilotLaunchWorkstreamControls workstream={settings.pilotLaunchWorkstream} />
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="px-6 py-6" data-testid="pilot-launch-checklist">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <CheckSquare2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">First launch checklist</p>
              <p className="mt-1 text-sm text-ink-500">Concrete work to finish before treating the workspace as a live design-partner pilot.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {template.onboardingChecklist.map((item, index) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item.title}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">
                    {index + 1}. {item.title}
                  </p>
                  <Badge variant="muted">{item.owner}</Badge>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Who needs to be in the room</p>
              <p className="mt-1 text-sm text-ink-500">A pilot stalls when the right buyer, operator, and reviewer are not explicitly named.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {template.stakeholderMap.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.role}>
                <p className="text-sm font-medium text-ink-900">{item.role}</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Reviewer calibration playbook</p>
          <p className="mt-1 text-sm text-ink-500">Keep the pilot disciplined enough that a buyer sees underwriting, not workflow theater.</p>
          <div className="mt-5 space-y-4">
            {template.calibrationPlaybook.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Buyer-ready deliverables</p>
          <p className="mt-1 text-sm text-ink-500">Use these artifacts to move from interest to a real design-partner evaluation.</p>
          <div className="mt-5 space-y-4">
            {template.buyerDeliverables.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild size="sm" variant="secondary">
              <Link href={"/pilot/pack" as Route}>Open pilot brief</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={"/commercial" as Route}>Open commercial proof</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={"/roi" as Route}>Open ROI view</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={"/audits" as Route}>Open audit summary</Link>
            </Button>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
