import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { ActivityStatusBadge } from "@/components/dashboard/activity-status-badge";
import { AppShell } from "@/components/dashboard/app-shell";
import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { CrmSyncBadge } from "@/components/dashboard/crm-sync-badge";
import { ReviewBadge } from "@/components/dashboard/review-badge";
import { SponsorAvailabilityControls } from "@/components/sponsor/sponsor-availability-controls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { getSponsorDetail } from "@/lib/db/queries";

export default async function SponsorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sponsor = await getSponsorDetail(id);

  if (!sponsor) {
    notFound();
  }

  return (
    <AppShell
      title={sponsor.fullName}
      description={`${sponsor.title} · ${sponsor.organization}`}
    >
      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card className="px-6 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={sponsor.warmIntroAvailable ? "sage" : "gold"}>
              {sponsor.warmIntroAvailable ? "Warm intro available" : "Warm intro limited"}
            </Badge>
            <Badge
              variant={
                sponsor.availabilityStatus === "OPEN"
                  ? "sage"
                  : sponsor.availabilityStatus === "LIMITED"
                    ? "gold"
                    : "danger"
              }
            >
              {sponsor.availabilityStatus.replaceAll("_", " ")}
            </Badge>
            <Badge variant="muted">{sponsor.seniorityLevel}</Badge>
            <Badge variant="muted">{sponsor.geography}</Badge>
            {sponsor.operatingProfile.blackoutActive ? <Badge variant="danger">Timing blackout</Badge> : null}
          </div>
          <p className="mt-5 text-sm leading-7 text-ink-600">{sponsor.bio}</p>
          {sponsor.availabilityNote ? (
            <p className="mt-4 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4 text-sm leading-7 text-ink-600">
              {sponsor.availabilityNote}
            </p>
          ) : null}
          {sponsor.operatingProfile.blackoutActive ? (
            <p className="mt-4 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-700">
              {sponsor.operatingProfile.blackoutReason
                ? `${sponsor.operatingProfile.blackoutReason}${sponsor.operatingProfile.blackoutUntil ? ` · through ${sponsor.blackoutUntilLabel}` : ""}`
                : `Timing blackout${sponsor.blackoutUntilLabel ? ` through ${sponsor.blackoutUntilLabel}` : ""}`}
            </p>
          ) : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Domain expertise</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sponsor.expertiseList.map((item) => (
                  <Badge key={item} variant="muted">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Interest tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sponsor.interestList.map((item) => (
                  <Badge key={item} variant="sage">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Sponsor style</p>
          <p className="mt-4 font-serif text-3xl text-ink-900">{sponsor.sponsorStyle.replaceAll("_", " ")}</p>
          <p className="mt-4 text-sm leading-7 text-ink-500">
            This field influences recommendation logic directly and remains visible so users can judge whether the style actually fits the candidate.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Operating capacity</p>
              <p className="mt-3 font-serif text-3xl text-ink-900">{sponsor.operatingProfile.capacityScore}/8</p>
              <p className="mt-2 text-sm text-ink-500">
                {sponsor.operatingProfile.activePipelineCount} active sponsor paths against a limit of{" "}
                {sponsor.operatingProfile.maxConcurrentPaths}.
              </p>
            </div>
            <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Responsiveness</p>
              <p className="mt-3 font-serif text-3xl text-ink-900">{sponsor.operatingProfile.responsivenessScore}/8</p>
              <p className="mt-2 text-sm text-ink-500">
                {sponsor.operatingProfile.completedExternalActions} completed external actions · {sponsor.operatingProfile.positiveOutcomes} positive outcomes.
              </p>
            </div>
          </div>
          <SponsorAvailabilityControls
            initialAvailabilityNote={sponsor.availabilityNote}
            initialAvailabilityStatus={sponsor.availabilityStatus}
            initialBlackoutReason={sponsor.blackoutReason}
            initialBlackoutUntil={sponsor.blackoutUntil ? sponsor.blackoutUntil.toISOString().slice(0, 10) : null}
            initialMaxConcurrentPaths={sponsor.maxConcurrentPaths}
            initialWarmIntroAvailable={sponsor.warmIntroAvailable}
            sponsorId={sponsor.id}
          />
        </Card>
      </section>

      <Card className="px-5 py-5">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Sponsor portfolio</p>
          <p className="mt-1 text-sm text-ink-500">
            Active and historical asks for this sponsor, including duplicate-motion risk and negative path memory.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <TableHead>Candidate</TableHead>
                <TableHead>Current path</TableHead>
                <TableHead>Asks in motion</TableHead>
                <TableHead>Latest approval</TableHead>
                <TableHead>Negative memory</TableHead>
                <TableHead>Timing</TableHead>
                <TableHead>Last touched</TableHead>
              </tr>
            </thead>
            <tbody>
              {sponsor.portfolioRows.map((row) => (
                <TableRow key={row.candidateId}>
                  <TableCell>
                    <p className="font-medium text-ink-900">{row.candidate.fullName}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-500">{row.candidate.headline}</p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Badge variant={row.currentStage && row.currentStage !== "PASSED" && row.currentStage !== "CLOSED" ? "sage" : "muted"}>
                        {row.currentStageLabel}
                      </Badge>
                      {row.latestOutcome ? (
                        <Badge
                          variant={
                            row.latestOutcome.verdict === "POSITIVE"
                              ? "sage"
                              : row.latestOutcome.verdict === "NEGATIVE"
                                ? "danger"
                                : "gold"
                          }
                        >
                          {row.latestOutcome.outcomeType.replaceAll("_", " ")}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Badge variant="muted">{row.briefCount} briefs</Badge>
                      <Badge variant="muted">{row.outboundEmailCount} outbound sends</Badge>
                      {row.duplicateAskRisk ? (
                        <p className="max-w-xs text-xs leading-5 text-rose-700">{row.duplicateAskReason}</p>
                      ) : (
                        <p className="text-xs leading-5 text-ink-500">No overlapping ask signal is currently flagged.</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.latestApproval ? (
                      <div className="space-y-2">
                        <Badge
                          variant={
                            row.latestApproval.status === "APPROVED"
                              ? "sage"
                              : row.latestApproval.status === "REJECTED"
                                ? "danger"
                                : "gold"
                          }
                        >
                          {row.latestApproval.approvalType.replaceAll("_", " ")} · {row.latestApproval.status}
                        </Badge>
                        {row.latestApproval.reviewedBy?.name ? (
                          <p className="text-xs leading-5 text-ink-500">Reviewed by {row.latestApproval.reviewedBy.name}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-500">No approval record yet.</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.negativeMemory.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.negativeMemory.map((memory) => (
                          <Badge key={memory} variant="gold">
                            {memory}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-ink-500">No negative path memory recorded.</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.blackoutActive ? (
                      <div className="space-y-2">
                        <Badge variant="danger">Blackout</Badge>
                        <p className="max-w-xs text-xs leading-5 text-ink-500">
                          {row.blackoutReason ?? row.blackoutUntilLabel ?? "Temporary timing constraint recorded."}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-500">Open timing window.</p>
                    )}
                  </TableCell>
                  <TableCell>{row.lastTouchedAtLabel}</TableCell>
                </TableRow>
              ))}
              {sponsor.portfolioRows.length === 0 ? (
                <TableRow>
                  <TableCell className="text-sm text-ink-500" colSpan={7}>
                    No sponsor portfolio history has been recorded yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="px-5 py-5">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Active opportunity briefs</p>
          <p className="mt-1 text-sm text-ink-500">Sponsor-targeted asks already packaged for this directory record.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <TableHead>Candidate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead />
              </tr>
            </thead>
            <tbody>
              {sponsor.opportunityBriefs.map((brief) => (
                <TableRow key={brief.id}>
                  <TableCell>
                    <p className="font-medium text-ink-900">{brief.candidate.fullName}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-500">{brief.candidate.headline}</p>
                  </TableCell>
                  <TableCell>{brief.opportunityType.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <BriefStatusBadge status={brief.status} />
                  </TableCell>
                  <TableCell>{brief.updatedAtLabel}</TableCell>
                  <TableCell>
                    <p className="max-w-xl text-sm leading-7 text-ink-600">{brief.summary}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      <Link
                        className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700"
                        href={`/briefs/${brief.candidateId}?sponsor=${sponsor.id}` as Route}
                      >
                        Open brief
                      </Link>
                      <Link
                        className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700"
                        href={`/outreach/${brief.candidateId}?sponsor=${sponsor.id}` as Route}
                      >
                        Outreach plan
                      </Link>
                      <Link
                        className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700"
                        href={`/packets/${brief.candidateId}?sponsor=${sponsor.id}`}
                      >
                        Open packet
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sponsor.opportunityBriefs.length === 0 ? (
                <TableRow>
                  <TableCell className="text-sm text-ink-500" colSpan={6}>
                    No opportunity briefs have been generated for this sponsor yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="px-5 py-5">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Sponsor activity timeline</p>
            <p className="mt-1 text-sm text-ink-500">Operational events already tracked for this sponsor across candidates.</p>
          </div>
          <div className="mt-5 space-y-4">
            {sponsor.sponsorActivities.map((activity) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={activity.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted">{activity.activityType.replaceAll("_", " ")}</Badge>
                      <ActivityStatusBadge status={activity.status} />
                    </div>
                    <p className="mt-3 text-sm font-medium text-ink-900">{activity.title}</p>
                    <p className="mt-1 text-sm text-ink-500">{activity.candidate.fullName}</p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.18em] text-ink-400">{activity.updatedAtLabel}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{activity.detail}</p>
              </div>
            ))}
            {sponsor.sponsorActivities.length === 0 ? (
              <p className="text-sm text-ink-500">No sponsor activity has been logged for this sponsor yet.</p>
            ) : null}
          </div>
        </Card>

        <Card className="px-5 py-5">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">CRM sync history</p>
            <p className="mt-1 text-sm text-ink-500">Recorded handoffs into the CRM layer for this sponsor.</p>
          </div>
          <div className="mt-5 space-y-4">
            {sponsor.crmSyncRecords.map((sync) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={sync.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CrmSyncBadge status={sync.status} />
                    <Badge variant="muted">{sync.providerMode}</Badge>
                  </div>
                  <span className="text-xs uppercase tracking-[0.18em] text-ink-400">{sync.updatedAtLabel}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-ink-900">
                  {sync.externalRecordId ? `Record ${sync.externalRecordId}` : "Recorded handoff"}
                </p>
                <p className="mt-2 text-sm leading-7 text-ink-600">{sync.syncNote}</p>
              </div>
            ))}
            {sponsor.crmSyncRecords.length === 0 ? (
              <p className="text-sm text-ink-500">No CRM sync has been recorded for this sponsor yet.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <Card className="px-5 py-5">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Current recommended candidates</p>
          <p className="mt-1 text-sm text-ink-500">Derived from seeded or generated recommendation records.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <TableHead>Candidate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Explanation</TableHead>
                <TableHead />
              </tr>
            </thead>
            <tbody>
              {sponsor.recommendations.map((recommendation) => (
                <TableRow key={recommendation.id}>
                  <TableCell>
                    <p className="font-medium text-ink-900">{recommendation.candidate.fullName}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-500">{recommendation.candidate.headline}</p>
                  </TableCell>
                  <TableCell>{recommendation.recommendationType.replaceAll("_", " ")}</TableCell>
                  <TableCell>{Math.round(recommendation.score)}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <ReviewBadge status={recommendation.reviewStatus} />
                      {recommendation.reviewNote ? (
                        <p className="max-w-xs text-xs leading-5 text-ink-500">{recommendation.reviewNote}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{recommendation.createdAtLabel}</TableCell>
                  <TableCell>
                    <p className="max-w-xl text-sm leading-7 text-ink-600">{recommendation.explanation}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      <Link
                        className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700"
                        href={`/memos/${recommendation.candidateId}?sponsor=${sponsor.id}`}
                      >
                        Memo variant
                      </Link>
                      <Link
                        className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700"
                        href={`/packets/${recommendation.candidateId}?sponsor=${sponsor.id}`}
                      >
                        Open packet
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}
