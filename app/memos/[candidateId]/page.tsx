import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ReviewShareLinkStatus, ReviewShareLinkType } from "@prisma/client";

import { AppShell } from "@/components/dashboard/app-shell";
import { MemoDocument } from "@/components/memo/memo-document";
import { PrintButton } from "@/components/memo/print-button";
import { ReviewShareLinkControls } from "@/components/memo/review-share-link-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCandidateDetail, searchValueToString } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";
import { buildSponsorMemoVariant } from "@/lib/memo/variant";

export default async function MemoPage({
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
    data.sponsorMatches.find((match) => match.sponsor.id === selectedSponsorId) ?? null;
  const sponsorRecommendation = selectedMatch
    ? data.recommendations.bestSponsors.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null
    : null;
  const warmPathRecommendation = selectedMatch
    ? data.recommendations.warmPaths.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null
    : null;
  const memoVariant =
    data.memo && selectedMatch
      ? buildSponsorMemoVariant({
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
          nextActionRecommendation: data.recommendations.actions[0] ?? null,
          matchScore: selectedMatch.result.score,
          matchBreakdown: selectedMatch.result.breakdown,
          connectionPath: selectedMatch.connectionPath,
        })
      : null;
  const activeShareLink = await prisma.reviewShareLink.findFirst({
    where: {
      candidateId,
      sponsorId: selectedMatch?.sponsor.id ?? null,
      linkType: ReviewShareLinkType.MEMO,
      status: ReviewShareLinkStatus.ACTIVE,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell
      title={`Sponsor memo · ${data.candidate.fullName}`}
      description="Printable memo layout with evidence-backed rationale, plus sponsor-specific variants when you need a tailored advocacy case."
      actions={
        <>
          <div className="print-hidden">
            <PrintButton />
          </div>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/api/exports/${data.candidate.id}?type=memo&format=json${selectedMatch ? `&sponsor=${selectedMatch.sponsor.id}` : ""}` as Route}>
              Export JSON
            </Link>
          </Button>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/packets/${data.candidate.id}`}>Internal packet</Link>
          </Button>
          <Button asChild className="print-hidden">
            <Link href={`/candidates/${data.candidate.id}`}>Back to candidate</Link>
          </Button>
        </>
      }
    >
      {data.memo ? (
        <div className="space-y-5">
          <Card className="print-hidden px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Memo variant selector</p>
              <p className="mt-1 text-sm text-ink-500">
                Keep the base memo intact, or shift the language toward a specific sponsor archetype and target.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild variant={!selectedMatch ? "primary" : "secondary"}>
                <Link href={`/memos/${data.candidate.id}`}>Base memo</Link>
              </Button>
              {data.sponsorMatches.slice(0, 4).map((match) => (
                <Button
                  asChild
                  key={match.sponsor.id}
                  variant={selectedMatch?.sponsor.id === match.sponsor.id ? "primary" : "secondary"}
                >
                  <Link href={`/memos/${data.candidate.id}?sponsor=${match.sponsor.id}`}>
                    {match.sponsor.fullName}
                  </Link>
                </Button>
              ))}
            </div>
            {memoVariant && selectedMatch ? (
              <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="sage">{memoVariant.sponsorLabel}</Badge>
                  <Badge variant="muted">
                    {selectedMatch.sponsor.title} · {selectedMatch.sponsor.organization}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{memoVariant.sponsorAngle}</p>
              </div>
            ) : null}
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
                linkType="MEMO"
                sponsorId={selectedMatch?.sponsor.id ?? null}
              />
            </div>
          </Card>

          <MemoDocument
            candidateName={
              memoVariant && selectedMatch
                ? `${data.candidate.fullName} · for ${selectedMatch.sponsor.fullName}`
                : data.candidate.fullName
            }
            rationale={memoVariant?.rationale ?? data.memo.rationale}
            recommendedAction={memoVariant?.recommendedAction ?? data.memo.recommendedAction}
            risks={memoVariant?.risks ?? data.memo.risksList}
            status={data.memo.status}
            strengths={memoVariant?.strengths ?? data.memo.strengthsList}
            summary={memoVariant?.summary ?? data.memo.summary}
          />
        </div>
      ) : (
        <Card className="px-6 py-8">
          <p className="font-medium text-ink-900">No memo has been generated yet</p>
          <p className="mt-3 text-sm leading-7 text-ink-500">
            Open the candidate record and run memo generation first.
          </p>
        </Card>
      )}
    </AppShell>
  );
}
