import { NextResponse } from "next/server";
import { AuditLogTargetType, MembershipRole } from "@prisma/client";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/audit/log";
import { getCandidateDetail, searchValueToString } from "@/lib/db/queries";
import { buildSponsorMemoVariant } from "@/lib/memo/variant";
import { buildOutboundReleaseAssessment } from "@/lib/outreach/approvals";
import { getOutreachContext } from "@/lib/outreach/context";

function buildPacketMarkdown(input: {
  candidateName: string;
  sponsorName: string;
  sponsorOrganization: string;
  summary: string;
  rationale: string;
  strengths: string[];
  risks: string[];
  connectionPath: string[];
}) {
  return [
    `# Internal Packet · ${input.candidateName} × ${input.sponsorName}`,
    "",
    `Sponsor: ${input.sponsorName} · ${input.sponsorOrganization}`,
    "",
    "## Summary",
    input.summary,
    "",
    "## Sponsor Angle",
    input.rationale,
    "",
    "## Strengths",
    ...input.strengths.map((item) => `- ${item}`),
    "",
    "## Risks",
    ...input.risks.map((item) => `- ${item}`),
    "",
    "## Warm Path",
    ...input.connectionPath.map((item) => `- ${item}`),
  ].join("\n");
}

function buildOutreachMarkdown(input: {
  candidateName: string;
  sponsorName: string;
  subjectLine: string;
  introRequest: string;
  meetingGoal: string;
  agenda: string[];
  followUpDeliverables: string[];
}) {
  return [
    `# Outreach Plan · ${input.candidateName} × ${input.sponsorName}`,
    "",
    `Subject line: ${input.subjectLine}`,
    "",
    "## Intro Request",
    input.introRequest,
    "",
    "## Meeting Goal",
    input.meetingGoal,
    "",
    "## Agenda",
    ...input.agenda.map((item) => `- ${item}`),
    "",
    "## Follow-up Deliverables",
    ...input.followUpDeliverables.map((item) => `- ${item}`),
  ].join("\n");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const activeSession = session;

  const { candidateId } = await params;
  const { searchParams } = new URL(request.url);
  const exportType = searchValueToString(searchParams.get("type") ?? undefined) || "memo";
  const format = searchValueToString(searchParams.get("format") ?? undefined) || "json";
  const sponsorId = searchValueToString(searchParams.get("sponsor") ?? undefined);

  async function logExport(detail: string, resolvedSponsorId?: string | null) {
    await recordAuditLog({
      organizationId: activeSession.organizationId,
      actorUserId: activeSession.user.id,
      candidateId,
      sponsorId: resolvedSponsorId ?? null,
      targetType: AuditLogTargetType.EXPORT,
      action: `export.${exportType}.${format}`,
      title: `Candidate export · ${exportType}`,
      detail,
      payload: {
        exportType,
        format,
        sponsorId: resolvedSponsorId ?? null,
      },
    });
  }

  if (exportType === "outreach") {
    const context = await getOutreachContext(candidateId, sponsorId);

    if (!context || !context.selectedMatch || !context.selectedBrief || !context.outreachPlan || !context.variant) {
      return NextResponse.json({ error: "Outreach export is not ready." }, { status: 404 });
    }

    if (context.outreachRelease.blocked) {
      return NextResponse.json(
        { error: context.outreachRelease.blockers[0] ?? "Outreach export is still blocked." },
        { status: 409 },
      );
    }

    const payload = {
      candidate: context.data.candidate,
      sponsor: context.selectedMatch.sponsor,
      brief: context.selectedBrief,
      outreachPlan: context.outreachPlan,
      warmPathInsight: context.selectedMatch.warmPathInsight,
    };

    if (format === "md") {
      await logExport("Outreach plan markdown export generated.", context.selectedMatch.sponsor.id);
      return new NextResponse(
        buildOutreachMarkdown({
          candidateName: context.data.candidate.fullName,
          sponsorName: context.selectedMatch.sponsor.fullName,
          subjectLine: context.outreachPlan.subjectLine,
          introRequest: context.outreachPlan.introRequest,
          meetingGoal: context.outreachPlan.meetingGoal,
          agenda: context.outreachPlan.agenda,
          followUpDeliverables: context.outreachPlan.followUpDeliverables,
        }),
        {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="outreach-${candidateId}.md"`,
          },
        },
      );
    }

    await logExport("Outreach plan JSON export generated.", context.selectedMatch.sponsor.id);
    return NextResponse.json(payload);
  }

  const data = await getCandidateDetail(candidateId);

  if (!data) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const selectedMatch = sponsorId
    ? data.sponsorMatches.find((match) => match.sponsor.id === sponsorId) ?? data.sponsorMatches[0] ?? null
    : data.sponsorMatches[0] ?? null;
  const sponsorRecommendation =
    selectedMatch
      ? data.recommendations.bestSponsors.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null
      : null;
  const warmPathRecommendation =
    selectedMatch
      ? data.recommendations.warmPaths.find((item) => item.sponsorId === selectedMatch.sponsor.id) ?? null
      : null;
  const variant =
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
  const sponsorFacingExportRelease = buildOutboundReleaseAssessment({
    safetySettings: {
      ...data.safetySettings,
      requireOutboundApproval: false,
    },
    safetyReport: data.safetyReport,
    openProofRequestCount: data.proofRequests.filter((request) => request.status === "OPEN" || request.status === "IN_PROGRESS").length,
    staleRecommendationCount: data.recommendationFreshnessSummary.stale,
    approvals: [],
  });

  if (exportType === "memo") {
    if (!data.memo) {
      return NextResponse.json({ error: "Memo not ready." }, { status: 404 });
    }

    if (sponsorFacingExportRelease.blocked) {
      return NextResponse.json(
        { error: sponsorFacingExportRelease.blockers[0] ?? "Memo export is still blocked." },
        { status: 409 },
      );
    }

    if (format === "md") {
      await logExport("Memo markdown export generated.", selectedMatch?.sponsor.id ?? sponsorId ?? null);
      return new NextResponse(data.memo.memoMarkdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="memo-${candidateId}.md"`,
        },
      });
    }

    await logExport("Memo JSON export generated.", selectedMatch?.sponsor.id ?? sponsorId ?? null);
    return NextResponse.json({
      candidate: data.candidate,
      memo: data.memo,
      sponsorVariant: variant,
      selectedSponsor: selectedMatch?.sponsor ?? null,
    });
  }

  if (exportType === "brief") {
    const selectedBrief =
      data.opportunityBriefs.find((brief) => brief.sponsorId === sponsorId) ?? data.opportunityBriefs[0] ?? null;

    if (!selectedBrief) {
      return NextResponse.json({ error: "Brief not ready." }, { status: 404 });
    }

    if (sponsorFacingExportRelease.blocked) {
      return NextResponse.json(
        { error: sponsorFacingExportRelease.blockers[0] ?? "Brief export is still blocked." },
        { status: 409 },
      );
    }

    if (format === "md") {
      await logExport("Opportunity brief markdown export generated.", selectedBrief.sponsorId);
      return new NextResponse(selectedBrief.briefMarkdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="brief-${candidateId}.md"`,
        },
      });
    }

    await logExport("Opportunity brief JSON export generated.", selectedBrief.sponsorId);
    return NextResponse.json({
      candidate: data.candidate,
      brief: selectedBrief,
      selectedSponsor: selectedMatch?.sponsor ?? null,
      warmPathInsight: selectedMatch?.warmPathInsight ?? null,
    });
  }

  if (exportType === "packet") {
    if (!data.memo || !selectedMatch || !variant) {
      return NextResponse.json({ error: "Packet not ready." }, { status: 404 });
    }

    if (sponsorFacingExportRelease.blocked) {
      return NextResponse.json(
        { error: sponsorFacingExportRelease.blockers[0] ?? "Packet export is still blocked." },
        { status: 409 },
      );
    }

    if (format === "md") {
      await logExport("Internal packet markdown export generated.", selectedMatch.sponsor.id);
      return new NextResponse(
        buildPacketMarkdown({
          candidateName: data.candidate.fullName,
          sponsorName: selectedMatch.sponsor.fullName,
          sponsorOrganization: selectedMatch.sponsor.organization,
          summary: variant.summary,
          rationale: variant.rationale,
          strengths: variant.strengths,
          risks: variant.risks,
          connectionPath: selectedMatch.connectionPath,
        }),
        {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": `attachment; filename="packet-${candidateId}.md"`,
          },
        },
      );
    }

    await logExport("Internal packet JSON export generated.", selectedMatch.sponsor.id);
    return NextResponse.json({
      candidate: data.candidate,
      sponsor: selectedMatch.sponsor,
      variant,
      warmPathInsight: selectedMatch.warmPathInsight,
      fitBreakdown: selectedMatch.result.breakdown,
    });
  }

  return NextResponse.json({ error: "Unsupported export type." }, { status: 400 });
}
