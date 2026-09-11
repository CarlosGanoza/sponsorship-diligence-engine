import { BriefStatus } from "@prisma/client";

import { AnnotatedText } from "@/components/memo/annotated-text";
import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function OpportunityBriefDocument({
  candidateName,
  sponsorName,
  sponsorOrganization,
  title,
  status,
  summary,
  whyNow,
  sponsorAsk,
  talkingPoints,
  proofToBring,
  successIndicators,
}: {
  candidateName: string;
  sponsorName: string;
  sponsorOrganization: string;
  title: string;
  status: BriefStatus | string;
  summary: string;
  whyNow: string;
  sponsorAsk: string;
  talkingPoints: string[];
  proofToBring: string[];
  successIndicators: string[];
}) {
  return (
    <Card className="print-frame px-8 py-8 md:px-12 md:py-10">
      <div className="border-b border-ink-100 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Opportunity brief</p>
            <h1 className="mt-4 font-serif text-4xl text-ink-900">{title}</h1>
            <p className="mt-3 text-sm leading-7 text-ink-500">
              {candidateName} · {sponsorName} · {sponsorOrganization}
            </p>
          </div>
          <BriefStatusBadge status={status} />
        </div>
        <div className="mt-5 max-w-3xl">
          <AnnotatedText text={summary} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl text-ink-900">Why now</h2>
            <div className="mt-3">
              <AnnotatedText text={whyNow} />
            </div>
          </div>

          <div className="rounded-[2rem] bg-ink-900 px-5 py-5 text-white">
            <p className="text-sm uppercase tracking-[0.22em] text-white/60">Recommended sponsor ask</p>
            <div className="mt-4">
              <AnnotatedText text={sponsorAsk} tone="inverse" />
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Talking points</h2>
            <div className="mt-4 space-y-4">
              {talkingPoints.map((item) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                  <AnnotatedText text={item} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl text-ink-900">Proof to bring</h2>
            <div className="mt-4 space-y-4">
              {proofToBring.map((item) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                  <AnnotatedText text={item} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Success indicators</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {successIndicators.map((item) => (
                <Badge key={item} variant="sage">
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}
