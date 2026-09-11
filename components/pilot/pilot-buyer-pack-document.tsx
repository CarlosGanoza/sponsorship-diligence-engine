import { BadgeCheck, BriefcaseBusiness, FileBarChart2, ShieldCheck } from "lucide-react";

import type { PilotBuyerPackModel } from "@/lib/pilot/pack";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function criterionVariant(status: "ready" | "watch" | "blocked") {
  if (status === "ready") {
    return "sage" as const;
  }

  if (status === "watch") {
    return "gold" as const;
  }

  return "danger" as const;
}

export function PilotBuyerPackDocument(input: {
  buyerPack: PilotBuyerPackModel;
  pilotProfile: {
    designPartnerName: string;
    programName: string;
    primaryContactName: string;
    primaryContactEmail: string;
    packSummary: string;
  };
  template: {
    label: string;
  };
  healthStatus: "healthy" | "degraded" | "down" | "unhealthy";
}) {
  const { buyerPack, pilotProfile, template, healthStatus } = input;

  return (
    <div className="space-y-6 print:space-y-5" data-testid="pilot-buyer-pack">
      <Card className="overflow-hidden px-0 py-0">
        <div className="border-b border-ink-100 bg-[radial-gradient(circle_at_top_left,_rgba(185,164,101,0.16),_transparent_52%),linear-gradient(135deg,#f8f7f2_0%,#ffffff_100%)] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-400">Design-Partner Buyer Pack</p>
              <h2 className="mt-3 font-serif text-3xl text-ink-950">{buyerPack.title}</h2>
              <p className="mt-2 text-sm text-ink-500">{buyerPack.subtitle}</p>
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
              <p className="mt-1 text-sm text-ink-500">{pilotProfile.programName}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Primary contact</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{pilotProfile.primaryContactName}</p>
              <p className="mt-1 text-sm text-ink-500">{pilotProfile.primaryContactEmail}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Recommendation</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{buyerPack.recommendationLabel}</p>
              <p className="mt-1 text-sm text-ink-500">{buyerPack.measuredDecision.label}</p>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Current recommendation</p>
              <p className="mt-1 text-sm text-ink-500">Lead with the measured decision, not only the template story.</p>
            </div>
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <p className="text-lg font-medium text-ink-950">{buyerPack.recommendationLabel}</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">{buyerPack.recommendationDetail}</p>
            <p className="mt-3 text-sm text-ink-500">{buyerPack.measuredDecision.detail}</p>
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">What is already proven</p>
              <p className="mt-1 text-sm text-ink-500">These are workspace facts already earned inside the pilot.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {buyerPack.observedProofHighlights.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <FileBarChart2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Measured movement</p>
              <p className="mt-1 text-sm text-ink-500">Bring measured pilot movement into the packet when it exists.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {buyerPack.measuredMovementHighlights.length > 0 ? (
              buyerPack.measuredMovementHighlights.map((item) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.label}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-900">{item.label}</p>
                    <Badge variant="sage">{item.deltaLabel}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-600">{item.detail}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-ink-200 bg-ink-50 px-4 py-5">
                <p className="text-sm leading-7 text-ink-600">
                  No baseline-and-checkpoint pair is on file yet, so this packet still relies on live workflow proof and modeled economics rather than measured pilot movement.
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Modeled economics</p>
              <p className="mt-1 text-sm text-ink-500">Keep these assumptions labeled as planning numbers.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {buyerPack.modeledEconomicsHighlights.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item.label}>
                <p className="text-sm text-ink-500">{item.label}</p>
                <p className="mt-2 font-serif text-3xl text-ink-900">{item.value}</p>
                <p className="mt-2 text-sm text-ink-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Go / hold criteria</p>
            <p className="mt-1 text-sm text-ink-500">Use explicit criteria so the buyer knows what still has to be true for a live pilot.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {buyerPack.goNoGoCriteria.map((criterion) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={criterion.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{criterion.label}</p>
                  <Badge variant={criterionVariant(criterion.status)}>{criterion.status}</Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{criterion.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Next moves and success criteria</p>
            <p className="mt-1 text-sm text-ink-500">Keep the next step tied to proof the buyer can verify.</p>
          </div>
          <div className="mt-5 space-y-4">
            {buyerPack.nextMoves.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <p className="text-sm font-medium text-ink-900">Success criteria</p>
            <div className="mt-3 space-y-3">
              {buyerPack.successMetrics.map((item) => (
                <p className="text-sm leading-7 text-ink-600" key={item}>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Buyer-ready deliverables</p>
            <p className="mt-1 text-sm text-ink-500">What the buyer should have in front of them during evaluation.</p>
          </div>
          <div className="mt-5 space-y-4">
            {buyerPack.buyerDeliverables.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Likely buyer objections</p>
            <p className="mt-1 text-sm text-ink-500">Pressure-test the pilot with the same objections a real partner should ask.</p>
          </div>
          <div className="mt-5 space-y-4">
            {buyerPack.buyerObjections.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item.objection}>
                <p className="text-sm font-medium text-ink-900">{item.objection}</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.response}</p>
                <p className="mt-3 text-sm text-ink-500">Proof to show: {item.proofPoint}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
