import Link from "next/link";
import type { Route } from "next";
import { MembershipRole, PilotReviewShareLinkType, ReviewShareLinkStatus } from "@prisma/client";

import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { ExecutiveRoiDocument } from "@/components/pilot/executive-roi-document";
import { PilotMetricsControls } from "@/components/pilot/pilot-metrics-controls";
import { PilotReviewShareLinkControls } from "@/components/pilot/pilot-review-share-link-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasRequiredMembershipRole, requirePageSession } from "@/lib/auth/session";
import { getExecutiveRoiData } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";

export default async function RoiPage() {
  const session = await requirePageSession();
  const canShareRoi = hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.ADMIN);
  const [data, activeShareLink] = await Promise.all([
    getExecutiveRoiData(),
    canShareRoi
      ? prisma.pilotReviewShareLink.findFirst({
          where: {
            organizationId: session.organizationId,
            linkType: PilotReviewShareLinkType.ROI,
            status: ReviewShareLinkStatus.ACTIVE,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
  ]);
  const { settings, pilotData, health, template, roiModel } = data;

  return (
    <AppShell
      title="Executive ROI"
      description="Translate the current workspace into an explicit pilot economics and governance story, while separating observed proof from modeled assumptions."
      actions={
        <>
          <div className="print-hidden">
            <PilotMetricsControls hasBaseline={Boolean(pilotData.baseline)} />
          </div>
          <Button asChild variant="secondary">
            <Link href={"/onboarding" as Route}>Pilot launch</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/commercial" as Route}>Commercial proof</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/pilot/report" as Route}>Proof report</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/pilot/pack" as Route}>Pilot brief</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/demo" as Route}>Guided demo</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/pilot" as Route}>Pilot readiness</Link>
          </Button>
          <Button asChild>
            <Link href={"/analytics" as Route}>
              Open analytics
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/api/health" as Route}>Health JSON</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Card className="print-hidden px-5 py-5">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Share-safe buyer review</p>
            <p className="mt-1 text-sm text-ink-500">
              Create a time-bounded read-only link for the executive ROI brief without exposing the wider workspace.
            </p>
          </div>
          <div className="mt-5">
            {canShareRoi ? (
              <PilotReviewShareLinkControls
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
                linkType="ROI"
              />
            ) : (
              <p className="text-sm leading-7 text-ink-500">
                Admin workspace access is required to create or rotate executive ROI review links.
              </p>
            )}
          </div>
        </Card>

        <ExecutiveRoiDocument
          assumptions={roiModel.assumptions}
          baseline={
            pilotData.baseline
              ? {
                  capturedAtLabel: pilotData.baseline.capturedAtLabel,
                  authorLabel: pilotData.baseline.authorLabel,
                  note: pilotData.baseline.note,
                  averageReviewMinutes: pilotData.baseline.averageReviewMinutes,
                  sampledReviewCount: pilotData.baseline.sampledReviewCount,
                }
              : null
          }
          health={{
            checkedAtLabel: data.healthCheckedAtLabel,
            checks: health.checks,
          }}
          healthStatus={health.status}
          launchPosture={{
            blindReviewMode: settings.blindReviewMode,
            strictEvidenceMode: settings.strictEvidenceMode,
            requireOutboundApproval: settings.requireOutboundApproval,
          }}
          modeled={roiModel.modeled}
          observedDeltas={pilotData.observedDeltas}
          pilotProfile={settings.pilotProfile}
          recentSnapshots={pilotData.recentSnapshots}
          template={template}
        />
      </div>
    </AppShell>
  );
}
