import { ArtifactType, type Artifact, type Candidate, type EvidenceClaim, type Recommendation } from "@prisma/client";

import { detectContactDetails } from "@/lib/privacy/pii";
import { summarizeEvidenceHealth } from "@/lib/scoring/evidence";
import { extractBracketCitations } from "@/lib/utils/strings";

type GuardrailDecision = "advance" | "hold" | "do_not_advance";

type MemoDraft = {
  executiveSummary: string;
  whyWorthBacking: string;
  recommendedNextAction: string;
};

type ContradictionSeverity = "watch" | "blocker";

type ContradictionFinding = {
  summary: string;
  severity: ContradictionSeverity;
};

type NarrativeSection = {
  label: string;
  text: string;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "there",
  "this",
  "to",
  "with",
]);

const COMPLETION_PATTERNS = [
  /\b(completed|delivered|finished|launched|rolled out|implemented|shipped)\b/i,
  /\b(led|owned|managed|built|grew|improved|increased|coordinated)\b/i,
];

const UNCERTAINTY_PATTERNS = [
  /\b(planning|planned|proposal|proposed|draft|drafted|exploring|seeking|aspiring)\b/i,
  /\b(not yet|did not|didn't|unable|paused|unfinished|still trying|still seeking)\b/i,
];

const OWNERSHIP_STRONG_PATTERNS = [
  /\b(i led|led|owned|managed|directed|coordinated|ran|supervised)\b/i,
  /\b(accountable|responsible for|drove implementation|made final call)\b/i,
];

const OWNERSHIP_LIMITED_PATTERNS = [
  /\b(supported|assisted|helped|contributed|observed|shadowed)\b/i,
  /\b(part of a team|alongside others|under supervision)\b/i,
];

const QUANTIFIED_RESULT_PATTERN = /(\d+(?:\.\d+)?\s?(?:%|percent|students|residents|sites|cohorts|weeks|months|partners|pilots|roles|projects))/i;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function splitStatements(value: string) {
  const normalized = value.replace(/([.?!])\s*(\[[^\]]+\])/g, " $2$1");

  return normalized
    .split(/[\n.]+/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length >= 18);
}

function overlapsEnough(statement: string, evidenceTexts: string[]) {
  const statementTokens = new Set(tokenize(statement));

  if (statementTokens.size === 0) {
    return true;
  }

  return evidenceTexts.some((evidenceText) => {
    const evidenceTokens = new Set(tokenize(evidenceText));
    let overlapCount = 0;

    for (const token of statementTokens) {
      if (evidenceTokens.has(token)) {
        overlapCount += 1;
      }
    }

    return overlapCount >= 2;
  });
}

function getEvidenceTexts(artifacts: Artifact[], claims: EvidenceClaim[]) {
  return [
    ...artifacts.map((artifact) => `${artifact.title} ${artifact.rawText}`),
    ...claims.flatMap((claim) => [claim.claim, claim.supportingExcerpt]),
  ];
}

function normalizeCitationKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildEvidenceCitationMap(artifacts: Artifact[]) {
  const citationMap = new Map<string, string[]>();

  for (const artifact of artifacts) {
    const key = normalizeCitationKey(artifact.title);
    const existing = citationMap.get(key) ?? [];
    existing.push(`${artifact.title} ${artifact.rawText}`);
    citationMap.set(key, existing);
  }

  return citationMap;
}

function detectPotentialContradictions(
  artifacts: Artifact[],
  claims: EvidenceClaim[],
  extraEntries: NarrativeSection[] = [],
) {
  const evidenceEntries = [
    ...artifacts.map((artifact) => ({
      label: artifact.title,
      text: artifact.rawText.trim(),
    })),
    ...claims.map((claim) => ({
      label: claim.category.toLowerCase().replaceAll("_", " "),
      text: `${claim.claim}. ${claim.supportingExcerpt}`.trim(),
    })),
    ...extraEntries.map((entry) => ({
      label: entry.label,
      text: entry.text.trim(),
    })),
  ].filter((entry) => entry.text.length >= 24);

  const contradictions: ContradictionFinding[] = [];

  for (let index = 0; index < evidenceEntries.length; index += 1) {
    for (let innerIndex = index + 1; innerIndex < evidenceEntries.length; innerIndex += 1) {
      const left = evidenceEntries[index];
      const right = evidenceEntries[innerIndex];
      const leftTokens = new Set(tokenize(left.text));
      const rightTokens = new Set(tokenize(right.text));
      let overlapCount = 0;

      for (const token of leftTokens) {
        if (rightTokens.has(token)) {
          overlapCount += 1;
        }
      }

      if (overlapCount < 2) {
        continue;
      }

      const leftLooksCompleted = COMPLETION_PATTERNS.some((pattern) => pattern.test(left.text));
      const rightLooksCompleted = COMPLETION_PATTERNS.some((pattern) => pattern.test(right.text));
      const leftLooksUncertain = UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(left.text));
      const rightLooksUncertain = UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(right.text));

      if ((leftLooksCompleted && rightLooksUncertain) || (rightLooksCompleted && leftLooksUncertain)) {
        contradictions.push({
          summary: `${left.label} and ${right.label} may conflict on whether the work is completed or still provisional.`,
          severity: "blocker",
        });
      }

      const leftOwnershipStrong = OWNERSHIP_STRONG_PATTERNS.some((pattern) => pattern.test(left.text));
      const rightOwnershipStrong = OWNERSHIP_STRONG_PATTERNS.some((pattern) => pattern.test(right.text));
      const leftOwnershipLimited = OWNERSHIP_LIMITED_PATTERNS.some((pattern) => pattern.test(left.text));
      const rightOwnershipLimited = OWNERSHIP_LIMITED_PATTERNS.some((pattern) => pattern.test(right.text));

      if ((leftOwnershipStrong && rightOwnershipLimited) || (rightOwnershipStrong && leftOwnershipLimited)) {
        contradictions.push({
          summary: `${left.label} and ${right.label} may conflict on whether the candidate owned the work directly or only contributed in support.`,
          severity: "blocker",
        });
      }

      const leftQuantifiedResult = left.text.match(QUANTIFIED_RESULT_PATTERN)?.[0]?.toLowerCase();
      const rightQuantifiedResult = right.text.match(QUANTIFIED_RESULT_PATTERN)?.[0]?.toLowerCase();

      if (leftQuantifiedResult && rightQuantifiedResult && leftQuantifiedResult !== rightQuantifiedResult) {
        contradictions.push({
          summary: `${left.label} and ${right.label} may describe materially different quantified outcomes for the same work.`,
          severity: "watch",
        });
      }
    }
  }

  return Array.from(
    new Map(contradictions.map((item) => [item.summary, item])).values(),
  ).slice(0, 5);
}

function buildMissingProofSignals(
  artifacts: Artifact[],
  claims: EvidenceClaim[],
  readinessScore: number,
  contradictions: ContradictionFinding[],
) {
  const missingProof = new Set<string>();
  const claimCategories = new Set(claims.map((claim) => claim.category));
  const thirdPartyArtifactCount = artifacts.filter((artifact) =>
    artifact.artifactType === ArtifactType.MENTOR_NOTE ||
    artifact.artifactType === ArtifactType.RECOMMENDATION,
  ).length;
  const quantifiedOutcomeCount = artifacts.filter((artifact) => /\b\d+[%+]?\b/.test(artifact.rawText)).length;
  const evidenceHealth = summarizeEvidenceHealth(artifacts, claims);

  if (artifacts.length < 3) {
    missingProof.add("Add at least one more artifact so the file is not driven by a narrow proof set.");
  }

  if (thirdPartyArtifactCount === 0) {
    missingProof.add("Add third-party corroboration from a mentor, manager, or partner.");
  }

  if (!claimCategories.has("LEADERSHIP")) {
    missingProof.add("Add one clearer example of leadership or ownership over other people or systems.");
  }

  if (!claimCategories.has("FOLLOW_THROUGH")) {
    missingProof.add("Add a closed-loop delivery example with a clear outcome.");
  }

  if (quantifiedOutcomeCount === 0) {
    missingProof.add("Add one more quantified result so the sponsorship case is not purely narrative.");
  }

  if (readinessScore < 55) {
    missingProof.add("The overall proof base is still weak enough that external advocacy would be premature.");
  }

  if (evidenceHealth.staleArtifactCount >= Math.max(1, Math.ceil(artifacts.length / 2))) {
    missingProof.add("Refresh the file with newer proof so the case is not leaning on stale evidence.");
  }

  if (evidenceHealth.duplicateClaimCount > 0) {
    missingProof.add("Consolidate repeated claims so the signal profile is not inflated by duplicated evidence.");
  }

  if (contradictions.length > 0) {
    missingProof.add("Resolve the conflicting evidence before using the file for sponsor-facing advocacy.");
  }

  return Array.from(missingProof).slice(0, 5);
}

function buildCautionFlags({
  artifacts,
  claims,
  recommendations,
  unsupportedStatements,
  citationCoverage,
  uncitedStatementCount,
  invalidCitationCount,
  contradictions,
  evidenceHealth,
  internalContactDetailCount,
  sponsorFacingContactDetailCount,
}: {
  artifacts: Artifact[];
  claims: EvidenceClaim[];
  recommendations: Recommendation[];
  unsupportedStatements: string[];
  citationCoverage: number;
  uncitedStatementCount: number;
  invalidCitationCount: number;
  contradictions: ContradictionFinding[];
  evidenceHealth: ReturnType<typeof summarizeEvidenceHealth>;
  internalContactDetailCount: number;
  sponsorFacingContactDetailCount: number;
}) {
  const flags: string[] = [];
  const flaggedClaims = claims.filter((claim) => claim.reviewStatus === "FLAGGED").length;
  const flaggedRecommendations = recommendations.filter(
    (recommendation) => recommendation.reviewStatus === "FLAGGED",
  ).length;
  const lowConfidenceClaims = claims.filter((claim) => claim.confidence < 0.7).length;

  if (flaggedClaims > 0) {
    flags.push(`${flaggedClaims} evidence claim${flaggedClaims === 1 ? "" : "s"} are flagged for review.`);
  }

  if (flaggedRecommendations > 0) {
    flags.push(
      `${flaggedRecommendations} recommendation${flaggedRecommendations === 1 ? "" : "s"} are flagged for review.`,
    );
  }

  if (unsupportedStatements.length > 0) {
    flags.push(
      `${unsupportedStatements.length} sponsor-facing statement${unsupportedStatements.length === 1 ? "" : "s"} could not be cleanly mapped back to evidence text.`,
    );
  }

  if (uncitedStatementCount > 0) {
    flags.push(
      `${uncitedStatementCount} sponsor-facing statement${uncitedStatementCount === 1 ? " is" : "s are"} still missing explicit artifact citations.`,
    );
  }

  if (invalidCitationCount > 0) {
    flags.push(
      `${invalidCitationCount} citation${invalidCitationCount === 1 ? " does" : "s do"} not resolve to a current artifact title.`,
    );
  }

  if (citationCoverage < 70) {
    flags.push("Sentence-level citation coverage is still too thin for high-trust sponsor-facing use.");
  }

  if (sponsorFacingContactDetailCount > 0) {
    flags.push(
      `${sponsorFacingContactDetailCount} sponsor-facing contact detail${sponsorFacingContactDetailCount === 1 ? " is" : "s are"} still exposed and should be redacted before external use.`,
    );
  } else if (internalContactDetailCount > 0) {
    flags.push(
      `${internalContactDetailCount} internal contact detail${internalContactDetailCount === 1 ? " remains" : "s remain"} in the evidence file. Keep sponsor-facing exports redacted.`,
    );
  }

  if (contradictions.length > 0) {
    flags.push(
      `${contradictions.length} potential evidence contradiction${contradictions.length === 1 ? "" : "s"} should be resolved before outreach.`,
    );
  }

  if (artifacts.length < 3) {
    flags.push("The evidence set is narrow, which increases the risk of over-indexing on one artifact.");
  }

  if (lowConfidenceClaims >= Math.max(2, Math.ceil(claims.length / 2))) {
    flags.push("A large share of the current claims are only moderate-confidence signals.");
  }

  if (evidenceHealth.staleArtifactCount > 0) {
    flags.push(
      `${evidenceHealth.staleArtifactCount} artifact${evidenceHealth.staleArtifactCount === 1 ? "" : "s"} are aging enough that the case may no longer reflect the candidate's latest operating level.`,
    );
  }

  if (evidenceHealth.duplicateClaimCount > 0) {
    flags.push(
      `${evidenceHealth.duplicateClaimCount} claim${evidenceHealth.duplicateClaimCount === 1 ? " looks" : "s look"} duplicative and may overstate signal density.`,
    );
  }

  return flags.slice(0, 5);
}

export function auditNarrativeSupport({
  sections,
  artifacts,
  claims,
}: {
  sections: NarrativeSection[];
  artifacts: Artifact[];
  claims: EvidenceClaim[];
}) {
  const evidenceTexts = getEvidenceTexts(artifacts, claims);
  const evidenceCitationMap = buildEvidenceCitationMap(artifacts);
  const statementRows = sections.flatMap((section) =>
    splitStatements(section.text).map((statement) => {
      const { cleanText, citations } = extractBracketCitations(statement);
      const citedEvidenceTexts = citations.flatMap(
        (citation) => evidenceCitationMap.get(normalizeCitationKey(citation)) ?? [],
      );
      const citationResolved = citations.length > 0 && citedEvidenceTexts.length > 0;
      const supportTexts = citationResolved ? citedEvidenceTexts : evidenceTexts;
      const supported = overlapsEnough(cleanText || statement, supportTexts);

      return {
        sectionLabel: section.label,
        statement,
        cleanStatement: cleanText || statement,
        citations,
        citationResolved,
        supported: citationResolved ? supported : citations.length > 0 ? false : supported,
      };
    }),
  );
  const unsupportedRows = statementRows.filter((row) => !row.supported);
  const uncitedRows = statementRows.filter((row) => row.citations.length === 0);
  const invalidCitationRows = statementRows.filter(
    (row) => row.citations.length > 0 && !row.citationResolved,
  );
  const unsupportedStatements = unsupportedRows.map((row) => row.statement);
  const supportedStatements = statementRows.length - unsupportedStatements.length;
  const supportCoverage =
    statementRows.length === 0 ? 100 : Math.round((supportedStatements / statementRows.length) * 100);
  const citedStatements = statementRows.filter((row) => row.citationResolved).length;
  const citationCoverage =
    statementRows.length === 0 ? 100 : Math.round((citedStatements / statementRows.length) * 100);

  return {
    statements: statementRows.map((row) => row.statement),
    statementRows,
    unsupportedRows,
    uncitedRows,
    invalidCitationRows,
    unsupportedStatements,
    supportedStatements,
    supportCoverage,
    citationCoverage,
    citedStatements,
    uncitedStatementCount: uncitedRows.length,
    invalidCitationCount: invalidCitationRows.length,
  };
}

export function auditMemoSupport({
  memo,
  artifacts,
  claims,
}: {
  memo: MemoDraft;
  artifacts: Artifact[];
  claims: EvidenceClaim[];
}) {
  return auditNarrativeSupport({
    sections: [
      { label: "Executive summary", text: memo.executiveSummary },
      { label: "Why worth backing", text: memo.whyWorthBacking },
      { label: "Recommended next action", text: memo.recommendedNextAction },
    ],
    artifacts,
    claims,
  });
}

export function buildGuardrailDecision(input: {
  candidate: Candidate;
  artifacts: Artifact[];
  claims: EvidenceClaim[];
  recommendations: Recommendation[];
  readinessScore: number;
  contradictions: ContradictionFinding[];
  supportCoverage: number;
  citationCoverage: number;
  unsupportedStatementCount: number;
}) {
  const evidenceHealth = summarizeEvidenceHealth(input.artifacts, input.claims);
  const missingProof = buildMissingProofSignals(
    input.artifacts,
    input.claims,
    input.readinessScore,
    input.contradictions,
  );
  const flaggedClaims = input.claims.filter((claim) => claim.reviewStatus === "FLAGGED").length;
  const flaggedRecommendations = input.recommendations.filter(
    (recommendation) => recommendation.reviewStatus === "FLAGGED",
  ).length;

  const blockerContradictions = input.contradictions.filter((item) => item.severity === "blocker").length;
  let decision: GuardrailDecision = "advance";
  let rationale = "The current evidence base is strong enough to support a targeted sponsor path.";

  if (
    input.readinessScore < 40 ||
    (flaggedClaims + flaggedRecommendations >= 3 && input.artifacts.length < 3) ||
    blockerContradictions >= 1 ||
    (input.contradictions.length >= 2 && input.readinessScore < 55) ||
    (evidenceHealth.staleArtifactCount >= Math.max(2, input.artifacts.length - 1) && input.readinessScore < 60) ||
    input.supportCoverage < 55 ||
    (input.citationCoverage < 20 && input.unsupportedStatementCount > 0) ||
    (input.unsupportedStatementCount >= 3 && input.readinessScore < 70)
  ) {
    decision = "do_not_advance";
    rationale =
      "The current file is too thin or too conflicted to justify external advocacy. Strengthen the proof base before sponsor targeting.";
  } else if (
    input.readinessScore < 68 ||
    flaggedClaims > 0 ||
    flaggedRecommendations > 0 ||
    missingProof.length >= 3 ||
    input.contradictions.length > 0 ||
    evidenceHealth.sourceQualityScore < 5.5 ||
    evidenceHealth.evidenceFreshnessScore < 4.5 ||
    input.supportCoverage < 85 ||
    input.citationCoverage < 60 ||
    input.unsupportedStatementCount > 0
  ) {
    decision = "hold";
    rationale =
      "The case is directionally promising, but the current proof still leaves enough open questions that outreach should wait.";
  }

  return {
    decision,
    rationale,
    missingProof,
  };
}

export function buildCandidateSafetyReport(input: {
  candidate: Candidate;
  artifacts: Artifact[];
  claims: EvidenceClaim[];
  recommendations: Recommendation[];
  readinessScore: number;
  memo?: MemoDraft | null;
  candidateUpdates?: Array<{
    title: string;
    summary: string;
  }>;
  operatorNotes?: Array<{
    title?: string | null;
    content: string;
  }>;
  additionalNarratives?: NarrativeSection[];
}) {
  const supplementalEntries = [
    ...(input.candidateUpdates ?? []).map((update) => ({
      label: `Candidate update · ${update.title}`,
      text: update.summary,
    })),
    ...(input.operatorNotes ?? []).map((note) => ({
      label: note.title?.trim() ? `Operator note · ${note.title.trim()}` : "Operator note",
      text: note.content,
    })),
  ];
  const contradictions = detectPotentialContradictions(input.artifacts, input.claims, supplementalEntries);
  const evidenceHealth = summarizeEvidenceHealth(input.artifacts, input.claims);
  const narrativeSections = [
    ...(input.memo
      ? [
          { label: "Executive summary", text: input.memo.executiveSummary },
          { label: "Why worth backing", text: input.memo.whyWorthBacking },
          { label: "Recommended next action", text: input.memo.recommendedNextAction },
        ]
      : []),
    ...(input.additionalNarratives ?? []),
  ].filter((section) => section.text.trim().length > 0);
  const contactDetails = detectContactDetails([
    ...input.artifacts.map((artifact) => ({
      scope: "internal" as const,
      sourceLabel: artifact.title,
      text: artifact.rawText,
    })),
    ...supplementalEntries.map((entry) => ({
      scope: "internal" as const,
      sourceLabel: entry.label,
      text: entry.text,
    })),
    ...narrativeSections.map((section) => ({
      scope: "sponsor_facing" as const,
      sourceLabel: section.label,
      text: section.text,
    })),
  ]);
  const memoAudit =
    narrativeSections.length > 0
      ? auditNarrativeSupport({
          sections: narrativeSections,
          artifacts: input.artifacts,
          claims: input.claims,
        })
      : {
          statements: [] as string[],
          statementRows: [] as Array<{
            sectionLabel: string;
            statement: string;
            cleanStatement: string;
            citations: string[];
            citationResolved: boolean;
            supported: boolean;
          }>,
          unsupportedRows: [] as Array<{
            sectionLabel: string;
            statement: string;
            cleanStatement: string;
            citations: string[];
            citationResolved: boolean;
            supported: boolean;
          }>,
          uncitedRows: [] as Array<{
            sectionLabel: string;
            statement: string;
            cleanStatement: string;
            citations: string[];
            citationResolved: boolean;
            supported: boolean;
          }>,
          invalidCitationRows: [] as Array<{
            sectionLabel: string;
            statement: string;
            cleanStatement: string;
            citations: string[];
            citationResolved: boolean;
            supported: boolean;
          }>,
          unsupportedStatements: [] as string[],
          supportedStatements: 0,
          supportCoverage: 100,
          citationCoverage: 100,
          citedStatements: 0,
          uncitedStatementCount: 0,
          invalidCitationCount: 0,
        };
  const guardrail = buildGuardrailDecision({
    ...input,
    contradictions,
    supportCoverage: memoAudit.supportCoverage,
    citationCoverage: memoAudit.citationCoverage,
    unsupportedStatementCount: memoAudit.unsupportedStatements.length,
  });
  const missingProof = [
    ...(contactDetails.sponsorFacingFindings.length > 0
      ? ["Redact personal contact details from sponsor-facing language before export or outreach."]
      : []),
    ...guardrail.missingProof,
    ...(memoAudit.supportCoverage < 85
      ? ["Tighten sponsor-facing language so every major statement maps cleanly back to inspectable proof."]
      : []),
    ...(memoAudit.citationCoverage < 70
      ? ["Add explicit artifact citations to sponsor-facing sentences so the narrative stays inspectable sentence by sentence."]
      : []),
  ].slice(0, 5);
  const cautionFlags = buildCautionFlags({
    artifacts: input.artifacts,
    claims: input.claims,
    recommendations: input.recommendations,
    unsupportedStatements: memoAudit.unsupportedStatements,
    citationCoverage: memoAudit.citationCoverage,
    uncitedStatementCount: memoAudit.uncitedStatementCount,
    invalidCitationCount: memoAudit.invalidCitationCount,
    contradictions,
    evidenceHealth,
    internalContactDetailCount: contactDetails.internalFindings.length,
    sponsorFacingContactDetailCount: contactDetails.sponsorFacingFindings.length,
  });
  const thirdPartyArtifactCount = input.artifacts.filter((artifact) =>
    artifact.artifactType === ArtifactType.MENTOR_NOTE ||
    artifact.artifactType === ArtifactType.RECOMMENDATION,
  ).length;

  const blockerContradictions = contradictions.filter((item) => item.severity === "blocker");
  return {
    ...guardrail,
    missingProof,
    cautionFlags,
    potentialContradictions: contradictions.map((item) => item.summary),
    blockingContradictions: blockerContradictions.map((item) => item.summary),
    thirdPartyArtifactCount,
    supportCoverage: memoAudit.supportCoverage,
    citationCoverage: memoAudit.citationCoverage,
    unsupportedStatements: memoAudit.unsupportedStatements.slice(0, 4),
    uncitedStatements: memoAudit.uncitedRows.map((row) => row.statement).slice(0, 4),
    invalidCitations: memoAudit.invalidCitationRows
      .flatMap((row) => row.citations)
      .filter(Boolean)
      .slice(0, 4),
    supportedStatements: memoAudit.supportedStatements,
    citedStatements: memoAudit.citedStatements,
    uncitedStatementCount: memoAudit.uncitedStatementCount,
    invalidCitationCount: memoAudit.invalidCitationCount,
    internalContactDetails: contactDetails.internalSummaries.slice(0, 5),
    sponsorFacingContactDetails: contactDetails.sponsorFacingSummaries.slice(0, 5),
    internalContactDetailCount: contactDetails.internalFindings.length,
    sponsorFacingContactDetailCount: contactDetails.sponsorFacingFindings.length,
    totalStatements: memoAudit.statements.length,
    sourceQualityScore: evidenceHealth.sourceQualityScore,
    evidenceFreshnessScore: evidenceHealth.evidenceFreshnessScore,
    staleArtifactCount: evidenceHealth.staleArtifactCount,
    oldestArtifactAgeDays: evidenceHealth.oldestArtifactAgeDays,
    duplicateClaimCount: evidenceHealth.duplicateClaimCount,
    unsupportedNarrativeGroups: Array.from(new Set(memoAudit.unsupportedRows.map((row) => row.sectionLabel))),
  };
}

export function anonymizeCandidateIdentity(candidate: Pick<Candidate, "id" | "fullName" | "headline" | "region">) {
  const suffix = candidate.id.slice(-4).toUpperCase();

  return {
    displayName: `Candidate ${suffix}`,
    displayHeadline: "Identity masked for blind review.",
    displayRegion: "Region masked",
  };
}
