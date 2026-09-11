import { Card } from "@/components/ui/card";
import { AnnotatedText } from "@/components/memo/annotated-text";

export function MemoDocument({
  candidateName,
  summary,
  rationale,
  strengths,
  risks,
  recommendedAction,
  status = "READY",
}: {
  candidateName: string;
  summary: string;
  rationale: string;
  strengths: string[];
  risks: string[];
  recommendedAction: string;
  status?: string;
}) {
  const showDraftBanner = status !== "READY";

  return (
    <Card className="print-frame px-8 py-8 md:px-12 md:py-10">
      {showDraftBanner ? (
        <div className="mb-6 rounded-[1.5rem] border border-gold-200 bg-gold-50 px-4 py-4">
          <p className="text-sm font-medium text-ink-900">Memo status: {status.replaceAll("_", " ")}</p>
          <p className="mt-2 text-sm leading-7 text-ink-600">
            This memo is not yet sponsor-ready. Review the evidence set, rerun generation, and verify the supporting artifacts before using it externally.
          </p>
        </div>
      ) : null}
      <div className="border-b border-ink-100 pb-6">
        <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Sponsor memo</p>
        <h1 className="mt-4 font-serif text-4xl text-ink-900">{candidateName}</h1>
        <div className="mt-4 max-w-3xl">
          <AnnotatedText text={summary} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-8">
          <div>
            <h2 className="font-serif text-2xl text-ink-900">Why this person is worth backing</h2>
            <div className="mt-3">
              <AnnotatedText text={rationale} />
            </div>
          </div>

          <div>
            <h2 className="font-serif text-2xl text-ink-900">Strongest evidence signals</h2>
            <div className="mt-4 space-y-4">
              {strengths.map((strength) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={strength}>
                  <AnnotatedText text={strength} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-8">
          <div className="rounded-[2rem] bg-ink-900 px-5 py-5 text-white">
            <p className="text-sm uppercase tracking-[0.22em] text-white/60">Recommended next advocacy action</p>
            <div className="mt-4">
              <AnnotatedText text={recommendedAction} tone="inverse" />
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
