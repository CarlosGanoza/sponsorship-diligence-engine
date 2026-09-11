import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { ActivityStatusBadge } from "@/components/dashboard/activity-status-badge";
import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { CrmSyncBadge } from "@/components/dashboard/crm-sync-badge";
import { AppShell } from "@/components/dashboard/app-shell";
import { ScoreBreakdownCard } from "@/components/dashboard/score-breakdown-card";
import { PrintButton } from "@/components/memo/print-button";
import { OutreachPlanDocument } from "@/components/outreach/outreach-plan-document";
import { EmailDraftWorkbench } from "@/components/outreach/email-draft-workbench";
import { EmailThreadControls } from "@/components/outreach/email-thread-controls";
import { OperationsControls } from "@/components/outreach/operations-controls";
import { OutboundApprovalControls } from "@/components/outreach/outbound-approval-controls";
import { ReleaseStatusCard } from "@/components/outreach/release-status-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { searchValueToString } from "@/lib/db/queries";
import { summarizeOutboundApprovalState } from "@/lib/outreach/approvals";
import { getOutreachContext } from "@/lib/outreach/context";
import { buildEmailDrafts } from "@/lib/outreach/email";
import { buildCrmHandoffRecord } from "@/lib/outreach/handoff";

export default async function OutreachPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ candidateId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { candidateId } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const selectedSponsorId = searchValueToString(resolvedSearch.sponsor);
  const context = await getOutreachContext(candidateId, selectedSponsorId);

  if (!context) {
    notFound();
  }

  const {
    data,
    selectedBrief,
    selectedMatch,
    outreachPlan,
    variant,
    warmPathRecommendation,
    crmSyncRecords,
    sponsorActivities,
    outboundEmails,
    outboundApprovals,
    outreachRelease,
    crmHandoffRelease,
  } = context;

  if (!selectedBrief || !selectedMatch || !outreachPlan || !variant) {
    return (
      <AppShell
        title={`Outreach plan · ${data.candidate.fullName}`}
        description="Outreach plans depend on a generated memo, recommendations, and at least one opportunity brief."
        actions={
          <Button asChild>
            <Link href={`/candidates/${data.candidate.id}`}>Back to candidate</Link>
          </Button>
        }
      >
        <Card className="px-6 py-8">
          <p className="font-medium text-ink-900">This outreach plan is not ready yet</p>
          <p className="mt-3 text-sm leading-7 text-ink-500">
            Generate the memo, sponsor recommendations, and opportunity briefs first.
          </p>
        </Card>
      </AppShell>
    );
  }

  const emailDrafts = buildEmailDrafts({
    brief: selectedBrief,
    candidate: data.candidate,
    connectionPath: selectedMatch.connectionPath,
    outreachPlan,
    risks: variant.risks,
    sponsor: selectedMatch.sponsor,
    warmPathNote: warmPathRecommendation?.actionSuggestion,
  });
  const crmHandoff = buildCrmHandoffRecord({
    brief: selectedBrief,
    candidate: data.candidate,
    sponsor: selectedMatch.sponsor,
    connectionPath: selectedMatch.connectionPath,
    nextStep: outreachPlan.meetingGoal,
    outreachMode: outreachPlan.mode,
    risks: variant.risks,
    sponsorMatchScore: selectedMatch.result.score,
    sponsorReadinessScore: data.readiness.score,
    subjectLine: outreachPlan.subjectLine,
  });
  const outreachApprovalSummary = summarizeOutboundApprovalState({
    approvalType: "OUTREACH_RELEASE",
    approval: outboundApprovals.outreachRelease,
    blocked: outreachRelease.blocked,
    blockers: outreachRelease.blockers,
  });
  const crmApprovalSummary = summarizeOutboundApprovalState({
    approvalType: "CRM_HANDOFF",
    approval: outboundApprovals.crmHandoff,
    blocked: crmHandoffRelease.blocked,
    blockers: crmHandoffRelease.blockers,
  });

  return (
    <AppShell
      title={`Outreach plan · ${data.candidate.fullName}`}
      description="Operator-ready outreach packaging: plan, editable email drafts, and CRM handoff export for a chosen sponsor path."
      actions={
        <>
          <div className="print-hidden">
            <PrintButton />
          </div>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/api/exports/${data.candidate.id}?type=outreach&format=json&sponsor=${selectedBrief.sponsorId}` as Route}>
              Export JSON
            </Link>
          </Button>
          <Button asChild className="print-hidden" variant="secondary">
            <Link href={`/briefs/${data.candidate.id}?sponsor=${selectedBrief.sponsorId}` as Route}>Opportunity brief</Link>
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
          <p className="text-sm font-medium text-ink-900">Outreach target sponsor</p>
          <p className="mt-1 text-sm text-ink-500">
            Shift the plan between generated sponsor paths without rerunning the brief pipeline.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {data.opportunityBriefs.map((brief) => (
            <Button
              asChild
              key={brief.id}
              variant={brief.sponsorId === selectedBrief.sponsorId ? "primary" : "secondary"}
            >
              <Link href={`/outreach/${data.candidate.id}?sponsor=${brief.sponsorId}` as Route}>{brief.sponsor.fullName}</Link>
            </Button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <BriefStatusBadge status={selectedBrief.status} />
          <Badge variant="muted">{outreachPlan.channelLabel}</Badge>
          {outreachPlan.matchScoreLabel ? <Badge variant="muted">{outreachPlan.matchScoreLabel}</Badge> : null}
          <Badge variant="muted">{data.readiness.score}/100 readiness</Badge>
          {outboundApprovals.outreachRelease ? (
            <Badge
              variant={
                outboundApprovals.outreachRelease.status === "APPROVED"
                  ? "sage"
                  : outboundApprovals.outreachRelease.status === "REJECTED"
                    ? "danger"
                    : "gold"
              }
            >
              Outreach {outboundApprovals.outreachRelease.status.replaceAll("_", " ")}
            </Badge>
          ) : null}
        </div>
      </Card>

      <Tabs defaultValue="plan">
        <TabsList>
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="email">Email drafts</TabsTrigger>
          <TabsTrigger value="crm">CRM handoff</TabsTrigger>
        </TabsList>

        <TabsContent value="plan">
          <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <OutreachPlanDocument
              agenda={outreachPlan.agenda}
              briefStatus={selectedBrief.status}
              candidateName={data.candidate.fullName}
              cautionNote={outreachPlan.cautionNote}
              channelLabel={outreachPlan.channelLabel}
              evidenceToLead={outreachPlan.evidenceToLead}
              followUpDeliverables={outreachPlan.followUpDeliverables}
              introRequest={outreachPlan.introRequest}
              likelyQuestions={outreachPlan.likelyQuestions}
              meetingGoal={outreachPlan.meetingGoal}
              sponsorName={selectedMatch.sponsor.fullName}
              sponsorOpening={outreachPlan.sponsorOpening}
              sponsorOrganization={selectedMatch.sponsor.organization}
              subjectLine={outreachPlan.subjectLine}
            />

            <div className="space-y-5 print-hidden">
              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Outbound release</p>
                  <p className="mt-1 text-sm text-ink-500">
                    Sponsor-facing movement is gated by evidence discipline and explicit operator approval.
                  </p>
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <OutboundApprovalControls
                    approval={outboundApprovals.outreachRelease}
                    approvalType="OUTREACH_RELEASE"
                    blockers={outreachRelease.blockers}
                    candidateId={data.candidate.id}
                    opportunityBriefId={selectedBrief.id}
                    sponsorId={selectedBrief.sponsorId}
                  />
                  <OutboundApprovalControls
                    approval={outboundApprovals.crmHandoff}
                    approvalType="CRM_HANDOFF"
                    blockers={crmHandoffRelease.blockers}
                    candidateId={data.candidate.id}
                    opportunityBriefId={selectedBrief.id}
                    sponsorId={selectedBrief.sponsorId}
                  />
                </div>
              </Card>

              <ScoreBreakdownCard
                breakdown={selectedMatch.result.breakdown}
                score={selectedMatch.result.score}
                title="Sponsor match breakdown"
              />

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Channel rationale</p>
                  <p className="mt-1 text-sm text-ink-500">Why this outreach mode is the right one for this sponsor path.</p>
                </div>
                <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                  <p className="text-sm leading-7 text-ink-600">{outreachPlan.channelRationale}</p>
                </div>
                <div className="mt-5 space-y-3">
                  {selectedMatch.connectionPath.map((step) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={step}>
                      <p className="text-sm leading-7 text-ink-600">{step}</p>
                    </div>
                  ))}
                </div>
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
              </Card>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="email">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <ReleaseStatusCard
                blockers={outreachRelease.blockers}
                detail={outreachApprovalSummary.detail}
                label={outreachApprovalSummary.label}
                title="Outreach release state"
                variant={outreachApprovalSummary.variant}
              />
              <EmailDraftWorkbench
                blockedReason={outreachRelease.blocked ? outreachRelease.blockers[0] ?? "Outbound release is blocked." : null}
                candidateId={data.candidate.id}
                drafts={emailDrafts}
                opportunityBriefId={selectedBrief.id}
                sponsorId={selectedBrief.sponsorId}
              />
            </div>

            <div className="space-y-5">
              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Meeting prep</p>
                  <p className="mt-1 text-sm text-ink-500">Use the same sponsor-targeted evidence set to prepare for the first real conversation.</p>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ink-400">Meeting goal</p>
                    <p className="mt-2 text-sm leading-7 text-ink-600">{outreachPlan.meetingGoal}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                    <p className="text-sm font-medium text-ink-900">Likely diligence questions</p>
                    <div className="mt-3 space-y-2">
                      {outreachPlan.likelyQuestions.map((question) => (
                        <p className="text-sm leading-7 text-ink-600" key={question}>
                          {question}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Drafting guardrails</p>
                  <p className="mt-1 text-sm text-ink-500">Keep every outbound note narrow, inspectable, and easy for the sponsor to forward.</p>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                    <p className="text-sm leading-7 text-ink-600">
                      Do not overstate achievements that are only inferred from the evidence set.
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                    <p className="text-sm leading-7 text-ink-600">
                      Keep the ask to one concrete next step: introduction, conversation, pilot, or scoped diligence.
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                    <p className="text-sm leading-7 text-ink-600">
                      Use the brief and top artifacts as attachments only after the recipient signals interest.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Current proof set</p>
                  <p className="mt-1 text-sm text-ink-500">These are the strongest items to attach or reference first.</p>
                </div>
                <div className="mt-5 space-y-3">
                  {outreachPlan.evidenceToLead.map((item) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                      <p className="text-sm leading-7 text-ink-600">{item}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Outbound delivery history</p>
                  <p className="mt-1 text-sm text-ink-500">Every send attempt is recorded, including local fallback outbox events.</p>
                </div>
                <div className="mt-5 space-y-3">
                  {outboundEmails.map((email) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={email.id}>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={email.status === "SENT" ? "sage" : email.status === "FALLBACK" ? "gold" : "danger"}>
                          {email.status.toLowerCase()}
                        </Badge>
                        <Badge variant="muted">{email.providerMode.toLowerCase()}</Badge>
                        <Badge variant="muted">{email.draftLabel}</Badge>
                      </div>
                      <p className="mt-3 text-sm font-medium text-ink-900">{email.subject}</p>
                      <p className="mt-2 text-sm leading-7 text-ink-600">{email.sendNote}</p>
                      {email.recipientEmail ? (
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">Recipient · {email.recipientEmail}</p>
                      ) : null}
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
                        {email.requestedBy?.name ?? "Operator"} · {email.sentAtLabel ?? email.updatedAtLabel}
                      </p>
                      <div className="mt-4 space-y-3">
                        {email.events.map((event) => (
                          <div className="rounded-[1.25rem] border border-ink-100 bg-white px-4 py-3" key={event.id}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="muted">{event.eventType.replaceAll("_", " ").toLowerCase()}</Badge>
                                {event.actor?.name ? <Badge variant="sage">{event.actor.name}</Badge> : null}
                              </div>
                              <span className="text-xs uppercase tracking-[0.18em] text-ink-400">{event.occurredAtLabel}</span>
                            </div>
                            <p className="mt-3 text-sm font-medium text-ink-900">{event.title}</p>
                            <p className="mt-2 text-sm leading-7 text-ink-600">{event.detail}</p>
                          </div>
                        ))}
                      </div>
                      <EmailThreadControls outboundEmailId={email.id} />
                    </div>
                  ))}
                  {outboundEmails.length === 0 ? (
                    <p className="text-sm text-ink-500">No outbound email has been sent on this sponsor path yet.</p>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="crm">
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <ReleaseStatusCard
                blockers={crmHandoffRelease.blockers}
                detail={crmApprovalSummary.detail}
                label={crmApprovalSummary.label}
                title="CRM handoff release state"
                variant={crmApprovalSummary.variant}
              />
              <Card className="px-6 py-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
                  <div>
                    <p className="text-sm font-medium text-ink-900">CRM handoff preview</p>
                    <p className="mt-1 text-sm text-ink-500">
                      Structured export for sponsor operations or downstream systems.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        href={`/api/outreach/${data.candidate.id}/handoff?sponsor=${selectedBrief.sponsorId}&format=json` as Route}
                      >
                        Download JSON
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        href={`/api/outreach/${data.candidate.id}/handoff?sponsor=${selectedBrief.sponsorId}&format=csv` as Route}
                      >
                        Download CSV
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    ["Candidate", crmHandoff.candidateName],
                    ["Sponsor", crmHandoff.sponsorName],
                    ["Organization", crmHandoff.sponsorOrganization],
                    ["Opportunity type", crmHandoff.opportunityType.replaceAll("_", " ")],
                    ["Brief status", crmHandoff.briefStatus],
                    ["Outreach mode", crmHandoff.outreachMode.replaceAll("_", " ")],
                    ["Readiness", String(crmHandoff.sponsorReadinessScore)],
                    ["Match score", String(crmHandoff.sponsorMatchScore)],
                  ].map(([label, value]) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={label}>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{label}</p>
                      <p className="mt-2 text-sm leading-7 text-ink-700">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-4">
                  <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                    <p className="text-sm font-medium text-ink-900">Subject line</p>
                    <p className="mt-2 text-sm leading-7 text-ink-600">{crmHandoff.subjectLine}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                    <p className="text-sm font-medium text-ink-900">Warm path</p>
                    <p className="mt-2 text-sm leading-7 text-ink-600">{crmHandoff.warmPath || "No warm path recorded."}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                    <p className="text-sm font-medium text-ink-900">Next step</p>
                    <p className="mt-2 text-sm leading-7 text-ink-600">{crmHandoff.nextStep}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="space-y-5">
              <OperationsControls
                candidateId={data.candidate.id}
                crmBlockedReason={crmHandoffRelease.blocked ? crmHandoffRelease.blockers[0] : null}
                outboundBlockedReason={outreachRelease.blocked ? outreachRelease.blockers[0] : null}
                opportunityBriefId={selectedBrief.id}
                sponsorId={selectedBrief.sponsorId}
              />

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Recent CRM syncs</p>
                  <p className="mt-1 text-sm text-ink-500">Each sync records the effective provider mode and note used at the time of handoff.</p>
                </div>
                <div className="mt-5 space-y-4">
                  {crmSyncRecords.length > 0 ? (
                    crmSyncRecords.map((sync) => (
                      <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={sync.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CrmSyncBadge status={sync.status} />
                            <Badge variant="muted">{sync.providerMode}</Badge>
                          </div>
                          <span className="text-xs uppercase tracking-[0.18em] text-ink-400">{sync.updatedAtLabel}</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-ink-600">{sync.syncNote}</p>
                        {sync.externalRecordId ? (
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
                            External ID · {sync.externalRecordId}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink-500">No CRM syncs have been recorded for this sponsor path yet.</p>
                  )}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Sponsor activity timeline</p>
                  <p className="mt-1 text-sm text-ink-500">Operational events tied to this candidate-sponsor path.</p>
                </div>
                <div className="mt-5 space-y-4">
                  {sponsorActivities.length > 0 ? (
                    sponsorActivities.map((activity) => (
                      <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={activity.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="muted">{activity.activityType.replaceAll("_", " ")}</Badge>
                              <ActivityStatusBadge status={activity.status} />
                            </div>
                            <p className="mt-3 text-sm font-medium text-ink-900">{activity.title}</p>
                          </div>
                          <span className="text-xs uppercase tracking-[0.18em] text-ink-400">{activity.updatedAtLabel}</span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-ink-600">{activity.detail}</p>
                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">{activity.sourceLabel}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink-500">No sponsor activity has been logged for this path yet.</p>
                  )}
                </div>
              </Card>

              <Card className="px-5 py-5">
                <div className="border-b border-ink-100 pb-4">
                  <p className="text-sm font-medium text-ink-900">Export contents</p>
                  <p className="mt-1 text-sm text-ink-500">The handoff is intentionally simple so it can map into a CRM or ops tracker without cleanup.</p>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    `Sponsor ask: ${crmHandoff.sponsorAsk}`,
                    `Why now: ${crmHandoff.whyNow}`,
                    `Proof to bring: ${crmHandoff.proofToBring.replaceAll("|", " · ")}`,
                    `Risks: ${crmHandoff.risks.replaceAll("|", " · ") || "None recorded"}`,
                  ].map((item) => (
                    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                      <p className="text-sm leading-7 text-ink-600">{item}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
