import { ArtifactType, SignalCategory, SponsorStyle } from "@prisma/client";

import type { AiProvider } from "@/lib/ai/types";
import { fromPrismaSignalCategory } from "@/lib/ai/mappers";
import { seededNumber } from "@/lib/utils/deterministic";
import { parseDelimitedList, titleCase } from "@/lib/utils/strings";

const CATEGORY_KEYWORDS: Record<SignalCategory, string[]> = {
  [SignalCategory.INITIATIVE]: ["launched", "started", "built", "created", "initiated", "piloted"],
  [SignalCategory.FOLLOW_THROUGH]: ["delivered", "completed", "sustained", "implemented", "executed"],
  [SignalCategory.LEADERSHIP]: ["led", "managed", "coached", "directed", "organized"],
  [SignalCategory.ADAPTABILITY]: ["adapted", "pivoted", "reframed", "iterated", "adjusted"],
  [SignalCategory.COMMUNICATION]: ["presented", "wrote", "facilitated", "translated", "briefed"],
  [SignalCategory.ANALYTICAL_THINKING]: ["analyzed", "modeled", "evaluated", "measured", "designed"],
  [SignalCategory.COLLABORATION]: ["partnered", "collaborated", "co-created", "worked with", "coordinated"],
  [SignalCategory.RESILIENCE]: ["persisted", "recovered", "navigated", "stayed", "continued"],
  [SignalCategory.MISSION_ALIGNMENT]: ["community", "equity", "access", "public interest", "mission"],
};

const ARTIFACT_BIAS: Record<ArtifactType, SignalCategory[]> = {
  [ArtifactType.RESUME]: [SignalCategory.FOLLOW_THROUGH, SignalCategory.LEADERSHIP],
  [ArtifactType.PROJECT_SUMMARY]: [SignalCategory.INITIATIVE, SignalCategory.ANALYTICAL_THINKING],
  [ArtifactType.MENTOR_NOTE]: [SignalCategory.LEADERSHIP, SignalCategory.COLLABORATION],
  [ArtifactType.RECOMMENDATION]: [SignalCategory.COMMUNICATION, SignalCategory.RESILIENCE],
  [ArtifactType.REFLECTION]: [SignalCategory.ADAPTABILITY, SignalCategory.MISSION_ALIGNMENT],
  [ArtifactType.PORTFOLIO_LINK]: [SignalCategory.INITIATIVE, SignalCategory.COMMUNICATION],
  [ArtifactType.OTHER]: [SignalCategory.FOLLOW_THROUGH, SignalCategory.MISSION_ALIGNMENT],
};

const OPPORTUNITY_MAP: Record<SignalCategory, string[]> = {
  [SignalCategory.INITIATIVE]: ["operator fellowship", "special project sponsorship"],
  [SignalCategory.FOLLOW_THROUGH]: ["stretch operating role", "trusted execution assignment"],
  [SignalCategory.LEADERSHIP]: ["board observer introduction", "team leadership pathway"],
  [SignalCategory.ADAPTABILITY]: ["cross-functional residency", "innovation lab placement"],
  [SignalCategory.COMMUNICATION]: ["speaker nomination", "stakeholder-facing fellowship"],
  [SignalCategory.ANALYTICAL_THINKING]: ["strategy analyst sponsorship", "research-backed operating role"],
  [SignalCategory.COLLABORATION]: ["coalition leadership opportunity", "ecosystem convening role"],
  [SignalCategory.RESILIENCE]: ["long-horizon sponsorship track", "mission-driven placement"],
  [SignalCategory.MISSION_ALIGNMENT]: ["values-aligned foundation introduction", "public-interest fellowship"],
};

function splitIntoExcerpts(rawText: string) {
  const sentences = rawText
    .split(/[\n.]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40);

  if (sentences.length > 0) {
    return sentences;
  }

  return [rawText.trim().slice(0, 200)];
}

function rankCategories(rawText: string, artifactType: ArtifactType) {
  const lower = rawText.toLowerCase();
  const ranked = Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => {
    const keywordHits = keywords.filter((keyword) => lower.includes(keyword)).length;
    const biasBonus = ARTIFACT_BIAS[artifactType].includes(category as SignalCategory) ? 2 : 0;
    return {
      category: category as SignalCategory,
      score: keywordHits + biasBonus,
    };
  });

  return ranked.sort((left, right) => right.score - left.score).slice(0, 3);
}

function extractTags(text: string) {
  const dictionary = [
    "climate",
    "health",
    "education",
    "community",
    "workforce",
    "mobility",
    "civic",
    "policy",
    "technology",
    "equity",
    "youth",
    "housing",
    "finance",
  ];

  const lower = text.toLowerCase();
  return dictionary.filter((tag) => lower.includes(tag));
}

function buildClaimStatement(category: SignalCategory, excerpt: string) {
  const sanitized = excerpt.replace(/\s+/g, " ").trim().replace(/[.;]$/, "");

  switch (category) {
    case SignalCategory.INITIATIVE:
      return `Shows self-directed initiative through ${sanitized.toLowerCase()}.`;
    case SignalCategory.FOLLOW_THROUGH:
      return `Demonstrates follow-through by ${sanitized.toLowerCase()}.`;
    case SignalCategory.LEADERSHIP:
      return `Provides evidence of leadership in ${sanitized.toLowerCase()}.`;
    case SignalCategory.ADAPTABILITY:
      return `Shows adaptability when ${sanitized.toLowerCase()}.`;
    case SignalCategory.COMMUNICATION:
      return `Signals strong communication through ${sanitized.toLowerCase()}.`;
    case SignalCategory.ANALYTICAL_THINKING:
      return `Reflects analytical thinking in ${sanitized.toLowerCase()}.`;
    case SignalCategory.COLLABORATION:
      return `Demonstrates collaborative execution through ${sanitized.toLowerCase()}.`;
    case SignalCategory.RESILIENCE:
      return `Shows resilience by ${sanitized.toLowerCase()}.`;
    case SignalCategory.MISSION_ALIGNMENT:
      return `Suggests mission alignment in ${sanitized.toLowerCase()}.`;
    default:
      return sanitized;
  }
}

function buildRiskStatements(categories: SignalCategory[], artifactCount: number) {
  const risks = [];

  if (artifactCount < 3) {
    risks.push("Evidence set is still narrow; one more third-party artifact would strengthen external conviction.");
  }

  if (!categories.includes(SignalCategory.LEADERSHIP)) {
    risks.push("Leadership evidence is promising but not yet repeated across multiple contexts.");
  }

  if (!categories.includes(SignalCategory.ANALYTICAL_THINKING)) {
    risks.push("Analytical proof is limited; a more quantified operating result would sharpen the case.");
  }

  return risks.slice(0, 3);
}

function inferOpportunityTypes(categories: SignalCategory[]) {
  return Array.from(
    new Set(
      categories.flatMap((category) => OPPORTUNITY_MAP[category]).slice(0, 3),
    ),
  );
}

function inferRequiredProof(categories: SignalCategory[]) {
  const missingProof = [];

  if (!categories.includes(SignalCategory.LEADERSHIP)) {
    missingProof.push("A concrete example of leading others through ambiguity.");
  }

  if (!categories.includes(SignalCategory.FOLLOW_THROUGH)) {
    missingProof.push("A closed-loop outcome with clear delivery evidence.");
  }

  if (!categories.includes(SignalCategory.COMMUNICATION)) {
    missingProof.push("External-facing communication proof, such as a memo, presentation, or stakeholder brief.");
  }

  return missingProof.slice(0, 3);
}

function styleSummary(style: SponsorStyle) {
  switch (style) {
    case SponsorStyle.HANDS_ON:
      return "hands-on backing and operator coaching";
    case SponsorStyle.SELECTIVE_DOOR_OPENER:
      return "high-leverage introductions when conviction is earned";
    case SponsorStyle.SYSTEMS_BUILDER:
      return "structured sponsorship with a bias toward repeatable systems";
    case SponsorStyle.PUBLIC_ADVOCATE:
      return "visible public sponsorship for mission-aligned talent";
    case SponsorStyle.QUIET_CONNECTOR:
      return "quiet, trusted introductions through curated networks";
    default:
      return "sponsor support";
  }
}

export const mockAiProvider: AiProvider = {
  async extractEvidenceClaims({ candidate, artifact }) {
    const excerpts = splitIntoExcerpts(artifact.rawText);
    const rankedCategories = rankCategories(artifact.rawText, artifact.artifactType);
    const claims = rankedCategories.map((entry, index) => {
      const excerpt = excerpts[index % excerpts.length] ?? excerpts[0];
      const confidence = seededNumber(
        `${candidate.id}:${artifact.id}:${entry.category}:${index}`,
        0.64,
        0.91,
      );

      return {
        category: fromPrismaSignalCategory(entry.category),
        claim: buildClaimStatement(entry.category, excerpt),
        confidence: Number(confidence.toFixed(2)),
        supportingExcerpt: excerpt,
        tags: extractTags(`${artifact.title} ${excerpt}`),
      };
    });

    return { claims };
  },

  async generateSponsorMemo({ candidate, artifacts, claims, readinessScore }) {
    const sortedClaims = [...claims].sort((left, right) => right.confidence - left.confidence).slice(0, 4);
    const topCategories = Array.from(new Set(sortedClaims.map((claim) => claim.category)));
    const categoryNames = topCategories.map((category) => titleCase(category));
    const strongestSignals = sortedClaims.map(
      (claim) => `${titleCase(claim.category)}: ${claim.claim} [${claim.artifactTitle}]`,
    );
    const risks = buildRiskStatements(
      sortedClaims.map((claim) => claim.category).map((category) => {
        const key = category.toUpperCase() as keyof typeof SignalCategory;
        return SignalCategory[key];
      }),
      artifacts.length,
    );
    const opportunityTypes = inferOpportunityTypes(
      sortedClaims.map((claim) => {
        const key = claim.category.toUpperCase() as keyof typeof SignalCategory;
        return SignalCategory[key];
      }),
    );

    const summary = `${candidate.fullName} presents a sponsorable pattern of ${categoryNames
      .slice(0, 3)
      .join(", ")} built across ${artifacts.length} submitted artifacts. Current readiness is ${readinessScore}/100, with the strongest case anchored in repeat work rather than one-off charisma.`;
    const whyWorthBacking = `The evidence suggests ${candidate.fullName} can convert informal trust into formal responsibility. The most persuasive signals come from grounded work examples and third-party corroboration rather than broad self-claims.`;
    const recommendedNextAction = `Advance ${candidate.fullName} toward a warm sponsor conversation tied to ${opportunityTypes[0] ?? "a scoped sponsorship opportunity"}, with one additional artifact prepared to answer open questions.`;
    const memoMarkdown = [
      `# Sponsor Memo: ${candidate.fullName}`,
      "",
      "## Executive Summary",
      summary,
      "",
      "## Why This Person Is Worth Backing",
      whyWorthBacking,
      "",
      "## Strongest Evidence Signals",
      ...strongestSignals.map((signal) => `- ${signal}`),
      "",
      "## Risks / Open Questions",
      ...risks.map((risk) => `- ${risk}`),
      "",
      "## Best-Fit Opportunity Types",
      ...opportunityTypes.map((item) => `- ${item}`),
      "",
      "## Recommended Next Advocacy Action",
      recommendedNextAction,
    ].join("\n");

    return {
      executiveSummary: summary,
      whyWorthBacking,
      strongestSignals,
      risks,
      bestFitOpportunityTypes: opportunityTypes,
      recommendedNextAction,
      memoMarkdown,
    };
  },

  async recommendNextAdvocacyAction({ candidate, claims, readinessScore }) {
    const sortedClaims = [...claims].sort((left, right) => right.confidence - left.confidence);
    const categories = Array.from(
      new Set(
        sortedClaims.slice(0, 4).map((claim) => {
          const key = claim.category.toUpperCase() as keyof typeof SignalCategory;
          return SignalCategory[key];
        }),
      ),
    );
    const opportunityTypes = inferOpportunityTypes(categories);
    const requiredProof = inferRequiredProof(categories);

    const decision =
      readinessScore >= 72
        ? "advance"
        : readinessScore >= 48
          ? "hold"
          : "do_not_advance";
    const action =
      decision === "advance"
        ? `Prepare a sponsor brief and request a warm introduction tied to ${opportunityTypes[0] ?? "a targeted opportunity"}.`
        : decision === "hold"
          ? "Hold outreach for one cycle, add one stronger proof artifact, and then re-run sponsor targeting."
          : "Do not advance this file externally yet. Rebuild the proof base before sponsor outreach.";

    return {
      decision,
      action,
      rationale: `${candidate.fullName}'s current evidence profile is strongest in ${categories
        .map((category) => titleCase(fromPrismaSignalCategory(category)))
        .slice(0, 3)
        .join(", ")}. The next action should preserve credibility by matching the ask to the proof on hand.`,
      requiredProof,
      whyNotNow:
        decision === "advance"
          ? []
          : [
              "Current evidence is not yet strong enough to justify external advocacy without overstating the case.",
              ...requiredProof.slice(0, 2),
            ],
    };
  },

  async explainSponsorMatch({ candidate, sponsor, claims, matchScore, matchBreakdown, connectionPath }) {
    const dominantSignals = Array.from(
      new Set(
        claims
          .sort((left, right) => right.confidence - left.confidence)
          .slice(0, 3)
          .map((claim) => titleCase(claim.category)),
      ),
    );
    const sponsorTags = [...parseDelimitedList(sponsor.domainExpertise), ...parseDelimitedList(sponsor.interestTags)];
    const missingProof = inferRequiredProof(
      claims.map((claim) => {
        const key = claim.category.toUpperCase() as keyof typeof SignalCategory;
        return SignalCategory[key];
      }),
    );

    return {
      whyFit: `${sponsor.fullName} is a fit because ${candidate.fullName}'s evidence profile overlaps with ${sponsor.organization}'s focus on ${sponsorTags
        .slice(0, 3)
        .join(", ")}, and the sponsor's style favors ${styleSummary(sponsor.sponsorStyle)}.`,
      signalDrivers: dominantSignals,
      connectionPath,
      missingProof,
      scoreSummary: `Match score ${matchScore}/100. Strongest drivers: domain ${matchBreakdown.domainFit}, warm path ${matchBreakdown.warmPathAvailability}, signal profile ${matchBreakdown.signalProfile}.`,
    };
  },
};
