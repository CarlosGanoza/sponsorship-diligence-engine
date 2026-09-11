import { BriefcaseBusiness, ShieldCheck } from "lucide-react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function CommercialProofDocument(input: {
  readiness: {
    score: number;
    stageLabel: string;
    breakdown: Array<{
      label: string;
      score: number;
      maxScore: number;
      detail: string;
    }>;
    gaps: string[];
    nextMoves: string[];
  };
  template: {
    label: string;
    audience: string;
    whyItFits: string;
    firstPilotGoal: string;
    buyerObjections: Array<{
      objection: string;
      response: string;
      proofPoint: string;
    }>;
    commercialMilestones: Array<{
      title: string;
      owner: string;
      detail: string;
    }>;
  };
  pilotProfile: {
    pilotName: string;
    designPartnerName: string;
    packSummary: string;
  };
  healthStatus: "healthy" | "degraded" | "down" | "unhealthy";
}) {
  const { readiness, template, pilotProfile, healthStatus } = input;

  return (
    <div className="space-y-6 print:space-y-5" data-testid="commercial-proof-document">
      <Card className="overflow-hidden px-0 py-0">
        <div className="border-b border-ink-100 bg-[radial-gradient(circle_at_top_left,_rgba(185,164,101,0.16),_transparent_52%),linear-gradient(135deg,#f8f7f2_0%,#ffffff_100%)] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-400">Commercial Proof</p>
              <h2 className="mt-3 font-serif text-3xl text-ink-950">Commercial proof for {pilotProfile.designPartnerName}</h2>
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
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Commercial readiness</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{readiness.score}</p>
              <p className="mt-2 text-sm text-ink-500">Heuristic operating score, not demand proof.</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Stage</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{readiness.stageLabel}</p>
              <p className="mt-2 text-sm text-ink-500">Current buyer-motion posture for the workspace.</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Design partner</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{pilotProfile.pilotName}</p>
              <p className="mt-2 text-sm text-ink-500">{pilotProfile.designPartnerName}</p>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-4">
        <KpiCard detail="Current buyer-motion posture" label="Stage" value={readiness.stageLabel} />
        <KpiCard detail="Explicit readiness gaps before a stronger design-partner motion" label="Readiness gaps" value={readiness.gaps.length} />
        <KpiCard detail="Concrete commercial milestones in the current template" label="Milestones" value={template.commercialMilestones.length} />
        <KpiCard detail="Likely objections the buyer should pressure-test" label="Buyer objections" value={template.buyerObjections.length} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-6 py-6" data-testid="commercial-readiness-breakdown">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Best buyer motion now</p>
              <p className="mt-1 text-sm text-ink-500">
                Use the current <span className="font-medium text-ink-700">{template.label.toLowerCase()}</span> template as the first commercial wedge.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Audience</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.audience}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Why this can sell first</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.whyItFits}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">What the buyer is really purchasing</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.firstPilotGoal}</p>
            </div>
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Commercial readiness breakdown</p>
              <p className="mt-1 text-sm text-ink-500">Explicit operating readiness for buyer conversations, not a forecast of demand.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {readiness.breakdown.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.label}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{item.label}</p>
                  <Badge variant="muted">
                    {item.score}/{item.maxScore}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Likely buyer objections</p>
            <p className="mt-1 text-sm text-ink-500">Use these to pressure-test whether the workspace earns trust instead of only sounding polished.</p>
          </div>
          <div className="mt-5 space-y-4">
            {template.buyerObjections.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item.objection}>
                <p className="text-sm font-medium text-ink-900">{item.objection}</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.response}</p>
                <p className="mt-3 text-sm text-ink-500">Proof to show: {item.proofPoint}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Commercial milestones</p>
            <p className="mt-1 text-sm text-ink-500">These are the proof points that move the product from design-partner interest to a credible first expansion motion.</p>
          </div>
          <div className="mt-5 space-y-4">
            {template.commercialMilestones.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.title}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{item.title}</p>
                  <Badge variant="sage">{item.owner}</Badge>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">What is still missing</p>
            <p className="mt-1 text-sm text-ink-500">These are the main reasons the current workspace is not yet stronger commercial proof.</p>
          </div>
          <div className="mt-5 space-y-4">
            {readiness.gaps.length > 0 ? (
              readiness.gaps.map((gap) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={gap}>
                  <p className="text-sm leading-7 text-ink-600">{gap}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm leading-7 text-ink-600">No commercial readiness gaps are currently surfaced in this view.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Next buyer moves</p>
            <p className="mt-1 text-sm text-ink-500">Use the next motion to add real proof, not more feature surface.</p>
          </div>
          <div className="mt-5 space-y-4">
            {readiness.nextMoves.map((move) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={move}>
                <p className="text-sm leading-7 text-ink-600">{move}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
