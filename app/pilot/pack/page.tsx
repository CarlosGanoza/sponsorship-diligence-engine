import Link from "next/link";
import type { Route } from "next";
import { PilotReviewShareLinkType, ReviewShareLinkStatus } from "@prisma/client";

import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { PrintButton } from "@/components/memo/print-button";
import { PilotBuyerPackDocument } from "@/components/pilot/pilot-buyer-pack-document";
import { PilotReviewShareLinkControls } from "@/components/pilot/pilot-review-share-link-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requirePageSession } from "@/lib/auth/session";
import { getPilotPackData } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";

export default async function PilotPackPage() {
  const session = await requirePageSession();
  const data = await getPilotPackData();
  const activeShareLink = await prisma.pilotReviewShareLink.findFirst({
    where: {
      organizationId: session.organizationId,
      linkType: PilotReviewShareLinkType.PACK,
      status: ReviewShareLinkStatus.ACTIVE,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppShell
      title="Pilot brief"
      description="Buyer-facing pilot packet that combines measured proof, operating posture, and explicit next-step framing for the selected design partner."
      actions={
        <>
          <div className="print-hidden">
            <PrintButton />
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
            <a href="/api/pilot/pack" rel="noreferrer" target="_blank">
              JSON export
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/api/pilot/pack?format=md" rel="noreferrer" target="_blank">
              Markdown export
            </a>
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
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Share-safe pilot review</p>
            <p className="mt-1 text-sm text-ink-500">
              Create a time-bounded read-only link for the buyer pack without exposing the rest of the workspace.
            </p>
          </div>
          <div className="mt-5">
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
              linkType="PACK"
            />
          </div>
        </Card>

        <PilotBuyerPackDocument
          buyerPack={data.buyerPack}
          pilotProfile={data.pilotProfile}
          template={data.template}
          healthStatus={data.health.status}
        />
      </div>
    </AppShell>
  );
}
