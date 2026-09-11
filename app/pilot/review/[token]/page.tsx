import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ReviewShareLinkStatus } from "@prisma/client";

import { PrintButton } from "@/components/memo/print-button";
import { CommercialProofDocument } from "@/components/pilot/commercial-proof-document";
import { ExecutiveRoiDocument } from "@/components/pilot/executive-roi-document";
import { PilotBuyerPackDocument } from "@/components/pilot/pilot-buyer-pack-document";
import { PilotLaunchDocument } from "@/components/pilot/pilot-launch-document";
import { PilotProofReportDocument } from "@/components/pilot/pilot-proof-report-document";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/db/env";
import { parsePilotReviewSharePayload } from "@/lib/pilot/share";
import { consumeRateLimit, getRequestClientLabel } from "@/lib/runtime/rate-limit";
import { formatDate } from "@/lib/utils/format";

export default async function PilotReviewSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const requestHeaders = await headers();
  const rateLimit = consumeRateLimit({
    bucket: `pilot-review-share:${token.slice(0, 12)}`,
    identifier: getRequestClientLabel(requestHeaders),
    limit: env.publicReviewRateLimitMaxRequests,
    windowMs: env.publicReviewRateLimitWindowMs,
  });

  if (!rateLimit.allowed) {
    return (
      <div className="min-h-screen bg-ink-50 px-4 py-6 md:px-6">
        <div className="mx-auto max-w-[760px]">
          <Card className="px-6 py-6">
            <p className="text-sm uppercase tracking-[0.24em] text-gold-700">Shared pilot review</p>
            <h1 className="mt-3 font-serif text-3xl text-ink-900">Too many access attempts right now.</h1>
            <p className="mt-4 text-sm leading-7 text-ink-600">
              This read-only pilot review link is temporarily throttled to keep internal materials from being
              brute-forced or scraped. Try again in about {rateLimit.retryAfterSeconds} second
              {rateLimit.retryAfterSeconds === 1 ? "" : "s"}.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const shareLink = await prisma.pilotReviewShareLink.findFirst({
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

  const payload = parsePilotReviewSharePayload(shareLink.payloadJson);

  await prisma.pilotReviewShareLink
    .update({
      where: { id: shareLink.id },
      data: {
        lastUsedAt: new Date(),
      },
    })
    .catch(() => null);

  return (
    <div className="min-h-screen bg-ink-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1180px] space-y-6">
        <Card className="print-hidden px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Shared pilot review</p>
              <h1 className="mt-3 font-serif text-4xl text-ink-900">{shareLink.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-500">
                This is a read-only internal pilot snapshot. It does not expose the rest of the operator workspace.
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

        <Card className="print-hidden px-5 py-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="sage">{payload.templateLabel}</Badge>
            <Badge variant="muted">{payload.pilotProfile.designPartnerName}</Badge>
            <Badge variant="muted">{payload.pilotProfile.programName}</Badge>
          </div>
        </Card>

        {payload.kind === "pilot_report" ? (
          <PilotProofReportDocument
            healthStatus={payload.healthStatus === "unhealthy" ? "down" : payload.healthStatus}
            pilotProfile={payload.pilotProfile}
            report={payload.report}
            template={{ label: payload.templateLabel }}
          />
        ) : payload.kind === "pilot_pack" ? (
          <PilotBuyerPackDocument
            buyerPack={payload.buyerPack}
            healthStatus={payload.healthStatus === "unhealthy" ? "down" : payload.healthStatus}
            pilotProfile={payload.pilotProfile}
            template={{ label: payload.templateLabel }}
          />
        ) : payload.kind === "pilot_commercial" ? (
          <CommercialProofDocument
            healthStatus={payload.healthStatus === "unhealthy" ? "down" : payload.healthStatus}
            pilotProfile={payload.pilotProfile}
            readiness={payload.readiness}
            template={{
              label: payload.templateLabel,
              audience: payload.bestBuyerMotion.audience,
              whyItFits: payload.bestBuyerMotion.whyItFits,
              firstPilotGoal: payload.bestBuyerMotion.firstPilotGoal,
              buyerObjections: payload.buyerObjections,
              commercialMilestones: payload.milestones,
            }}
          />
        ) : payload.kind === "pilot_onboarding" ? (
          <PilotLaunchDocument
            currentSlate={payload.currentSlate}
            healthStatus={payload.healthStatus === "unhealthy" ? "down" : payload.healthStatus}
            launchPosture={payload.launchPosture}
            launchWorkstream={payload.launchWorkstream}
            pilotProfile={payload.pilotProfile}
            template={{
              label: payload.templateLabel,
              audience: payload.bestBuyerMotion.audience,
              firstPilotGoal: payload.bestBuyerMotion.firstPilotGoal,
              designPartnerCommitments: payload.designPartnerCommitments,
              onboardingChecklist: payload.onboardingChecklist,
              stakeholderMap: payload.stakeholderMap,
              calibrationPlaybook: payload.calibrationPlaybook,
              buyerDeliverables: payload.buyerDeliverables,
            }}
          />
        ) : (
          <ExecutiveRoiDocument
            assumptions={payload.assumptions}
            baseline={payload.baseline}
            health={payload.health}
            healthStatus={payload.healthStatus === "unhealthy" ? "down" : payload.healthStatus}
            pilotProfile={payload.pilotProfile}
            launchPosture={payload.launchPosture}
            modeled={payload.modeled}
            observedDeltas={payload.observedDeltas}
            recentSnapshots={payload.recentSnapshots}
            template={{
              label: payload.templateLabel,
              summary: payload.templateSummary,
            }}
          />
        )}
      </div>
    </div>
  );
}
