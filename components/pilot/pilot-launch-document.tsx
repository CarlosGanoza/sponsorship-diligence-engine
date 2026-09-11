import { CheckSquare2, ShieldCheck, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function PilotLaunchDocument(input: {
  template: {
    label: string;
    audience: string;
    firstPilotGoal: string;
    designPartnerCommitments: string[];
    onboardingChecklist: Array<{
      title: string;
      owner: string;
      detail: string;
    }>;
    stakeholderMap: Array<{
      role: string;
      detail: string;
    }>;
    calibrationPlaybook: string[];
    buyerDeliverables: string[];
  };
  pilotProfile: {
    pilotName: string;
    designPartnerName: string;
    programName: string;
    primaryContactName: string;
    primaryContactEmail: string;
    packSummary: string;
    targetLaunchDateLabel: string;
  };
  launchPosture: {
    guidedDemoMode: boolean;
    blindReviewMode: boolean;
    strictEvidenceMode: boolean;
    requireOutboundApproval: boolean;
  };
  currentSlate: {
    candidateCount: number;
    sponsorReadyCount: number;
  };
  launchWorkstream: {
    items: Array<{
      slug: string;
      title: string;
      detail: string;
      currentOwner: string;
      status: "NOT_STARTED" | "IN_PROGRESS" | "READY";
      dueAt: string | null;
      note: string | null;
    }>;
    summary: {
      total: number;
      readyCount: number;
      statusLabel: "Launch ready" | "In launch prep" | "Not started";
      nextDueAt: string | null;
    };
  };
  healthStatus: "healthy" | "degraded" | "down" | "unhealthy";
}) {
  const { template, pilotProfile, launchPosture, currentSlate, launchWorkstream, healthStatus } = input;

  return (
    <div className="space-y-6 print:space-y-5" data-testid="pilot-launch-document">
      <Card className="overflow-hidden px-0 py-0">
        <div className="border-b border-ink-100 bg-[radial-gradient(circle_at_top_left,_rgba(154,165,139,0.18),_transparent_55%),linear-gradient(135deg,#f8f7f2_0%,#ffffff_100%)] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-400">Pilot Launch</p>
              <h2 className="mt-3 font-serif text-3xl text-ink-950">{pilotProfile.pilotName}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-600">{pilotProfile.packSummary}</p>
            </div>
            <div className="space-y-2">
              <Badge variant="sage">{template.label}</Badge>
              <Badge variant={healthStatus === "healthy" ? "sage" : healthStatus === "degraded" ? "gold" : "danger"}>
                Runtime {healthStatus}
              </Badge>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Design partner</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{pilotProfile.designPartnerName}</p>
              <p className="mt-2 text-sm text-ink-500">{pilotProfile.programName}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Primary contact</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{pilotProfile.primaryContactName}</p>
              <p className="mt-2 text-sm text-ink-500">{pilotProfile.primaryContactEmail}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Target launch</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{pilotProfile.targetLaunchDateLabel}</p>
              <p className="mt-2 text-sm text-ink-500">{launchWorkstream.summary.statusLabel}</p>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Current design-partner template</p>
            <p className="mt-1 text-sm leading-7 text-ink-500">
              The current workspace is packaged for <span className="font-medium text-ink-700">{template.label.toLowerCase()}</span>.
            </p>
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
              <p className="mt-2 font-serif text-3xl text-ink-900">{currentSlate.candidateCount}</p>
              <p className="mt-2 text-sm text-ink-500">Candidates currently available for launch-week calibration.</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Sponsor-ready now</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{currentSlate.sponsorReadyCount}</p>
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
            <Badge variant={launchPosture.guidedDemoMode ? "sage" : "muted"}>Guided demo {launchPosture.guidedDemoMode ? "enabled" : "off"}</Badge>
            <Badge variant={launchPosture.blindReviewMode ? "sage" : "muted"}>Blind review {launchPosture.blindReviewMode ? "enabled" : "off"}</Badge>
            <Badge variant={launchPosture.strictEvidenceMode ? "sage" : "gold"}>Strict evidence {launchPosture.strictEvidenceMode ? "enabled" : "off"}</Badge>
            <Badge variant={launchPosture.requireOutboundApproval ? "sage" : "gold"}>
              Outbound approval {launchPosture.requireOutboundApproval ? "required" : "optional"}
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

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Launch workstream</p>
            <p className="mt-1 text-sm text-ink-500">Turn the template checklist into explicit operating state instead of leaving it as a static plan.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="sage">{launchWorkstream.summary.statusLabel}</Badge>
            <Badge variant="muted">
              {launchWorkstream.summary.readyCount}/{launchWorkstream.summary.total} ready
            </Badge>
            {launchWorkstream.summary.nextDueAt ? <Badge variant="gold">Next due {launchWorkstream.summary.nextDueAt}</Badge> : null}
          </div>
          <div className="mt-5 space-y-4">
            {launchWorkstream.items.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item.slug}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{item.title}</p>
                  <Badge variant={item.status === "READY" ? "sage" : item.status === "IN_PROGRESS" ? "gold" : "muted"}>
                    {item.status.toLowerCase().replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.detail}</p>
                <p className="mt-3 text-sm text-ink-500">
                  Owner {item.currentOwner}
                  {item.dueAt ? ` · due ${item.dueAt}` : ""}
                </p>
                {item.note ? <p className="mt-2 text-sm text-ink-500">{item.note}</p> : null}
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
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
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.title}>
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
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
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
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item.role}>
                <p className="text-sm font-medium text-ink-900">{item.role}</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>

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
          <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-sm font-medium text-ink-900">Buyer-ready deliverables</p>
            <div className="mt-3 space-y-3">
              {template.buyerDeliverables.map((item) => (
                <p className="text-sm leading-7 text-ink-600" key={item}>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
