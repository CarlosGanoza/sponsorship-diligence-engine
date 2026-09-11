import type { ReviewStatus } from "@prisma/client";

import { AnnotatedText } from "@/components/memo/annotated-text";
import { ReviewBadge } from "@/components/dashboard/review-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { titleCase } from "@/lib/utils/strings";

type PacketEvidenceItem = {
  id: string;
  category: string;
  claim: string;
  supportingExcerpt: string;
  artifactTitle: string;
  confidence: number;
  reviewStatus: ReviewStatus;
  reviewNote?: string | null;
};

type ReviewNoteItem = {
  id: string;
  kind: string;
  label: string;
  note?: string | null;
};

export function SponsorPacketDocument({
  candidateName,
  candidateHeadline,
  candidateRegion,
  sponsorName,
  sponsorTitle,
  sponsorOrganization,
  readinessScore,
  matchScore,
  fitBreakdown,
  memoSummary,
  sponsorAngle,
  recommendedAsk,
  recommendedAction,
  warmPath,
  warmPathNote,
  strengths,
  risks,
  evidence,
  flaggedItems,
}: {
  candidateName: string;
  candidateHeadline: string;
  candidateRegion: string;
  sponsorName: string;
  sponsorTitle: string;
  sponsorOrganization: string;
  readinessScore: number;
  matchScore: number;
  fitBreakdown: Record<string, number>;
  memoSummary: string;
  sponsorAngle: string;
  recommendedAsk: string;
  recommendedAction: string;
  warmPath: string[];
  warmPathNote: string;
  strengths: string[];
  risks: string[];
  evidence: PacketEvidenceItem[];
  flaggedItems: ReviewNoteItem[];
}) {
  return (
    <Card className="print-frame px-8 py-8 md:px-12 md:py-10">
      <div className="border-b border-ink-100 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Internal sponsor packet</p>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl text-ink-900">{candidateName}</h1>
            <p className="mt-3 text-sm leading-7 text-ink-500">
              {candidateHeadline} · {candidateRegion}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="muted">Target sponsor</Badge>
              <Badge variant="sage">{sponsorName}</Badge>
              <Badge variant="muted">
                {sponsorTitle} · {sponsorOrganization}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4 text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Readiness</p>
              <p className="mt-2 font-serif text-4xl text-ink-900">{readinessScore}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4 text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Sponsor fit</p>
              <p className="mt-2 font-serif text-4xl text-ink-900">{matchScore}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl text-ink-900">Executive packet summary</h2>
            <div className="mt-3">
              <AnnotatedText text={memoSummary} />
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Why this sponsor now</h2>
            <div className="mt-3">
              <AnnotatedText text={sponsorAngle} />
            </div>
          </div>

          <div className="rounded-[2rem] bg-ink-900 px-5 py-5 text-white">
            <p className="text-sm uppercase tracking-[0.22em] text-white/60">Recommended sponsor ask</p>
            <div className="mt-4">
              <AnnotatedText text={recommendedAsk} tone="inverse" />
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <AnnotatedText text={recommendedAction} tone="inverse" />
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Evidence packet</h2>
            <div className="mt-4 space-y-4">
              {evidence.map((item) => (
                <div className="print-avoid-break rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="sage">{titleCase(item.category)}</Badge>
                      <Badge variant="muted">{item.artifactTitle}</Badge>
                      <ReviewBadge status={item.reviewStatus} />
                    </div>
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-400">
                      Confidence {Math.round(item.confidence * 100)}%
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-700">{item.claim}</p>
                  <p className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm italic leading-7 text-ink-500">
                    &ldquo;{item.supportingExcerpt}&rdquo;
                  </p>
                  {item.reviewNote ? <p className="mt-3 text-sm leading-7 text-ink-500">{item.reviewNote}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl text-ink-900">Warm path and match logic</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Object.entries(fitBreakdown).map(([key, value]) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={key}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{titleCase(key)}</p>
                  <p className="mt-2 font-serif text-3xl text-ink-900">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Connection path</p>
              <div className="mt-3 space-y-2">
                {warmPath.map((step) => (
                  <p className="text-sm leading-7 text-ink-600" key={step}>
                    {step}
                  </p>
                ))}
              </div>
              <p className="mt-4 text-sm leading-7 text-ink-500">{warmPathNote}</p>
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Strongest signals to cite</h2>
            <div className="mt-4 space-y-4">
              {strengths.map((strength) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={strength}>
                  <AnnotatedText text={strength} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Review notes and cautions</h2>
            <div className="mt-4 space-y-4">
              {flaggedItems.length > 0 ? (
                flaggedItems.map((item) => (
                  <div className="rounded-[1.5rem] border border-gold-200 bg-gold-50 px-4 py-4" key={item.id}>
                    <p className="text-xs uppercase tracking-[0.18em] text-gold-700">{item.kind}</p>
                    <p className="mt-2 text-sm leading-7 text-ink-700">{item.label}</p>
                    {item.note ? <p className="mt-2 text-sm leading-7 text-ink-500">{item.note}</p> : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                  <p className="text-sm leading-7 text-ink-500">No flagged review notes are currently recorded.</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Risks and open questions</h2>
            <div className="mt-4 space-y-4">
              {risks.map((risk) => (
                <div className="rounded-[1.5rem] border border-gold-200 bg-gold-50 px-4 py-4" key={risk}>
                  <AnnotatedText text={risk} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}
