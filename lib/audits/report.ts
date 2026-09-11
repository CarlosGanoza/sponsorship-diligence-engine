import {
  DecisionType,
  DisagreementDirection as PrismaDisagreementDirection,
  UnderwritingDecision as PrismaUnderwritingDecision,
  type Artifact,
  type Candidate,
  type CandidateDecision,
  type CandidateStage,
  type EvidenceClaim,
  type MemoStatus,
  type Recommendation,
} from "@prisma/client";

import type { ReviewSummaryStatus } from "@/lib/review";
import { buildCandidateSafetyReport } from "@/lib/safety/guardrails";

export type UnderwritingDecision = "advance" | "hold" | "do_not_advance";
export type DecisionDisagreementDirection =
  | "aligned"
  | "human_more_optimistic"
  | "system_more_optimistic"
  | "no_human_decision";

export type AuditDecisionRecord = Pick<
  CandidateDecision,
  "id" | "decisionType" | "summary" | "rationale" | "createdAt"
> & {
  decidedBy?: { id?: string | null; name: string | null } | null;
};

export type DecisionAuditInput = {
  candidate: Candidate;
  displayName: string;
  displayHeadline: string;
  displayRegion: string;
  artifacts: Artifact[];
  claims: EvidenceClaim[];
  recommendations: Recommendation[];
  candidateDecisions: AuditDecisionRecord[];
  readinessScore: number;
  reviewState: ReviewSummaryStatus;
  memoStatus: MemoStatus | null;
  memo?: {
    executiveSummary: string;
    whyWorthBacking: string;
    recommendedNextAction: string;
  } | null;
  candidateUpdates?: Array<{
    title: string;
    summary: string;
  }>;
  operatorNotes?: Array<{
    title?: string | null;
    content: string;
  }>;
  additionalNarratives?: Array<{
    label: string;
    text: string;
  }>;
};

export type DecisionAuditRow = {
  candidateId: string;
  displayName: string;
  displayHeadline: string;
  displayRegion: string;
  actualRegion: string;
  stage: CandidateStage;
  reviewState: ReviewSummaryStatus;
  readinessScore: number;
  artifactCount: number;
  claimCount: number;
  evidenceDepth: string;
  thirdPartyArtifactCount: number;
  supportCoverage: number;
  missingProofCount: number;
  cautionFlagCount: number;
  memoStatus: MemoStatus | null;
  systemDecision: UnderwritingDecision;
  systemRationale: string;
  humanDecision: UnderwritingDecision | null;
  humanDecisionSummary: string | null;
  humanDecisionRationale: string | null;
  humanDecidedById: string | null;
  humanDecidedByName: string | null;
  humanDecisionAt: Date | null;
  disagreementDirection: DecisionDisagreementDirection;
  hasDisagreement: boolean;
};

export type DecisionAuditSummary = {
  totalCandidates: number;
  comparedCandidates: number;
  alignedCount: number;
  disagreementCount: number;
  noHumanDecisionCount: number;
  humanMoreOptimisticCount: number;
  systemMoreOptimisticCount: number;
  disagreementRate: number;
  humanDecisionCoverage: number;
};

export type DecisionPatternRow = {
  label: string;
  totalCandidates: number;
  comparedCandidates: number;
  alignedCount: number;
  disagreementCount: number;
  disagreementRate: number;
  noHumanDecisionCount: number;
  systemAdvance: number;
  systemHold: number;
  systemDoNotAdvance: number;
  humanAdvance: number;
  humanHold: number;
  humanDoNotAdvance: number;
  averageReadinessScore: number;
};

function decisionOrder(decision: UnderwritingDecision) {
  if (decision === "advance") {
    return 2;
  }

  if (decision === "hold") {
    return 1;
  }

  return 0;
}

export function toUnderwritingDecision(decisionType: DecisionType): UnderwritingDecision | null {
  if (decisionType === DecisionType.ADVANCE) {
    return "advance";
  }

  if (decisionType === DecisionType.HOLD || decisionType === DecisionType.NEED_MORE_PROOF) {
    return "hold";
  }

  if (decisionType === DecisionType.DO_NOT_ADVANCE) {
    return "do_not_advance";
  }

  return null;
}

export function toPrismaUnderwritingDecision(decision: UnderwritingDecision): PrismaUnderwritingDecision {
  if (decision === "advance") {
    return PrismaUnderwritingDecision.ADVANCE;
  }

  if (decision === "hold") {
    return PrismaUnderwritingDecision.HOLD;
  }

  return PrismaUnderwritingDecision.DO_NOT_ADVANCE;
}

export function toPrismaDisagreementDirection(
  direction: Extract<DecisionDisagreementDirection, "human_more_optimistic" | "system_more_optimistic">,
): PrismaDisagreementDirection {
  if (direction === "human_more_optimistic") {
    return PrismaDisagreementDirection.HUMAN_MORE_OPTIMISTIC;
  }

  return PrismaDisagreementDirection.SYSTEM_MORE_OPTIMISTIC;
}

export function mapUnderwritingDecisionToDecisionType(
  decision: UnderwritingDecision,
  mode: "direct" | "request_more_proof" = "direct",
) {
  if (decision === "advance") {
    return DecisionType.ADVANCE;
  }

  if (decision === "hold") {
    return mode === "request_more_proof" ? DecisionType.NEED_MORE_PROOF : DecisionType.HOLD;
  }

  return DecisionType.DO_NOT_ADVANCE;
}

function getEvidenceDepthLabel(artifactCount: number) {
  if (artifactCount <= 2) {
    return "Thin proof set";
  }

  if (artifactCount <= 4) {
    return "Developing proof set";
  }

  return "Deep proof set";
}

function buildDisagreementDirection(
  systemDecision: UnderwritingDecision,
  humanDecision: UnderwritingDecision | null,
): DecisionDisagreementDirection {
  if (!humanDecision) {
    return "no_human_decision";
  }

  if (humanDecision === systemDecision) {
    return "aligned";
  }

  if (decisionOrder(humanDecision) > decisionOrder(systemDecision)) {
    return "human_more_optimistic";
  }

  return "system_more_optimistic";
}

function compareDecisionRows(left: DecisionAuditRow, right: DecisionAuditRow) {
  const rank = {
    human_more_optimistic: 0,
    system_more_optimistic: 1,
    no_human_decision: 2,
    aligned: 3,
  } satisfies Record<DecisionDisagreementDirection, number>;

  const rankDiff = rank[left.disagreementDirection] - rank[right.disagreementDirection];

  if (rankDiff !== 0) {
    return rankDiff;
  }

  if (left.humanDecisionAt && right.humanDecisionAt) {
    return right.humanDecisionAt.getTime() - left.humanDecisionAt.getTime();
  }

  return right.readinessScore - left.readinessScore;
}

function buildPatternRows(
  rows: DecisionAuditRow[],
  labelForRow: (row: DecisionAuditRow) => string,
  preferredOrder?: string[],
) {
  const grouped = new Map<string, DecisionAuditRow[]>();

  for (const row of rows) {
    const label = labelForRow(row);
    const existing = grouped.get(label) ?? [];
    existing.push(row);
    grouped.set(label, existing);
  }

  const orderIndex = new Map((preferredOrder ?? []).map((label, index) => [label, index]));

  return Array.from(grouped.entries())
    .map(([label, bucket]) => {
      const comparedCandidates = bucket.filter((row) => row.humanDecision !== null).length;
      const disagreementCount = bucket.filter((row) => row.hasDisagreement).length;

      return {
        label,
        totalCandidates: bucket.length,
        comparedCandidates,
        alignedCount: bucket.filter((row) => row.disagreementDirection === "aligned").length,
        disagreementCount,
        disagreementRate:
          comparedCandidates === 0 ? 0 : Math.round((disagreementCount / comparedCandidates) * 100),
        noHumanDecisionCount: bucket.filter((row) => row.disagreementDirection === "no_human_decision").length,
        systemAdvance: bucket.filter((row) => row.systemDecision === "advance").length,
        systemHold: bucket.filter((row) => row.systemDecision === "hold").length,
        systemDoNotAdvance: bucket.filter((row) => row.systemDecision === "do_not_advance").length,
        humanAdvance: bucket.filter((row) => row.humanDecision === "advance").length,
        humanHold: bucket.filter((row) => row.humanDecision === "hold").length,
        humanDoNotAdvance: bucket.filter((row) => row.humanDecision === "do_not_advance").length,
        averageReadinessScore: Math.round(
          bucket.reduce((sum, row) => sum + row.readinessScore, 0) / Math.max(bucket.length, 1),
        ),
      };
    })
    .sort((left, right) => {
      const leftPreferred = orderIndex.get(left.label);
      const rightPreferred = orderIndex.get(right.label);

      if (leftPreferred !== undefined || rightPreferred !== undefined) {
        return (leftPreferred ?? Number.MAX_SAFE_INTEGER) - (rightPreferred ?? Number.MAX_SAFE_INTEGER);
      }

      if (right.disagreementRate !== left.disagreementRate) {
        return right.disagreementRate - left.disagreementRate;
      }

      if (right.totalCandidates !== left.totalCandidates) {
        return right.totalCandidates - left.totalCandidates;
      }

      return left.label.localeCompare(right.label);
    });
}

export function formatUnderwritingDecision(decision: UnderwritingDecision | null) {
  if (!decision) {
    return "No human decision";
  }

  return decision.replaceAll("_", " ");
}

export function formatDisagreementDirection(direction: DecisionDisagreementDirection) {
  switch (direction) {
    case "aligned":
      return "Aligned";
    case "human_more_optimistic":
      return "Human more optimistic";
    case "system_more_optimistic":
      return "System more optimistic";
    default:
      return "No human decision";
  }
}

export function createDecisionAuditRow(input: DecisionAuditInput): DecisionAuditRow {
  const safetyReport = buildCandidateSafetyReport({
    candidate: input.candidate,
    artifacts: input.artifacts,
    claims: input.claims,
    recommendations: input.recommendations,
    readinessScore: input.readinessScore,
    memo: input.memo ?? null,
    candidateUpdates: input.candidateUpdates,
    operatorNotes: input.operatorNotes,
    additionalNarratives: input.additionalNarratives,
  });
  const latestHumanDecision =
    input.candidateDecisions.find((decision) => toUnderwritingDecision(decision.decisionType) !== null) ?? null;
  const humanDecision = latestHumanDecision
    ? toUnderwritingDecision(latestHumanDecision.decisionType)
    : null;
  const disagreementDirection = buildDisagreementDirection(safetyReport.decision, humanDecision);

  return {
    candidateId: input.candidate.id,
    displayName: input.displayName,
    displayHeadline: input.displayHeadline,
    displayRegion: input.displayRegion,
    actualRegion: input.candidate.region,
    stage: input.candidate.currentStage,
    reviewState: input.reviewState,
    readinessScore: input.readinessScore,
    artifactCount: input.artifacts.length,
    claimCount: input.claims.length,
    evidenceDepth: getEvidenceDepthLabel(input.artifacts.length),
    thirdPartyArtifactCount: safetyReport.thirdPartyArtifactCount,
    supportCoverage: safetyReport.supportCoverage,
    missingProofCount: safetyReport.missingProof.length,
    cautionFlagCount: safetyReport.cautionFlags.length,
    memoStatus: input.memoStatus,
    systemDecision: safetyReport.decision,
    systemRationale: safetyReport.rationale,
    humanDecision,
    humanDecisionSummary: latestHumanDecision?.summary ?? null,
    humanDecisionRationale: latestHumanDecision?.rationale ?? null,
    humanDecidedById: latestHumanDecision?.decidedBy?.id ?? null,
    humanDecidedByName: latestHumanDecision?.decidedBy?.name ?? null,
    humanDecisionAt: latestHumanDecision?.createdAt ?? null,
    disagreementDirection,
    hasDisagreement:
      disagreementDirection === "human_more_optimistic" ||
      disagreementDirection === "system_more_optimistic",
  };
}

export function buildDecisionAuditReport(rows: DecisionAuditRow[]) {
  const comparedCandidates = rows.filter((row) => row.humanDecision !== null).length;
  const disagreementCount = rows.filter((row) => row.hasDisagreement).length;

  const summary: DecisionAuditSummary = {
    totalCandidates: rows.length,
    comparedCandidates,
    alignedCount: rows.filter((row) => row.disagreementDirection === "aligned").length,
    disagreementCount,
    noHumanDecisionCount: rows.filter((row) => row.disagreementDirection === "no_human_decision").length,
    humanMoreOptimisticCount: rows.filter((row) => row.disagreementDirection === "human_more_optimistic").length,
    systemMoreOptimisticCount: rows.filter((row) => row.disagreementDirection === "system_more_optimistic").length,
    disagreementRate:
      comparedCandidates === 0 ? 0 : Math.round((disagreementCount / comparedCandidates) * 100),
    humanDecisionCoverage:
      rows.length === 0 ? 0 : Math.round((comparedCandidates / rows.length) * 100),
  };

  return {
    summary,
    rows: rows.slice().sort(compareDecisionRows),
    patternBreakdowns: {
      stage: buildPatternRows(rows, (row) => row.stage.replaceAll("_", " "), [
        "INTAKE",
        "REVIEW",
        "MEMO READY",
        "SPONSOR OUTREACH",
        "HOLD",
      ]),
      region: buildPatternRows(rows, (row) => row.actualRegion || "Unknown"),
      evidenceDepth: buildPatternRows(rows, (row) => row.evidenceDepth, [
        "Thin proof set",
        "Developing proof set",
        "Deep proof set",
      ]),
      reviewState: buildPatternRows(rows, (row) => row.reviewState.replaceAll("_", " ")),
    },
    caveats: [
      "This report is descriptive pattern reporting, not proof that the process is fair or unbiased.",
      "Region and workflow buckets can surface concentration patterns, but they do not substitute for a real fairness evaluation.",
      "Blind review can reduce identity cues during operator review, but it does not eliminate judgment bias or downstream process effects.",
    ],
  };
}
