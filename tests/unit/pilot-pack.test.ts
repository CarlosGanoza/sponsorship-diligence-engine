import { buildPilotBuyerPack } from "@/lib/pilot/pack";
import { buildCommercialReadinessModel } from "@/lib/pilot/commercial";
import { buildPilotProofReport } from "@/lib/pilot/report";
import { buildPilotRoiModel, getPilotTemplate } from "@/lib/pilot/templates";
import { buildDefaultPilotProfile, buildPilotLaunchWorkstream } from "@/lib/pilot/workspace";

describe("buildPilotBuyerPack", () => {
  it("turns the measured proof report into a buyer packet model", () => {
    const template = getPilotTemplate("FOUNDATION");
    const pilotProfile = buildDefaultPilotProfile({
      workspaceName: "North Star Foundation",
      template,
    });
    const roiModel = buildPilotRoiModel(template.key, {
      candidateCount: 10,
      memoReadyCount: 6,
      sponsorReadyCount: 4,
      activePipelineCount: 3,
      openAlerts: 2,
      openTasks: 1,
      knownOutcomeCount: 3,
      positiveOutcomeCount: 2,
      disagreementRate: 18,
      blindReviewMode: true,
      strictEvidenceMode: true,
      requireOutboundApproval: true,
    });
    const commercialReadiness = buildCommercialReadinessModel({
      candidateCount: 10,
      memoReadyCount: 6,
      sponsorReadyCount: 4,
      activePipelineCount: 3,
      knownOutcomeCount: 3,
      positiveOutcomeCount: 2,
      openAlerts: 2,
      openTasks: 1,
      checkpointCount: 1,
      hasMeasuredBaseline: true,
      guidedDemoMode: true,
      blindReviewMode: true,
      strictEvidenceMode: true,
      requireOutboundApproval: true,
      healthStatus: "healthy",
    });
    const proofReport = buildPilotProofReport({
      template,
      pilotProfile,
      launchWorkstream: buildPilotLaunchWorkstream(template, undefined),
      currentMetrics: {
        candidateCount: 10,
        memoReadyCount: 6,
        sponsorReadyCount: 4,
        activePipelineCount: 3,
        openAlertsCount: 2,
        openTasksCount: 1,
        knownOutcomeCount: 3,
        positiveOutcomeCount: 2,
        disagreementRate: 18,
        blindReviewMode: true,
        strictEvidenceMode: true,
        requireOutboundApproval: true,
      },
      baseline: {
        snapshotType: "BASELINE",
        capturedAtLabel: "March 1, 2026",
        authorLabel: "Jordan Lee",
        note: null,
        averageReviewMinutes: 45,
        sampledReviewCount: 7,
        memoCoverage: 30,
        sponsorReadyCoverage: 20,
        workflowPressure: 6,
      },
      latestCheckpoint: {
        snapshotType: "CHECKPOINT",
        capturedAtLabel: "March 20, 2026",
        authorLabel: "Jordan Lee",
        note: null,
        averageReviewMinutes: 32,
        sampledReviewCount: 8,
        memoCoverage: 60,
        sponsorReadyCoverage: 40,
        workflowPressure: 3,
      },
      recentSnapshots: [],
      observedDeltas: [
        {
          label: "Memo coverage",
          currentValueLabel: "60%",
          baselineValueLabel: "30%",
          deltaLabel: "+30",
          direction: "improved",
          detail: "Measured share of the slate with a ready sponsor memo.",
        },
      ],
      roiModel,
      commercialReadiness,
      calibrationWorkspace: {
        items: [],
        summary: {
          total: 0,
          readyCount: 0,
          inProgressCount: 0,
          notStartedCount: 0,
          escalatedCount: 0,
          overdueCount: 0,
          completionRate: 0,
          statusLabel: "Not started",
          nextDueAt: null,
          blockers: [],
        },
        overview: {
          watchCount: 0,
          mixedCount: 0,
          wellCalibratedCount: 0,
          needsDataCount: 0,
        },
      },
      healthStatus: "healthy",
    });

    const buyerPack = buildPilotBuyerPack({
      template,
      pilotProfile,
      proofReport,
      commercialReadiness,
      roiModel,
    });

    expect(buyerPack.title).toMatch(/buyer pack/i);
    expect(buyerPack.observedProofHighlights.length).toBeGreaterThan(0);
    expect(buyerPack.modeledEconomicsHighlights.find((item) => item.label === "Modeled labor value")?.value).toContain("$");
    expect(buyerPack.measuredMovementHighlights[0]).toMatchObject({
      label: "Memo coverage",
      deltaLabel: "+30",
    });
  });
});
