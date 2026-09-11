import { ReviewStatus, SignalCategory, SponsorStyle, type Sponsor } from "@prisma/client";

import type { SponsorMatchBreakdown } from "@/lib/scoring";
import { parseDelimitedList, titleCase } from "@/lib/utils/strings";

type VariantClaim = {
  id: string;
  category: SignalCategory;
  claim: string;
  confidence: number;
  supportingExcerpt: string;
  artifactTitle: string;
  reviewStatus: ReviewStatus;
  reviewNote?: string | null;
};

type VariantRecommendation = {
  explanation: string;
  actionSuggestion: string;
  reviewStatus?: ReviewStatus;
  reviewNote?: string | null;
};

type SponsorMemoBase = {
  summary: string;
  rationale: string;
  strengthsList: string[];
  risksList: string[];
  recommendedAction: string;
};

const STYLE_PRIORITIES: Record<SponsorStyle, SignalCategory[]> = {
  [SponsorStyle.HANDS_ON]: [
    SignalCategory.FOLLOW_THROUGH,
    SignalCategory.COLLABORATION,
    SignalCategory.ADAPTABILITY,
  ],
  [SponsorStyle.SELECTIVE_DOOR_OPENER]: [
    SignalCategory.LEADERSHIP,
    SignalCategory.COMMUNICATION,
    SignalCategory.FOLLOW_THROUGH,
  ],
  [SponsorStyle.SYSTEMS_BUILDER]: [
    SignalCategory.ANALYTICAL_THINKING,
    SignalCategory.ADAPTABILITY,
    SignalCategory.FOLLOW_THROUGH,
  ],
  [SponsorStyle.PUBLIC_ADVOCATE]: [
    SignalCategory.MISSION_ALIGNMENT,
    SignalCategory.COMMUNICATION,
    SignalCategory.LEADERSHIP,
  ],
  [SponsorStyle.QUIET_CONNECTOR]: [
    SignalCategory.RESILIENCE,
    SignalCategory.FOLLOW_THROUGH,
    SignalCategory.COLLABORATION,
  ],
};

const STYLE_COPY: Record<
  SponsorStyle,
  {
    label: string;
    framing: string;
    whyItMatters: string;
    askStyle: string;
    riskPrompt: string;
  }
> = {
  [SponsorStyle.HANDS_ON]: {
    label: "Hands-on operator lens",
    framing: "an operating sponsorship decision with real coaching bandwidth behind it",
    whyItMatters:
      "This sponsor archetype cares most about whether the candidate can absorb feedback, stay on cadence, and carry execution through ambiguity.",
    askStyle:
      "Lead with a concrete working session, a scoped operating problem, or a tightly bounded introduction where the sponsor can observe execution quality quickly.",
    riskPrompt:
      "Before outreach, make sure the candidate can answer how they handle feedback loops, operating ownership, and pace under senior scrutiny.",
  },
  [SponsorStyle.SELECTIVE_DOOR_OPENER]: {
    label: "Selective door-opener lens",
    framing: "a high-conviction endorsement decision where reputational efficiency matters",
    whyItMatters:
      "This sponsor archetype wants a concise, defensible case that can travel quickly into an introduction without extensive handholding.",
    askStyle:
      "Lead with the clearest proof of leadership and communication, then make a narrow ask for one high-quality introduction rather than broad advocacy.",
    riskPrompt:
      "Before outreach, tighten the external proof points and make sure the candidate story can be repeated in two or three credible sentences.",
  },
  [SponsorStyle.SYSTEMS_BUILDER]: {
    label: "Systems-builder lens",
    framing: "a scalable operator investment rather than a one-off talent bet",
    whyItMatters:
      "This sponsor archetype pays attention to repeatability, process design, and whether the candidate can strengthen institutions rather than only individual projects.",
    askStyle:
      "Lead with the candidate's ability to design repeatable workflows, clarify messy systems, and convert pilots into operating models.",
    riskPrompt:
      "Before outreach, be ready to explain what becomes more systematic or repeatable if this candidate is backed into a broader role.",
  },
  [SponsorStyle.PUBLIC_ADVOCATE]: {
    label: "Public-advocate lens",
    framing: "a visible endorsement decision tied to mission credibility and public trust",
    whyItMatters:
      "This sponsor archetype wants candidates whose work can stand up publicly and whose story aligns with the sponsor's stated values.",
    askStyle:
      "Lead with mission alignment, narrative clarity, and one or two public-facing proof points that show the candidate can carry visible backing well.",
    riskPrompt:
      "Before outreach, pressure-test whether the public case is crisp enough and whether the candidate has enough external-facing proof to justify visible advocacy.",
  },
  [SponsorStyle.QUIET_CONNECTOR]: {
    label: "Quiet-connector lens",
    framing: "a trust-based introduction decision made through a private network",
    whyItMatters:
      "This sponsor archetype wants low-drama reliability, follow-through, and the confidence that a private introduction will reflect well on the connector.",
    askStyle:
      "Lead with consistency, discretion, and the specific context in which the candidate has already earned trust over time.",
    riskPrompt:
      "Before outreach, confirm that the candidate's strongest evidence shows stable judgment and reliable follow-through rather than only promise.",
  },
};

function joinList(values: string[]) {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function toStatusWeight(status: ReviewStatus) {
  if (status === ReviewStatus.APPROVED) {
    return 30;
  }

  if (status === ReviewStatus.PENDING) {
    return 12;
  }

  return 0;
}

function firstParagraph(value: string | undefined | null) {
  return value?.split("\n\n")[0]?.trim() ?? "";
}

function buildArtifactCitation(claims: VariantClaim[], count: number) {
  return Array.from(new Set(claims.slice(0, count).map((claim) => claim.artifactTitle)))
    .map((title) => `[${title}]`)
    .join(" ");
}

function appendCitations(text: string, claims: VariantClaim[], count: number) {
  const citations = buildArtifactCitation(claims, count);
  return citations ? `${text} ${citations}` : text;
}

function styleSpecificClaims(claims: VariantClaim[], sponsorStyle: SponsorStyle) {
  const priorities = STYLE_PRIORITIES[sponsorStyle];

  return [...claims]
    .sort((left, right) => {
      const leftPriority = priorities.indexOf(left.category);
      const rightPriority = priorities.indexOf(right.category);
      const priorityScore = (leftPriority === -1 ? 99 : leftPriority) - (rightPriority === -1 ? 99 : rightPriority);

      if (priorityScore !== 0) {
        return priorityScore;
      }

      const reviewScore = toStatusWeight(right.reviewStatus) - toStatusWeight(left.reviewStatus);
      if (reviewScore !== 0) {
        return reviewScore;
      }

      return right.confidence - left.confidence;
    })
    .slice(0, 4);
}

function domainFocus(sponsor: Sponsor) {
  const domains = parseDelimitedList(sponsor.domainExpertise);
  return domains.length > 0 ? joinList(domains.slice(0, 3)) : sponsor.organization;
}

function buildVariantStrengths(claims: VariantClaim[], sponsorStyle: SponsorStyle) {
  const copy = STYLE_COPY[sponsorStyle];

  return claims.slice(0, 3).map((claim) => {
    const lead =
      claim.category === STYLE_PRIORITIES[sponsorStyle][0]
        ? `This matters under a ${copy.label.toLowerCase()} because`
        : `For this sponsor archetype,`;

    return `${lead} ${claim.claim} [${claim.artifactTitle}]`;
  });
}

function buildVariantRisks({
  sponsorStyle,
  baseRisks,
  flaggedClaims,
}: {
  sponsorStyle: SponsorStyle;
  baseRisks: string[];
  flaggedClaims: VariantClaim[];
}) {
  const risks = [...baseRisks];
  const copy = STYLE_COPY[sponsorStyle];

  if (flaggedClaims.length > 0) {
    risks.unshift(
      `${copy.riskPrompt} Current review notes still flag: ${flaggedClaims
        .slice(0, 2)
        .map((claim) => claim.claim.toLowerCase())
        .join("; ")}.`,
    );
  } else {
    risks.unshift(copy.riskPrompt);
  }

  return Array.from(new Set(risks)).slice(0, 4);
}

export function buildSponsorMemoVariant({
  candidate,
  sponsor,
  memo,
  claims,
  bestSponsorRecommendation,
  warmPathRecommendation,
  nextActionRecommendation,
  matchScore,
  matchBreakdown,
  connectionPath,
}: {
  candidate: {
    fullName: string;
    headline: string;
    region: string;
    sponsorReadinessScore: number;
  };
  sponsor: Sponsor;
  memo: SponsorMemoBase;
  claims: VariantClaim[];
  bestSponsorRecommendation?: VariantRecommendation | null;
  warmPathRecommendation?: VariantRecommendation | null;
  nextActionRecommendation?: VariantRecommendation | null;
  matchScore: number;
  matchBreakdown: SponsorMatchBreakdown;
  connectionPath: string[];
}) {
  const copy = STYLE_COPY[sponsor.sponsorStyle];
  const selectedClaims = styleSpecificClaims(claims, sponsor.sponsorStyle);
  const topThemes = Array.from(new Set(selectedClaims.map((claim) => titleCase(claim.category)))).slice(0, 3);
  const approvedOrPendingClaims = selectedClaims.filter((claim) => claim.reviewStatus !== ReviewStatus.FLAGGED);
  const citationSource = approvedOrPendingClaims.length > 0 ? approvedOrPendingClaims : selectedClaims;
  const sponsorAngle =
    firstParagraph(bestSponsorRecommendation?.explanation) ||
    `${sponsor.fullName} is a strong fit because the current evidence overlaps with ${domainFocus(sponsor)} and aligns with ${copy.framing}.`;
  const warmPathSummary = firstParagraph(warmPathRecommendation?.explanation) || connectionPath.join(" ");
  const actionAsk =
    bestSponsorRecommendation?.actionSuggestion ||
    nextActionRecommendation?.actionSuggestion ||
    memo.recommendedAction;
  const variantSummary = appendCitations(
    `For ${sponsor.fullName} at ${sponsor.organization}, the case is strongest as ${copy.framing}. ${candidate.fullName} shows inspectable evidence in ${joinList(topThemes.map((theme) => theme.toLowerCase()))}, which fits a sponsor focused on ${domainFocus(sponsor)}.`,
    citationSource,
    2,
  );
  const variantRationale = [
    appendCitations(
      `${copy.whyItMatters} ${sponsorAngle} Match score is ${matchScore}/100, driven most by domain fit ${matchBreakdown.domainFit}, sponsor-style fit ${matchBreakdown.sponsorStyleFit}, and warm path availability ${matchBreakdown.warmPathAvailability}.`,
      citationSource,
      3,
    ),
    "",
    appendCitations(
      `${copy.askStyle} The sponsor path currently runs through ${warmPathSummary || "a direct approach with limited context"}.`,
      citationSource,
      2,
    ),
  ].join("\n");
  const variantStrengths = buildVariantStrengths(citationSource, sponsor.sponsorStyle);
  const flaggedClaims = claims.filter((claim) => claim.reviewStatus === ReviewStatus.FLAGGED);
  const variantRisks = buildVariantRisks({
    sponsorStyle: sponsor.sponsorStyle,
    baseRisks: memo.risksList,
    flaggedClaims,
  });
  const variantAction = [
    appendCitations(
      `Tailored ask for ${sponsor.fullName}: ${actionAsk}`,
      citationSource,
      2,
    ),
    "",
    warmPathRecommendation?.actionSuggestion ?? nextActionRecommendation?.explanation ?? memo.recommendedAction,
  ].join("\n");

  return {
    sponsorLabel: copy.label,
    summary: variantSummary,
    rationale: variantRationale,
    strengths: variantStrengths.length > 0 ? variantStrengths : memo.strengthsList,
    risks: variantRisks,
    recommendedAction: variantAction,
    sponsorAngle,
    selectedClaims,
  };
}
