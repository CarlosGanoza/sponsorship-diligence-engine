import Link from "next/link";
import type { Route } from "next";
import { MembershipRole, PilotReviewShareLinkType, ReviewShareLinkStatus } from "@prisma/client";

import { ArrowRight, BriefcaseBusiness } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { CommercialProofDocument } from "@/components/pilot/commercial-proof-document";
import { PilotReviewShareLinkControls } from "@/components/pilot/pilot-review-share-link-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasRequiredMembershipRole, requirePageSession } from "@/lib/auth/session";
import { getCommercialProofData } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";

export default async function CommercialPage() {
  const session = await requirePageSession();
  const canShareCommercial = hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.ADMIN);
  const [data, activeShareLink] = await Promise.all([
    getCommercialProofData(),
    canShareCommercial
      ? prisma.pilotReviewShareLink.findFirst({
          where: {
            organizationId: session.organizationId,
            linkType: PilotReviewShareLinkType.COMMERCIAL,
            status: ReviewShareLinkStatus.ACTIVE,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve(null),
  ]);

  return (
    <AppShell
      title="Commercial proof"
      description="Turn the current workspace into a sober buyer narrative: what the product can already prove, what objections it can answer, and what still has to be earned in a live design-partner pilot."
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href={"/pilot" as Route}>Pilot readiness</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/onboarding" as Route}>Pilot launch</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/calibration" as Route}>Calibration</Link>
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
          <Button asChild>
            <Link href={"/roi" as Route}>
              Executive ROI
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Card className="print-hidden px-5 py-5">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Share-safe buyer review</p>
              <p className="mt-1 text-sm text-ink-500">
                Create a time-bounded read-only link for the commercial proof brief without exposing the wider workspace.
              </p>
            </div>
          </div>
          <div className="mt-5">
            {canShareCommercial ? (
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
                linkType="COMMERCIAL"
              />
            ) : (
              <p className="text-sm leading-7 text-ink-500">
                Admin workspace access is required to create or rotate commercial review links.
              </p>
            )}
          </div>
        </Card>

        <CommercialProofDocument
          healthStatus={data.health.status}
          pilotProfile={data.settings.pilotProfile}
          readiness={data.readiness}
          template={data.template}
        />
      </div>
    </AppShell>
  );
}
