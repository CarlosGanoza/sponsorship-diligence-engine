import { clampNumber } from "@/lib/utils/format";

export type CommercialReadinessInput = {
  candidateCount: number;
  memoReadyCount: number;
  sponsorReadyCount: number;
  activePipelineCount: number;
  knownOutcomeCount: number;
  positiveOutcomeCount: number;
  openAlerts: number;
  openTasks: number;
  checkpointCount: number;
  hasMeasuredBaseline: boolean;
  guidedDemoMode: boolean;
  blindReviewMode: boolean;
  strictEvidenceMode: boolean;
  requireOutboundApproval: boolean;
  healthStatus: "healthy" | "degraded" | "unhealthy";
};

type CommercialReadinessBreakdown = {
  label: string;
  score: number;
  maxScore: number;
  detail: string;
};

export type CommercialReadinessModel = {
  score: number;
  stageLabel: string;
  breakdown: CommercialReadinessBreakdown[];
  gaps: string[];
  nextMoves: string[];
};

function scorePackaging(input: CommercialReadinessInput) {
  let score = 0;

  if (input.guidedDemoMode) {
    score += 8;
  }

  if (input.candidateCount >= 8) {
    score += 6;
  } else if (input.candidateCount >= 4) {
    score += 3;
  }

  if (input.memoReadyCount >= 4) {
    score += 6;
  } else if (input.memoReadyCount >= 2) {
    score += 3;
  }

  return clampNumber(score, 0, 20);
}

function scoreGovernance(input: CommercialReadinessInput) {
  let score = 0;

  if (input.blindReviewMode) {
    score += 7;
  }

  if (input.strictEvidenceMode) {
    score += 8;
  }

  if (input.requireOutboundApproval) {
    score += 6;
  }

  if (input.healthStatus === "healthy") {
    score += 4;
  } else if (input.healthStatus === "degraded") {
    score += 2;
  }

  return clampNumber(score, 0, 25);
}

function scoreOperatingProof(input: CommercialReadinessInput) {
  let score = 0;

  score += Math.min(input.sponsorReadyCount, 5) * 2;
  score += Math.min(input.activePipelineCount, 5);
  score += Math.min(input.knownOutcomeCount, 5) * 2;

  return clampNumber(score, 0, 25);
}

function scoreMeasuredLearning(input: CommercialReadinessInput) {
  let score = 0;

  if (input.hasMeasuredBaseline) {
    score += 6;
  }

  score += Math.min(input.checkpointCount, 3) * 3;

  return clampNumber(score, 0, 15);
}

function scoreBuyerSignal(input: CommercialReadinessInput) {
  let score = 0;

  if (input.knownOutcomeCount > 0) {
    score += Math.min(input.positiveOutcomeCount, 4) * 2;
  }

  const workflowPressure = input.openAlerts + input.openTasks;
  if (workflowPressure <= 6) {
    score += 7;
  } else if (workflowPressure <= 12) {
    score += 4;
  } else if (workflowPressure <= 18) {
    score += 2;
  }

  return clampNumber(score, 0, 15);
}

function describeStage(score: number) {
  if (score >= 80) {
    return "Repeatable commercial motion";
  }

  if (score >= 60) {
    return "Live pilot proof building";
  }

  if (score >= 40) {
    return "Design-partner ready";
  }

  return "Internal prototype";
}

export function buildCommercialReadinessModel(input: CommercialReadinessInput): CommercialReadinessModel {
  const packaging = scorePackaging(input);
  const governance = scoreGovernance(input);
  const operatingProof = scoreOperatingProof(input);
  const measuredLearning = scoreMeasuredLearning(input);
  const buyerSignal = scoreBuyerSignal(input);

  const breakdown: CommercialReadinessBreakdown[] = [
    {
      label: "Buyer packaging",
      score: packaging,
      maxScore: 20,
      detail: "Guided demo posture, sufficient live slate breadth, and enough ready memos to support a serious buyer walkthrough.",
    },
    {
      label: "Governance readiness",
      score: governance,
      maxScore: 25,
      detail: "Blind review, strict evidence, outbound approval, and runtime health make the pilot safer to trust.",
    },
    {
      label: "Operating proof",
      score: operatingProof,
      maxScore: 25,
      detail: "Sponsor-ready files, active paths, and known outcomes give the product more than a hypothetical story.",
    },
    {
      label: "Measured learning",
      score: measuredLearning,
      maxScore: 15,
      detail: "Baselines and checkpoints turn the pilot from a demo into something that can show movement over time.",
    },
    {
      label: "Buyer signal",
      score: buyerSignal,
      maxScore: 15,
      detail: "Observed positive outcomes and manageable workflow pressure make the commercial story more credible.",
    },
  ];

  const score = breakdown.reduce((sum, item) => sum + item.score, 0);
  const gaps: string[] = [];

  if (!input.guidedDemoMode) {
    gaps.push("Enable guided demo mode so buyer walkthroughs are more deliberate.");
  }

  if (input.memoReadyCount < 4) {
    gaps.push("Increase the number of memo-ready files so the buyer story is not leaning on one or two examples.");
  }

  if (!input.hasMeasuredBaseline) {
    gaps.push("Capture a measured baseline so pilot claims can move from modeled to observed.");
  }

  if (input.knownOutcomeCount < 2) {
    gaps.push("Log more real sponsor outcomes so the product can talk about result quality, not only workflow quality.");
  }

  if (!input.strictEvidenceMode || !input.requireOutboundApproval) {
    gaps.push("Keep evidence and outbound controls visibly on before treating the workspace as a live design-partner pilot.");
  }

  if (input.healthStatus !== "healthy") {
    gaps.push("Resolve degraded runtime health so the pilot feels operationally credible.");
  }

  const nextMoves = [
    input.knownOutcomeCount < 2
      ? "Use the next live pilot to record one clear sponsor movement and one explicit hold."
      : "Package the strongest observed sponsor outcomes into the pilot brief and ROI narrative.",
    input.hasMeasuredBaseline
      ? "Capture a fresh checkpoint after the next review cycle so buyer conversations can reference observed movement."
      : "Capture the first pilot baseline before the next design-partner conversation.",
    input.openAlerts + input.openTasks > 12
      ? "Reduce visible workflow pressure so the product story emphasizes control rather than operational spill."
      : "Keep workflow pressure low enough that buyers see the product as disciplined, not overloaded.",
  ];

  return {
    score,
    stageLabel: describeStage(score),
    breakdown,
    gaps,
    nextMoves,
  };
}
