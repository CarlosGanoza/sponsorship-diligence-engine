import { BriefStatus, SponsorStyle, type Candidate, type OpportunityBrief, type Sponsor } from "@prisma/client";

import { titleCase } from "@/lib/utils/strings";

export type OutreachMode = "WARM_INTRO" | "DIRECT_NOTE" | "OPERATOR_BRIEFING";

type BriefView = Pick<
  OpportunityBrief,
  "title" | "opportunityType" | "status" | "summary" | "whyNow" | "sponsorAsk"
> & {
  talkingPointsList: string[];
  proofToBringList: string[];
  successIndicatorsList: string[];
};

const STYLE_QUESTIONS: Record<SponsorStyle, string[]> = {
  HANDS_ON: [
    "What scoped operating problem can the candidate own in the first 30 to 60 days?",
    "What proof would let the sponsor judge execution quality quickly?",
  ],
  SELECTIVE_DOOR_OPENER: [
    "What introduction is specific enough to protect sponsor trust?",
    "What evidence makes the next conversation worth the sponsor's reputation?",
  ],
  SYSTEMS_BUILDER: [
    "Which workflow, platform, or operating model is the candidate best positioned to improve?",
    "How will the sponsor see repeatability instead of one-off performance?",
  ],
  PUBLIC_ADVOCATE: [
    "What claim can the sponsor stand behind publicly without overstating the evidence?",
    "What visible platform compounds credibility instead of creating noise?",
  ],
  QUIET_CONNECTOR: [
    "Why is this a trust-dependent introduction rather than a broad circulation ask?",
    "What preparation will make the first conversation feel low-risk and high-signal?",
  ],
};

function buildCautionNote(status: BriefStatus) {
  if (status === BriefStatus.HOLD) {
    return "Pause external outreach until flagged review items are resolved and the evidence set has been re-cleared by an operator.";
  }

  if (status === BriefStatus.DRAFT) {
    return "Treat this as an internal prep note first. Tighten one more proof artifact before sending it into a sponsor conversation.";
  }

  return "Lead with cited proof, keep the ask narrow, and avoid presenting any inference as a confirmed achievement.";
}

export function determineOutreachMode({
  briefStatus,
  connectionPath,
  warmIntroAvailable,
}: {
  briefStatus: BriefStatus;
  connectionPath: string[];
  warmIntroAvailable: boolean;
}): OutreachMode {
  if (briefStatus === BriefStatus.HOLD) {
    return "OPERATOR_BRIEFING";
  }

  if (warmIntroAvailable || connectionPath.length > 0) {
    return "WARM_INTRO";
  }

  return "DIRECT_NOTE";
}

export function buildOutreachPlan({
  candidate,
  sponsor,
  brief,
  connectionPath,
  warmPathNote,
  sponsorAngle,
  risks,
  matchScore,
}: {
  candidate: Pick<Candidate, "fullName" | "headline" | "region">;
  sponsor: Pick<Sponsor, "fullName" | "organization" | "title" | "sponsorStyle" | "warmIntroAvailable">;
  brief: BriefView;
  connectionPath: string[];
  warmPathNote?: string | null;
  sponsorAngle: string;
  risks: string[];
  matchScore?: number;
}) {
  const mode = determineOutreachMode({
    briefStatus: brief.status,
    connectionPath,
    warmIntroAvailable: sponsor.warmIntroAvailable,
  });
  const subjectLine = `${candidate.fullName} · ${titleCase(brief.opportunityType)} via ${sponsor.organization}`;
  const introRequest =
    mode === "WARM_INTRO"
      ? `Use the existing warm path to position ${candidate.fullName} for ${brief.sponsorAsk.toLowerCase()} Lead with the specific ask, then attach the brief and one supporting artifact.`
      : mode === "DIRECT_NOTE"
        ? `Send a direct, tightly scoped note to ${sponsor.fullName} that opens with ${brief.whyNow.toLowerCase()} and closes with a single concrete ask.`
        : `Keep this inside the operator team for now. Resolve the flagged issues, sharpen the proof set, and only reopen outreach once the brief moves out of hold.`;
  const sponsorOpening = `${candidate.fullName} is currently best framed for ${sponsor.fullName} as ${sponsorAngle.toLowerCase()} ${brief.summary}`;
  const meetingGoal = brief.successIndicatorsList[0] ?? `Secure a sponsor-backed next step with ${sponsor.organization}.`;
  const agenda = [
    `Open with the current opportunity: ${brief.whyNow}`,
    `Ground the case in concrete proof: ${brief.proofToBringList[0] ?? "Use the strongest cited artifact from the brief."}`,
    `Make the ask clearly: ${brief.sponsorAsk}`,
    `Close on the immediate success condition: ${meetingGoal}`,
  ];
  const evidenceToLead = brief.proofToBringList.slice(0, 4);
  const likelyQuestions = [
    ...STYLE_QUESTIONS[sponsor.sponsorStyle],
    warmPathNote ?? "What additional proof would make the sponsor comfortable moving from interest to action?",
  ].slice(0, 4);
  const followUpDeliverables = [
    "Send the brief, memo variant, and top artifact within 24 hours of the conversation.",
    ...brief.successIndicatorsList.slice(0, 2),
    risks[0] ? `Address the main diligence concern explicitly: ${risks[0]}` : "",
  ].filter(Boolean);
  const channelLabel =
    mode === "WARM_INTRO" ? "Warm intro" : mode === "DIRECT_NOTE" ? "Direct sponsor note" : "Operator briefing";
  const channelRationale =
    mode === "WARM_INTRO"
      ? `A warm route exists${connectionPath.length > 0 ? ` through ${connectionPath.join(" -> ")}` : ""}, which lowers the reputational cost of the first ask.`
      : mode === "DIRECT_NOTE"
        ? `No strong warm path is required, so the outreach should stay concise, evidence-backed, and highly specific.`
        : `The brief is not yet safe for external use. Keep it in internal circulation until review issues are closed.`;

  return {
    title: `Outreach plan · ${candidate.fullName} × ${sponsor.fullName}`,
    mode,
    channelLabel,
    channelRationale,
    subjectLine,
    introRequest,
    sponsorOpening,
    meetingGoal,
    agenda,
    evidenceToLead,
    likelyQuestions,
    followUpDeliverables,
    cautionNote: buildCautionNote(brief.status),
    matchScoreLabel: typeof matchScore === "number" ? `${matchScore}/100 sponsor fit` : null,
  };
}
