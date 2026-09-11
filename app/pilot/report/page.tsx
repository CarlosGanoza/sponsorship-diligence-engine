import Link from "next/link";
import type { Route } from "next";
import { MembershipRole, PilotReviewShareLinkType, ReviewShareLinkStatus } from "@prisma/client";

import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { PrintButton } from "@/components/memo/print-button";
import { PilotProofReportDocument } from "@/components/pilot/pilot-proof-report-document";
import { PilotReviewShareLinkControls } from "@/components/pilot/pilot-review-share-link-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasRequiredMembershipRole, requirePageSession } from "@/lib/auth/session";
import { getPilotProofReportData } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";

export default async function PilotReportPage() {
  const session = await requirePageSession();
  const data = await getPilotProofReportData();
  const canShareReport = hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.ADMIN);
  const activeShareLink = canShareReport
    ? await prisma.pilotReviewShareLink.findFirst({
        where: {
          organizationId: session.organizationId,
          linkType: PilotReviewShareLinkType.REPORT,
          status: ReviewShareLinkStatus.ACTIVE,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return (
    <AppShell
      title="Pilot proof report"
      description="Single measured design-partner artifact that separates observed workflow proof from modeled economics and shows what still has to be earned."
      actions={
        <>
          <div className="print-hidden">
            <PrintButton />
          </div>
          <Button asChild variant="secondary">
            <Link href={"/pilot" as Route}>Pilot readiness</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/pilot/pack" as Route}>Pilot brief</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={"/commercial" as Route}>Commercial proof</Link>
          </Button>
          <Button asChild variant="secondary">
            <a href="/api/pilot/report" rel="noreferrer" target="_blank">
              JSON export
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/api/pilot/report?format=md" rel="noreferrer" target="_blank">
              Markdown export
            </a>
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
              Create a time-bounded read-only link for the measured proof report without exposing the wider workspace.
            </p>
          </div>
          <div className="mt-5">
            {canShareReport ? (
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
                linkType="REPORT"
              />
            ) : (
              <p className="text-sm leading-7 text-ink-500">
                Admin workspace access is required to create or rotate proof-report share links.
              </p>
            )}
          </div>
        </Card>

        <PilotProofReportDocument
          report={data.report}
          template={data.template}
          pilotProfile={data.pilotProfile}
          healthStatus={data.health.status}
        />
      </div>
    </AppShell>
  );
}
