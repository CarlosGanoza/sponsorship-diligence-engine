import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { AppShell } from "@/components/dashboard/app-shell";
import { ScoreBreakdownCard } from "@/components/dashboard/score-breakdown-card";
import { OpportunityBriefDocument } from "@/components/briefs/opportunity-brief-document";
import { PrintButton } from "@/components/memo/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCandidateDetail, searchValueToString } from "@/lib/db/queries";

export default async function OpportunityBriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ candidateId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { candidateId } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const selectedSponsorId = searchValueToString(resolvedSearch.sponsor);
  const data = await getCandidateDetail(candidateId);

  if (!data) {
    notFound();
  }

  const selectedBrief =
    data.opportunityBriefs.find((brief) => brief.sponsorId === selectedSponsorId) ?? data.opportunityBriefs[0] ?? null;
  const selectedMatch = selectedBrief
    ? data.sponsorMatches.find((match) => match.sponsor.id === selectedBrief.sponsorId) ?? null
    : null;
  const selectedWarmPath =
    selectedBrief
      ? data.recommendations.warmPaths.find((item) => item.sponsorId === selectedBrief.sponsorId) ?? null
      : null;

  if (!selectedBrief) {
    return (
      <AppShell
        title={`Opportunity brief · ${data.candidate.fullName}`}
        description="Opportunity briefs are generated after memo and recommendation generation."
        actions={
          <Button asChild>
            <Link href={`/candidates/${data.candidate.id}`}>Back to candidate</Link>
          </Button>
        }
      >
        <Card className="px-6 py-8">
          <p className="font-medium text-ink-900">No opportunity briefs yet</p>
          <p className="mt-3 text-sm leading-7 text-ink-500">
            Generate briefs from the candidate page to package a sponsor-specific ask.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Opportunity brief · ${data.candidate.fullName}`}
      description="Sponsor-targeted internal brief with the ask, proof set, and success criteria needed before outreach."
      actions={
        <>
          <div className="print-hidden">
            <PrintButton />
          </div>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/api/exports/${data.candidate.id}?type=brief&format=md&sponsor=${selectedBrief.sponsorId}` as Route}>
              Export Markdown
            </Link>
          </Button>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/memos/${data.candidate.id}?sponsor=${selectedBrief.sponsorId}`}>Memo variant</Link>
          </Button>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/outreach/${data.candidate.id}?sponsor=${selectedBrief.sponsorId}` as Route}>Outreach plan</Link>
          </Button>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/packets/${data.candidate.id}?sponsor=${selectedBrief.sponsorId}`}>Internal packet</Link>
          </Button>
          <Button asChild className="print-hidden">
            <Link href={`/candidates/${data.candidate.id}`}>Back to candidate</Link>
          </Button>
        </>
      }
    >
      <Card className="print-hidden px-5 py-5">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Brief target sponsor</p>
          <p className="mt-1 text-sm text-ink-500">
            Switch between the strongest sponsor targets without rerunning generation.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {data.opportunityBriefs.map((brief) => (
            <Button
              asChild
              key={brief.id}
              variant={brief.sponsorId === selectedBrief.sponsorId ? "primary" : "secondary"}
            >
              <Link href={`/briefs/${data.candidate.id}?sponsor=${brief.sponsorId}` as Route}>{brief.sponsor.fullName}</Link>
            </Button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <BriefStatusBadge status={selectedBrief.status} />
          <Badge variant="muted">{selectedBrief.opportunityType.replaceAll("_", " ")}</Badge>
          <Badge variant="muted">{selectedBrief.sponsor.organization}</Badge>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <OpportunityBriefDocument
          candidateName={data.candidate.fullName}
          proofToBring={selectedBrief.proofToBringList}
          sponsorAsk={selectedBrief.sponsorAsk}
          sponsorName={selectedBrief.sponsor.fullName}
          sponsorOrganization={selectedBrief.sponsor.organization}
          status={selectedBrief.status}
          successIndicators={selectedBrief.successIndicatorsList}
          summary={selectedBrief.summary}
          talkingPoints={selectedBrief.talkingPointsList}
          title={selectedBrief.title}
          whyNow={selectedBrief.whyNow}
        />

        <div className="space-y-5 print-hidden">
          {selectedMatch ? (
            <ScoreBreakdownCard
              breakdown={selectedMatch.result.breakdown}
              score={selectedMatch.result.score}
              title="Sponsor match breakdown"
            />
          ) : null}

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Warm path and diligence context</p>
              <p className="mt-1 text-sm text-ink-500">Keep the ask tied to a real intro route and explicit proof gaps.</p>
            </div>
            <div className="mt-5 space-y-4">
              {selectedMatch?.connectionPath.map((step) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={step}>
                  <p className="text-sm leading-7 text-ink-600">{step}</p>
                </div>
              )) ?? <p className="text-sm text-ink-500">No warm path recorded.</p>}
            </div>
            {selectedMatch ? (
              <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">Path confidence</p>
                  <Badge variant="muted">{selectedMatch.warmPathInsight.confidence}/100</Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{selectedMatch.warmPathInsight.summary}</p>
                <div className="mt-4 space-y-2">
                  {selectedMatch.warmPathInsight.provenance.map((item) => (
                    <p className="text-sm leading-6 text-ink-500" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Current proof gap note</p>
              <p className="mt-3 text-sm leading-7 text-ink-600">
                {selectedWarmPath?.actionSuggestion ?? "No additional proof-gap note has been recorded for this sponsor path."}
              </p>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
