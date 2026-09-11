import {
  SponsorAvailabilityStatus,
  SponsorActivityStatus,
  SponsorActivityType,
  SponsorPipelineStage,
  SignalCategory,
  SponsorStyle,
  type Artifact,
  type Candidate,
  type EvidenceClaim,
  type RelationshipEdge,
  type SponsorActivity,
  type SponsorOutcome,
  type SponsorPipelineItem,
  type Sponsor,
} from "@prisma/client";

import { clampNumber, formatDate, toFixedNumber } from "@/lib/utils/format";
import { parseDelimitedList } from "@/lib/utils/strings";
import { SponsorMatchBreakdown } from "@/lib/scoring/types";

const STYLE_PREFERENCES: Record<SponsorStyle, SignalCategory[]> = {
  [SponsorStyle.HANDS_ON]: [SignalCategory.COLLABORATION, SignalCategory.FOLLOW_THROUGH],
  [SponsorStyle.SELECTIVE_DOOR_OPENER]: [SignalCategory.LEADERSHIP, SignalCategory.COMMUNICATION],
  [SponsorStyle.SYSTEMS_BUILDER]: [SignalCategory.ANALYTICAL_THINKING, SignalCategory.ADAPTABILITY],
  [SponsorStyle.PUBLIC_ADVOCATE]: [SignalCategory.MISSION_ALIGNMENT, SignalCategory.COMMUNICATION],
  [SponsorStyle.QUIET_CONNECTOR]: [SignalCategory.RESILIENCE, SignalCategory.FOLLOW_THROUGH],
};

function collectCandidateKeywords(candidate: Candidate, artifacts: Artifact[], claims: EvidenceClaim[]) {
  const baseText = [candidate.headline, candidate.bio, ...artifacts.map((artifact) => artifact.title), ...claims.map((claim) => claim.claim)]
    .join(" ")
    .toLowerCase();

  const themes = [
    "climate",
    "health",
    "education",
    "community",
    "workforce",
    "mobility",
    "public interest",
    "technology",
    "policy",
    "arts",
    "youth",
    "civic",
    "housing",
    "finance",
  ];

  return themes.filter((theme) => baseText.includes(theme));
}

export type SponsorOperatingContext = {
  sponsorActivities?: Array<Pick<SponsorActivity, "activityType" | "status" | "detail">>;
  sponsorPipelineItems?: Array<Pick<SponsorPipelineItem, "stage" | "outcomeNote">>;
  sponsorOutcomes?: Array<Pick<SponsorOutcome, "verdict">>;
  availabilityStatus?: Sponsor["availabilityStatus"];
  maxConcurrentPaths?: Sponsor["maxConcurrentPaths"];
  blackoutUntil?: Sponsor["blackoutUntil"];
  blackoutReason?: Sponsor["blackoutReason"];
};

function buildRightNowRankingInsight(input: {
  availabilityStatus: Sponsor["availabilityStatus"];
  activePipelineCount: number;
  maxConcurrentPaths: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  responsivenessScore: number;
  blackoutActive: boolean;
  blackoutUntil?: Date | null;
}) {
  const loadRatio = input.activePipelineCount / Math.max(input.maxConcurrentPaths, 1);

  if (input.blackoutActive) {
    return {
      label: "Timing blackout",
      summary: `This sponsor should stay out of rotation${input.blackoutUntil ? ` until ${formatDate(input.blackoutUntil)}` : ""} even if the fit remains strong.`,
    };
  }

  if (input.availabilityStatus === SponsorAvailabilityStatus.PAUSED) {
    return {
      label: "Paused right now",
      summary: "This sponsor may fit on paper, but current availability should keep them out of the first outreach wave.",
    };
  }

  if (loadRatio >= 1) {
    return {
      label: "Capacity constrained",
      summary: `This sponsor is already at ${input.activePipelineCount}/${input.maxConcurrentPaths} active paths, so timing pressure is high right now.`,
    };
  }

  if (input.availabilityStatus === SponsorAvailabilityStatus.LIMITED) {
    return {
      label: "Limited window",
      summary: "The fit is still credible, but current availability is narrower than normal and should be handled deliberately.",
    };
  }

  if (input.negativeOutcomes >= 2 && input.negativeOutcomes >= input.positiveOutcomes) {
    return {
      label: "Watch recent outcomes",
      summary: "Recent sponsor-path results are mixed enough that this match should be treated cautiously even if the domain fit is strong.",
    };
  }

  if (input.positiveOutcomes >= 2 || input.responsivenessScore >= 6.5) {
    return {
      label: "Ready now",
      summary: "Availability, sponsor load, and recent outcome history all support moving this match to the top of the list right now.",
    };
  }

  return {
    label: "Promising now",
    summary: "The underlying fit is strong and the operating context is still workable, though not as proven as the strongest live targets.",
  };
}

export function buildSponsorOperatingProfile(context?: SponsorOperatingContext) {
  const activities = context?.sponsorActivities ?? [];
  const pipelineItems = context?.sponsorPipelineItems ?? [];
  const structuredOutcomes = context?.sponsorOutcomes ?? [];
  const activePipelineCount = pipelineItems.filter(
    (item) => item.stage !== SponsorPipelineStage.PASSED && item.stage !== SponsorPipelineStage.CLOSED,
  ).length;
  const completedExternalActions = activities.filter(
    (activity) =>
      activity.status === SponsorActivityStatus.COMPLETED &&
      activity.activityType !== SponsorActivityType.CRM_SYNCED,
  ).length;
  const blockedExternalActions = activities.filter((activity) => activity.status === SponsorActivityStatus.BLOCKED).length;
  const positiveOutcomes =
    structuredOutcomes.length > 0
      ? structuredOutcomes.filter((outcome) => outcome.verdict === "POSITIVE").length
      : activities.filter(
    (activity) =>
      activity.activityType === SponsorActivityType.OUTCOME_RECORDED &&
      activity.status === SponsorActivityStatus.COMPLETED &&
      /(advanced|advocating|introduced|pilot|backed|funded|meeting)/i.test(activity.detail),
  ).length;
  const negativeOutcomes =
    structuredOutcomes.length > 0
      ? structuredOutcomes.filter((outcome) => outcome.verdict === "NEGATIVE").length
      : pipelineItems.filter(
    (item) =>
      item.stage === SponsorPipelineStage.PASSED ||
      /(declined|paused|not moving|not a fit|hold)/i.test(item.outcomeNote ?? ""),
  ).length;
  const externalTouchCount = activities.filter(
    (activity) => activity.activityType !== SponsorActivityType.CRM_SYNCED,
  ).length;
  const responsivenessRate =
    externalTouchCount === 0 ? 0.65 : completedExternalActions / Math.max(externalTouchCount, 1);
  const maxConcurrentPaths = Math.max(context?.maxConcurrentPaths ?? 4, 1);
  const loadRatio = activePipelineCount / maxConcurrentPaths;
  const availabilityStatus = context?.availabilityStatus ?? SponsorAvailabilityStatus.OPEN;
  const blackoutUntil = context?.blackoutUntil ?? null;
  const blackoutActive = Boolean(blackoutUntil && blackoutUntil.getTime() > Date.now());
  const blackoutPenalty = blackoutActive ? 2.6 : 0;
  const availabilityPenalty =
    availabilityStatus === SponsorAvailabilityStatus.PAUSED
      ? 3.5
      : availabilityStatus === SponsorAvailabilityStatus.LIMITED
        ? 1.2
        : 0;
  const capacityScore = clampNumber(
    8.5 - loadRatio * 4.5 - availabilityPenalty - blackoutPenalty,
    availabilityStatus === SponsorAvailabilityStatus.PAUSED || blackoutActive ? 0.5 : 1.5,
    8,
  );
  const responsivenessScore = clampNumber(
    responsivenessRate * 8 +
      positiveOutcomes * 0.6 -
      blockedExternalActions * 0.8 -
      negativeOutcomes * 0.4 -
      availabilityPenalty * 0.3 -
      blackoutPenalty * 0.9,
    blackoutActive ? 1 : 1.5,
    8,
  );

  return {
    activePipelineCount,
    maxConcurrentPaths,
    availabilityStatus,
    blackoutActive,
    blackoutUntil,
    blackoutReason: context?.blackoutReason ?? null,
    completedExternalActions,
    blockedExternalActions,
    positiveOutcomes,
    negativeOutcomes,
    capacityScore: toFixedNumber(capacityScore),
    responsivenessScore: toFixedNumber(responsivenessScore),
  };
}

export function computeSponsorMatch(
  candidate: Candidate,
  sponsor: Sponsor,
  artifacts: Artifact[],
  claims: EvidenceClaim[],
  edges: RelationshipEdge[],
  operatingContext?: SponsorOperatingContext,
) {
  const candidateKeywords = collectCandidateKeywords(candidate, artifacts, claims);
  const sponsorDomains = parseDelimitedList(sponsor.domainExpertise).map((item) => item.toLowerCase());
  const sponsorInterestTags = parseDelimitedList(sponsor.interestTags).map((item) => item.toLowerCase());
  const operatingProfile = buildSponsorOperatingProfile({
    ...operatingContext,
    availabilityStatus: sponsor.availabilityStatus,
    maxConcurrentPaths: sponsor.maxConcurrentPaths,
    blackoutUntil: sponsor.blackoutUntil,
    blackoutReason: sponsor.blackoutReason,
  });

  const domainOverlap = candidateKeywords.filter((keyword) => sponsorDomains.includes(keyword)).length;
  const interestOverlapRaw = candidateKeywords.filter((keyword) => sponsorInterestTags.includes(keyword)).length;
  const domainFit = clampNumber(domainOverlap * 6 + (domainOverlap > 0 ? 4 : 0), 0, 16);

  const geographyFit =
    candidate.region.toLowerCase() === sponsor.geography.toLowerCase()
      ? 8
      : candidate.region.toLowerCase().includes("remote") || sponsor.geography.toLowerCase().includes("global")
        ? 6
        : sponsor.geography.toLowerCase().includes("north america")
          ? 5
          : 2.5;

  const interestOverlap = clampNumber(interestOverlapRaw * 4, 0, 12);

  const styleCategories = STYLE_PREFERENCES[sponsor.sponsorStyle];
  const styleAlignedClaims = claims.filter((claim) => styleCategories.includes(claim.category)).length;
  const sponsorStyleFit = clampNumber(styleAlignedClaims * 2.5, 0, 10);

  const warmEdges = edges.filter((edge) => {
    const candidateLinked = edge.fromEntityId === candidate.id || edge.toEntityId === candidate.id;
    const sponsorLinked = edge.fromEntityId === sponsor.id || edge.toEntityId === sponsor.id;
    return candidateLinked || sponsorLinked;
  });
  const warmPathAvailability = clampNumber(
    (sponsor.warmIntroAvailable ? 8 : 0) + warmEdges.reduce((sum, edge) => sum + edge.strength, 0),
    0,
    18,
  );

  const strongSignals = claims.filter((claim) => claim.confidence >= 0.72).length;
  const signalProfile = clampNumber(strongSignals * 2, 0, 12);

  const actionRelevance = clampNumber(
    candidate.currentStage === "MEMO_READY" || candidate.currentStage === "SPONSOR_OUTREACH"
      ? 8
      : candidate.currentStage === "REVIEW"
        ? 6
        : 3.5,
    0,
    8,
  );

  const breakdown: SponsorMatchBreakdown = {
    domainFit: toFixedNumber(domainFit),
    geographyFit: toFixedNumber(geographyFit),
    interestOverlap: toFixedNumber(interestOverlap),
    sponsorStyleFit: toFixedNumber(sponsorStyleFit),
    warmPathAvailability: toFixedNumber(warmPathAvailability),
    signalProfile: toFixedNumber(signalProfile),
    actionRelevance: toFixedNumber(actionRelevance),
    sponsorCapacity: operatingProfile.capacityScore,
    sponsorResponsiveness: operatingProfile.responsivenessScore,
  };
  const baseFitScore = Math.round(
    domainFit +
      geographyFit +
      interestOverlap +
      sponsorStyleFit +
      warmPathAvailability +
      signalProfile +
      actionRelevance,
  );
  const score = Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  const operationalDelta = Math.round(
    (operatingProfile.capacityScore - 5) + (operatingProfile.responsivenessScore - 5),
  );
  const rightNowInsight = buildRightNowRankingInsight({
    availabilityStatus: operatingProfile.availabilityStatus,
    activePipelineCount: operatingProfile.activePipelineCount,
    maxConcurrentPaths: operatingProfile.maxConcurrentPaths,
    positiveOutcomes: operatingProfile.positiveOutcomes,
    negativeOutcomes: operatingProfile.negativeOutcomes,
    responsivenessScore: operatingProfile.responsivenessScore,
    blackoutActive: operatingProfile.blackoutActive,
    blackoutUntil: operatingProfile.blackoutUntil,
  });

  return {
    score,
    baseFitScore,
    operationalDelta,
    rightNowLabel: rightNowInsight.label,
    rightNowSummary: rightNowInsight.summary,
    breakdown,
    candidateKeywords,
    sponsorDomains,
    sponsorInterestTags,
    operatingProfile,
  };
}
