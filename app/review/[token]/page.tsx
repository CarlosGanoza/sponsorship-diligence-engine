import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ReviewShareLinkStatus } from "@prisma/client";

import { MemoDocument } from "@/components/memo/memo-document";
import { PrintButton } from "@/components/memo/print-button";
import { SponsorPacketDocument } from "@/components/memo/sponsor-packet-document";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/db/env";
import { parseReviewSharePayload } from "@/lib/review/share";
import { consumeRateLimit, getRequestClientLabel } from "@/lib/runtime/rate-limit";
import { formatDate } from "@/lib/utils/format";

export default async function ReviewSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const requestHeaders = await headers();
  const rateLimit = consumeRateLimit({
    bucket: `review-share:${token.slice(0, 12)}`,
    identifier: getRequestClientLabel(requestHeaders),
    limit: env.publicReviewRateLimitMaxRequests,
    windowMs: env.publicReviewRateLimitWindowMs,
  });

  if (!rateLimit.allowed) {
    return (
      <div className="min-h-screen bg-ink-50 px-4 py-6 md:px-6">
        <div className="mx-auto max-w-[760px]">
          <Card className="px-6 py-6">
            <p className="text-sm uppercase tracking-[0.24em] text-gold-700">Shared internal review</p>
            <h1 className="mt-3 font-serif text-3xl text-ink-900">Too many access attempts right now.</h1>
            <p className="mt-4 text-sm leading-7 text-ink-600">
              This read-only review link is temporarily throttled to keep internal materials from being brute-forced or scraped. Try again in about{" "}
              {rateLimit.retryAfterSeconds} second{rateLimit.retryAfterSeconds === 1 ? "" : "s"}.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const shareLink = await prisma.reviewShareLink.findFirst({
    where: {
      token,
      status: ReviewShareLinkStatus.ACTIVE,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!shareLink) {
    notFound();
  }

  const payload = parseReviewSharePayload(shareLink.payloadJson);

  await prisma.reviewShareLink.update({
    where: { id: shareLink.id },
    data: {
      lastUsedAt: new Date(),
    },
  }).catch(() => null);

  return (
    <div className="min-h-screen bg-ink-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <Card className="print-hidden px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Shared internal review</p>
              <h1 className="mt-3 font-serif text-4xl text-ink-900">{shareLink.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-500">
                This is a read-only internal review snapshot. It does not expose the wider operator workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="muted">Expires {formatDate(shareLink.expiresAt)}</Badge>
              <div>
                <PrintButton />
              </div>
            </div>
          </div>
        </Card>

        {payload.kind === "memo" ? (
          <>
            {payload.sponsorLabel ? (
              <Card className="print-hidden px-5 py-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="sage">{payload.sponsorLabel}</Badge>
                  {payload.sponsorMeta ? <Badge variant="muted">{payload.sponsorMeta}</Badge> : null}
                </div>
              </Card>
            ) : null}
            <MemoDocument
              candidateName={payload.candidateName}
              rationale={payload.rationale}
              recommendedAction={payload.recommendedAction}
              risks={payload.risks}
              status={payload.status}
              strengths={payload.strengths}
              summary={payload.summary}
            />
          </>
        ) : (
          <SponsorPacketDocument
            candidateHeadline={payload.candidateHeadline}
            candidateName={payload.candidateName}
            candidateRegion={payload.candidateRegion}
            evidence={payload.evidence}
            fitBreakdown={payload.fitBreakdown}
            flaggedItems={payload.flaggedItems}
            matchScore={payload.matchScore}
            memoSummary={payload.memoSummary}
            readinessScore={payload.readinessScore}
            recommendedAction={payload.recommendedAction}
            recommendedAsk={payload.recommendedAsk}
            risks={payload.risks}
            sponsorAngle={payload.sponsorAngle}
            sponsorName={payload.sponsorName}
            sponsorOrganization={payload.sponsorOrganization}
            sponsorTitle={payload.sponsorTitle}
            strengths={payload.strengths}
            warmPath={payload.warmPath}
            warmPathNote={payload.warmPathNote}
          />
        )}
      </div>
    </div>
  );
}
