import { clampNumber, toFixedNumber } from "@/lib/utils/format";
import type { PilotTemplateConfig } from "@/lib/pilot/templates";

export function buildExecutiveRoiModel(input: {
  template: PilotTemplateConfig;
  candidateCount: number;
  sponsorReadyCount: number;
  comparedCandidates: number;
  disagreementRate: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  inProgressOutcomes: number;
  openTasks: number;
  activePipeline: number;
  memoCount: number;
  briefCount: number;
}) {
  const sponsorReadyRate =
    input.candidateCount === 0 ? 0 : Math.round((input.sponsorReadyCount / input.candidateCount) * 100);
  const knownOutcomeCount = input.positiveOutcomes + input.negativeOutcomes;
  const positiveOutcomeRate =
    knownOutcomeCount === 0 ? 0 : Math.round((input.positiveOutcomes / knownOutcomeCount) * 100);
  const auditCoverage =
    input.candidateCount === 0 ? 0 : Math.round((input.comparedCandidates / input.candidateCount) * 100);

  const modeledHoursRecovered = Math.round(
    input.memoCount * 1.2 + input.briefCount * 0.8 + input.activePipeline * 0.35 + input.candidateCount * 0.25,
  );
  const operatingDisciplineScore = clampNumber(
    Math.round(
      100 -
        input.disagreementRate * 0.45 +
        sponsorReadyRate * 0.2 +
        positiveOutcomeRate * 0.15 -
        Math.min(input.openTasks, 20) * 0.8,
    ),
    18,
    96,
  );
  const executiveConfidenceIndex = clampNumber(
    Math.round(auditCoverage * 0.45 + positiveOutcomeRate * 0.35 + sponsorReadyRate * 0.2),
    12,
    94,
  );
  const modeledQuarterlyThroughputLift = clampNumber(
    Math.round(
      ((input.activePipeline + input.inProgressOutcomes + input.sponsorReadyCount) / Math.max(input.candidateCount, 1)) *
        100 *
        0.75,
    ),
    5,
    85,
  );

  return {
    sponsorReadyRate,
    positiveOutcomeRate,
    auditCoverage,
    modeledHoursRecovered,
    operatingDisciplineScore,
    executiveConfidenceIndex,
    modeledQuarterlyThroughputLift,
    assumptions: [
      "Modeled operator-hour recovery assumes memo assembly, packet prep, and sponsor-path coordination take materially longer without structured evidence surfaces.",
      "Confidence and discipline indexes are heuristic composites of audit coverage, disagreement rate, sponsor-ready coverage, and known sponsor outcomes.",
      `Interpret the outputs as pilot economics for a ${input.template.label.toLowerCase()} team, not as guaranteed ROI.`,
    ],
    summary: `For a ${input.template.label.toLowerCase()} pilot, the strongest proof today is not revenue. It is whether the team can produce clearer sponsorship calls, reduce unsupported advocacy, and move more high-conviction files into owned sponsor paths.`,
    executiveQuestions: [
      "Are sponsorship calls getting clearer before executive review meetings?",
      "Are more sponsor-facing asks traceable to real evidence rather than operator memory?",
      "Are high-potential files converting into real sponsor activity faster and with less risk?",
    ],
    templateAngle:
      input.template.key === "FOUNDATION"
        ? "Use the ROI view to frame diligence quality and investment-committee confidence."
        : input.template.key === "FELLOWSHIP"
          ? "Use the ROI view to show how cohort review becomes sponsor allocation, not just selection."
          : input.template.key === "ALUMNI_NETWORK"
            ? "Use the ROI view to show that warm introductions are becoming inspectable network operations."
            : "Use the ROI view to show that stretch-opportunity sponsorship is getting evidence-backed before senior review.",
    ratioRows: [
      {
        label: "Sponsor-ready coverage",
        value: sponsorReadyRate,
        detail: `${input.sponsorReadyCount} of ${input.candidateCount} active files sit in the sponsor-ready tier.`,
      },
      {
        label: "Known positive outcome rate",
        value: positiveOutcomeRate,
        detail:
          knownOutcomeCount === 0
            ? "No sponsor outcomes are recorded yet."
            : `${input.positiveOutcomes} of ${knownOutcomeCount} known sponsor outcomes are positive.`,
      },
      {
        label: "Human decision coverage",
        value: auditCoverage,
        detail: `${input.comparedCandidates} of ${input.candidateCount} files have a logged underwriting call.`,
      },
    ],
    benchmarkRows: [
      {
        label: "Modeled operator hours recovered / quarter",
        value: modeledHoursRecovered,
        detail: "Transparent modeled estimate, grounded in current memo, brief, and sponsor-path volume.",
      },
      {
        label: "Operating discipline score",
        value: operatingDisciplineScore,
        detail: "Composite signal for audit quality, disagreement pressure, and owned sponsor movement.",
      },
      {
        label: "Executive confidence index",
        value: executiveConfidenceIndex,
        detail: "Composite signal for how defensible the sponsorship workflow looks to a senior reviewer.",
      },
      {
        label: "Modeled quarterly throughput lift",
        value: modeledQuarterlyThroughputLift,
        detail: "Heuristic estimate of how much more sponsor-path throughput the current operating model can support.",
      },
    ],
    paybackStatement: `If the pilot team treats recovered operator time as redeployable review capacity rather than cost savings alone, the short-term win is higher-quality sponsorship throughput, not headcount reduction.`,
    pressureTest: toFixedNumber((positiveOutcomeRate + sponsorReadyRate + auditCoverage) / 3, 1),
  };
}
