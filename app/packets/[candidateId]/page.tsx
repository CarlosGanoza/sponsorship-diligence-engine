import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ReviewShareLinkStatus, ReviewShareLinkType } from "@prisma/client";

import { AppShell } from "@/components/dashboard/app-shell";
import { PrintButton } from "@/components/memo/print-button";
import { ReviewShareLinkControls } from "@/components/memo/review-share-link-controls";
import { SponsorPacketDocument } from "@/components/memo/sponsor-packet-document";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCandidateDetail, searchValueToString } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";
import { buildSponsorMemoVariant } from "@/lib/memo/variant";

export default async function SponsorPacketPage({
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

  const selectedMatch =
    data.sponsorMatches.find((match) => match.sponsor.id === selectedSponsorId) ?? data.sponsorMatches[0] ?? null;

  if (!data.memo || !selectedMatch) {
    return (
      <AppShell
        title={`Internal packet · ${data.candidate.fullName}`}
        description="Sponsor packet generation depends on both a memo and at least one sponsor match."
        actions={
          <Button asChild>
            <Link href={`/candidates/${data.candidate.id}`}>Back to candidate</Link>
          </Button>
        }
      >
        <Card className="px-6 py-8">
          <p className="font-medium text-ink-900">This packet is not ready yet</p>
          <p className="mt-3 text-sm leading-7 text-ink-500">
            Generate a sponsor memo and recommendation set first, then return to build a sponsor-specific review packet.
          </p>
        </Card>
      </AppShell>
    );
  }

  const sponsorRecommendation =
    data.recommendations.bestSponsors.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null;
  const warmPathRecommendation =
    data.recommendations.warmPaths.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null;
  const nextAction = data.recommendations.actions[0] ?? null;
  const variant = buildSponsorMemoVariant({
    candidate: data.candidate,
    sponsor: selectedMatch.sponsor,
    memo: data.memo,
    claims: data.claimsByArtifact.flatMap(({ artifact, claims }) =>
      claims.map((claim) => ({
        ...claim,
        artifactTitle: artifact.title,
      })),
    ),
    bestSponsorRecommendation: sponsorRecommendation,
    warmPathRecommendation,
    nextActionRecommendation: nextAction,
    matchScore: selectedMatch.result.score,
    matchBreakdown: selectedMatch.result.breakdown,
    connectionPath: selectedMatch.connectionPath,
  });
  const activeShareLink = await prisma.reviewShareLink.findFirst({
    where: {
      candidateId,
      sponsorId: selectedMatch.sponsor.id,
      linkType: ReviewShareLinkType.PACKET,
      status: ReviewShareLinkStatus.ACTIVE,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell
      title={`Internal packet · ${data.candidate.fullName}`}
      description="Printable internal brief for a selected sponsor path, combining memo language, evidence, review notes, and the warm intro route."
      actions={
        <>
          <div className="print-hidden">
            <PrintButton />
          </div>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/api/exports/${data.candidate.id}?type=packet&format=md&sponsor=${selectedMatch.sponsor.id}` as Route}>
              Export Markdown
            </Link>
          </Button>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/memos/${data.candidate.id}`}>View memo</Link>
          </Button>
          <Button asChild className="print-hidden">
            <Link href={`/candidates/${data.candidate.id}`}>Back to candidate</Link>
          </Button>
        </>
      }
    >
      <Card className="print-hidden px-5 py-5">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Packet target sponsor</p>
          <p className="mt-1 text-sm text-ink-500">
            Switch the packet between the strongest sponsor targets without regenerating the memo.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {data.sponsorMatches.slice(0, 4).map((match) => (
            <Button
              asChild
              key={match.sponsor.id}
              variant={match.sponsor.id === selectedMatch.sponsor.id ? "primary" : "secondary"}
            >
              <Link href={`/packets/${data.candidate.id}?sponsor=${match.sponsor.id}`}>
                {match.sponsor.fullName}
              </Link>
            </Button>
          ))}
        </div>
        <div className="mt-5">
          <ReviewShareLinkControls
            candidateId={data.candidate.id}
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
            linkType="PACKET"
            sponsorId={selectedMatch.sponsor.id}
          />
        </div>
      </Card>

      <SponsorPacketDocument
        candidateHeadline={data.candidate.headline}
        candidateName={data.candidate.fullName}
        candidateRegion={data.candidate.region}
        evidence={variant.selectedClaims}
        fitBreakdown={selectedMatch.result.breakdown}
        flaggedItems={data.flaggedReviewItems.slice(0, 6)}
        matchScore={selectedMatch.result.score}
        memoSummary={variant.summary}
        readinessScore={data.readiness.score}
        recommendedAction={variant.recommendedAction}
        recommendedAsk={sponsorRecommendation?.actionSuggestion ?? nextAction?.actionSuggestion ?? data.memo.recommendedAction}
        risks={variant.risks}
        sponsorAngle={variant.rationale}
        sponsorName={selectedMatch.sponsor.fullName}
        sponsorOrganization={selectedMatch.sponsor.organization}
        sponsorTitle={selectedMatch.sponsor.title}
        strengths={variant.strengths}
        warmPath={selectedMatch.connectionPath}
        warmPathNote={
          warmPathRecommendation?.actionSuggestion ?? "No additional proof gap has been recorded for this sponsor path."
        }
      />
    </AppShell>
  );
}
