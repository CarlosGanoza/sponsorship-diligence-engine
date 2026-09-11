import type { CommercialReadinessModel } from "@/lib/pilot/commercial";
import type { PilotProofReport } from "@/lib/pilot/report";
import type { PilotTemplateDefinition } from "@/lib/pilot/templates";
import type { PilotProfile } from "@/lib/pilot/workspace";

export type PilotBuyerPackModel = {
  title: string;
  subtitle: string;
  recommendationLabel: string;
  recommendationDetail: string;
  measuredDecision: {
    label: string;
    detail: string;
  };
  observedProofHighlights: string[];
  modeledEconomicsHighlights: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  measuredMovementHighlights: Array<{
    label: string;
    deltaLabel: string;
    detail: string;
  }>;
  goNoGoCriteria: PilotProofReport["goNoGoCriteria"];
  buyerDeliverables: string[];
  buyerObjections: PilotProofReport["buyerPressureTest"];
  nextMoves: string[];
  successMetrics: string[];
};

export function buildPilotBuyerPack(input: {
  template: PilotTemplateDefinition;
  pilotProfile: PilotProfile;
  proofReport: PilotProofReport;
  commercialReadiness: CommercialReadinessModel;
  roiModel: {
    modeled: {
      monthlyHoursRecovered: number;
      monthlyLaborValue: number;
      controlCoverage: number;
      memoCoverage: number;
      sponsorReadyCoverage: number;
      knownOutcomeCoverage: number;
      positiveOutcomeRate: number;
    };
  };
}) {
  const measuredMovementHighlights = input.proofReport.measuredPilot.deltaRows.slice(0, 3).map((row) => ({
    label: row.label,
    deltaLabel: row.deltaLabel,
    detail: `Now ${row.currentValueLabel} versus baseline ${row.baselineValueLabel}. ${row.detail}`,
  }));

  return {
    title: `${input.pilotProfile.pilotName} buyer pack`,
    subtitle: `Prepared for ${input.pilotProfile.designPartnerName} · ${input.template.label}`,
    recommendationLabel: input.proofReport.recommendationLabel,
    recommendationDetail: input.proofReport.recommendationDetail,
    measuredDecision: {
      label: input.commercialReadiness.stageLabel,
      detail:
        input.proofReport.measuredPilot.hasBaseline
          ? "This pack includes measured pilot movement as well as planning assumptions."
          : "This pack includes live workflow proof, but it still needs a measured baseline before it can claim observed pilot movement.",
    },
    observedProofHighlights: input.proofReport.observedProof.slice(0, 5),
    modeledEconomicsHighlights: [
      {
        label: "Hours recovered / month",
        value: String(input.roiModel.modeled.monthlyHoursRecovered),
        detail: "Modeled from the current slate and template assumptions.",
      },
      {
        label: "Modeled labor value",
        value: `$${input.roiModel.modeled.monthlyLaborValue.toLocaleString()}`,
        detail: "Planning number, not a proven savings claim.",
      },
      {
        label: "Control coverage",
        value: `${input.roiModel.modeled.controlCoverage}%`,
        detail: "Share of core pilot controls currently active.",
      },
      {
        label: "Known outcome coverage",
        value: `${input.roiModel.modeled.knownOutcomeCoverage}%`,
        detail: "Share of files with a real sponsor outcome already logged.",
      },
      {
        label: "Positive outcome rate",
        value: `${input.roiModel.modeled.positiveOutcomeRate}%`,
        detail: "Among files where an outcome is already known.",
      },
    ],
    measuredMovementHighlights,
    goNoGoCriteria: input.proofReport.goNoGoCriteria,
    buyerDeliverables: input.template.buyerDeliverables,
    buyerObjections: input.proofReport.buyerPressureTest,
    nextMoves: input.proofReport.nextMoves,
    successMetrics: input.proofReport.successMetrics,
  } satisfies PilotBuyerPackModel;
}

export function buildPilotBuyerPackMarkdown(pack: PilotBuyerPackModel) {
  return [
    `# ${pack.title}`,
    "",
    pack.subtitle,
    "",
    "## Recommendation",
    pack.recommendationLabel,
    "",
    pack.recommendationDetail,
    "",
    "## Measured Decision",
    `- ${pack.measuredDecision.label}`,
    `- ${pack.measuredDecision.detail}`,
    "",
    "## Observed Proof Highlights",
    ...pack.observedProofHighlights.map((item) => `- ${item}`),
    "",
    "## Modeled Economics Highlights",
    ...pack.modeledEconomicsHighlights.map((item) => `- ${item.label}: ${item.value}. ${item.detail}`),
    "",
    "## Measured Movement Highlights",
    ...(pack.measuredMovementHighlights.length > 0
      ? pack.measuredMovementHighlights.map((item) => `- ${item.label}: ${item.deltaLabel}. ${item.detail}`)
      : ["- No measured movement highlights are available yet."]),
    "",
    "## Go Or Hold Criteria",
    ...pack.goNoGoCriteria.map((item) => `- ${item.label}: ${item.status}. ${item.detail}`),
    "",
    "## Buyer Deliverables",
    ...pack.buyerDeliverables.map((item) => `- ${item}`),
    "",
    "## Buyer Objections",
    ...pack.buyerObjections.flatMap((item) => [
      `- Objection: ${item.objection}`,
      `  Response: ${item.response}`,
      `  Proof to show: ${item.proofPoint}`,
    ]),
    "",
    "## Next Moves",
    ...pack.nextMoves.map((item) => `- ${item}`),
    "",
    "## Success Metrics",
    ...pack.successMetrics.map((item) => `- ${item}`),
  ].join("\n");
}
