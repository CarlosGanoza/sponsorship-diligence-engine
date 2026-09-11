import { buildCommercialReadinessModel } from "@/lib/pilot/commercial";
import { buildPilotObservedDeltaRows } from "@/lib/pilot/measurements";
import { buildPilotProofReport } from "@/lib/pilot/report";
import { buildPilotRoiModel, getPilotTemplate } from "@/lib/pilot/templates";
import { buildDefaultPilotProfile, buildPilotLaunchWorkstream } from "@/lib/pilot/workspace";

describe("buildPilotProofReport", () => {
  it("builds a contained pilot recommendation when observed proof and controls are strong", () => {
    const template = getPilotTemplate("FOUNDATION");
    const pilotProfile = buildDefaultPilotProfile({
      workspaceName: "North Star Foundation",
      template,
    });
    const launchWorkstream = buildPilotLaunchWorkstream(
      template,
      JSON.stringify({
        FOUNDATION: Object.fromEntries(
          template.onboardingChecklist.map((item) => [
            item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
            {
              status: "READY",
            },
          ]),
        ),
      }),
    );
    const currentMetrics = {
      candidateCount: 12,
      memoReadyCount: 7,
      sponsorReadyCount: 4,
      activePipelineCount: 5,
      openAlertsCount: 2,
      openTasksCount: 2,
      knownOutcomeCount: 3,
      positiveOutcomeCount: 2,
      disagreementRate: 18,
      blindReviewMode: true,
      strictEvidenceMode: true,
      requireOutboundApproval: true,
    };
    const baseline = {
      snapshotType: "BASELINE",
      capturedAtLabel: "March 1, 2026",
      authorLabel: "Jordan Lee",
      note: "Captured before launch.",
      averageReviewMinutes: 52,
      sampledReviewCount: 8,
      memoCoverage: 25,
      sponsorReadyCoverage: 17,
      workflowPressure: 9,
    };
    const latestCheckpoint = {
      snapshotType: "CHECKPOINT",
      capturedAtLabel: "March 20, 2026",
      authorLabel: "Jordan Lee",
      note: "Captured after two review cycles.",
      averageReviewMinutes: 34,
      sampledReviewCount: 9,
      memoCoverage: 58,
      sponsorReadyCoverage: 33,
      workflowPressure: 4,
    };
    const roiModel = buildPilotRoiModel(template.key, {
      candidateCount: currentMetrics.candidateCount,
      memoReadyCount: currentMetrics.memoReadyCount,
      sponsorReadyCount: currentMetrics.sponsorReadyCount,
      activePipelineCount: currentMetrics.activePipelineCount,
      openAlerts: currentMetrics.openAlertsCount,
      openTasks: currentMetrics.openTasksCount,
      knownOutcomeCount: currentMetrics.knownOutcomeCount,
      positiveOutcomeCount: currentMetrics.positiveOutcomeCount,
      disagreementRate: currentMetrics.disagreementRate,
      blindReviewMode: currentMetrics.blindReviewMode,
      strictEvidenceMode: currentMetrics.strictEvidenceMode,
      requireOutboundApproval: currentMetrics.requireOutboundApproval,
    });
    const commercialReadiness = buildCommercialReadinessModel({
      candidateCount: currentMetrics.candidateCount,
      memoReadyCount: currentMetrics.memoReadyCount,
      sponsorReadyCount: currentMetrics.sponsorReadyCount,
      activePipelineCount: currentMetrics.activePipelineCount,
      knownOutcomeCount: currentMetrics.knownOutcomeCount,
      positiveOutcomeCount: currentMetrics.positiveOutcomeCount,
      openAlerts: currentMetrics.openAlertsCount,
      openTasks: currentMetrics.openTasksCount,
      checkpointCount: 2,
      hasMeasuredBaseline: true,
      guidedDemoMode: true,
      blindReviewMode: true,
      strictEvidenceMode: true,
      requireOutboundApproval: true,
      healthStatus: "healthy",
    });
    const report = buildPilotProofReport({
      template,
      pilotProfile,
      launchWorkstream,
      currentMetrics,
      baseline,
      latestCheckpoint,
      recentSnapshots: [latestCheckpoint, baseline],
      observedDeltas: buildPilotObservedDeltaRows({
        baseline: {
          candidateCount: 12,
          memoReadyCount: 3,
          sponsorReadyCount: 2,
          openAlertsCount: 4,
          openTasksCount: 5,
          knownOutcomeCount: 1,
          disagreementRate: 22,
        },
        current: currentMetrics,
      }),
      roiModel,
      commercialReadiness,
      calibrationWorkspace: {
        items: [
          {
            reviewerId: "reviewer-1",
            reviewerSlug: "jordan-lee",
            reviewerName: "Jordan Lee",
            comparedFiles: 6,
            knownOutcomeCount: 3,
            alignmentRate: 82,
            disagreementRate: 18,
            optimisticPositiveCount: 0,
            optimisticNegativeCount: 0,
            conservativePositiveCount: 0,
            conservativeNegativeCount: 0,
            calibrationStatus: "well_calibrated",
            recommendation: "Keep the current threshold and revisit after the next checkpoint.",
            defaultOwner: "Program lead",
            currentOwner: "Program lead",
            status: "READY",
            dueAt: null,
            note: null,
            completedAt: null,
            updatedAt: null,
          },
        ],
        summary: {
          total: 1,
          readyCount: 1,
          inProgressCount: 0,
          notStartedCount: 0,
          escalatedCount: 0,
          overdueCount: 0,
          completionRate: 100,
          statusLabel: "Calibration ready",
          nextDueAt: null,
          blockers: [],
        },
        overview: {
          watchCount: 0,
          mixedCount: 0,
          wellCalibratedCount: 1,
          needsDataCount: 0,
        },
      },
      healthStatus: "healthy",
      generatedAt: new Date("2026-03-24T10:00:00.000Z"),
    });

    expect(report.recommendationLabel).toMatch(/contained design-partner pilot/i);
    expect(report.currentSnapshot.find((item) => item.label === "Commercial readiness")?.value).toBe(
      `${commercialReadiness.score}/100`,
    );
    expect(report.goNoGoCriteria.every((item) => item.status === "ready")).toBe(true);
    expect(report.observedProof.join(" ")).toContain("measured baseline");
    expect(report.modeledAssumptions).toContain(
      "These numbers are modeled planning assumptions, not observed financial outcomes.",
    );
  });

  it("blocks an external pilot recommendation when proof is thin", () => {
    const template = getPilotTemplate("FOUNDATION");
    const report = buildPilotProofReport({
      template,
      pilotProfile: buildDefaultPilotProfile({
        workspaceName: "North Star Foundation",
        template,
      }),
      launchWorkstream: buildPilotLaunchWorkstream(template, undefined),
      currentMetrics: {
        candidateCount: 4,
        memoReadyCount: 1,
        sponsorReadyCount: 0,
        activePipelineCount: 0,
        openAlertsCount: 7,
        openTasksCount: 8,
        knownOutcomeCount: 0,
        positiveOutcomeCount: 0,
        disagreementRate: 31,
        blindReviewMode: false,
        strictEvidenceMode: false,
        requireOutboundApproval: false,
      },
      baseline: null,
      latestCheckpoint: null,
      recentSnapshots: [],
      observedDeltas: [],
      roiModel: buildPilotRoiModel(template.key, {
        candidateCount: 4,
        memoReadyCount: 1,
        sponsorReadyCount: 0,
        activePipelineCount: 0,
        openAlerts: 7,
        openTasks: 8,
        knownOutcomeCount: 0,
        positiveOutcomeCount: 0,
        disagreementRate: 31,
        blindReviewMode: false,
        strictEvidenceMode: false,
        requireOutboundApproval: false,
      }),
      commercialReadiness: buildCommercialReadinessModel({
        candidateCount: 4,
        memoReadyCount: 1,
        sponsorReadyCount: 0,
        activePipelineCount: 0,
        knownOutcomeCount: 0,
        positiveOutcomeCount: 0,
        openAlerts: 7,
        openTasks: 8,
        checkpointCount: 0,
        hasMeasuredBaseline: false,
        guidedDemoMode: false,
        blindReviewMode: false,
        strictEvidenceMode: false,
        requireOutboundApproval: false,
        healthStatus: "degraded",
      }),
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
          blockers: ["Reviewer calibration has not started."],
        },
        overview: {
          watchCount: 0,
          mixedCount: 0,
          wellCalibratedCount: 0,
          needsDataCount: 0,
        },
      },
      healthStatus: "degraded",
      generatedAt: new Date("2026-03-24T10:00:00.000Z"),
    });

    expect(report.recommendationLabel).toMatch(/not ready/i);
    expect(report.goNoGoCriteria.some((item) => item.status === "blocked")).toBe(true);
    expect(report.risks.length).toBeGreaterThan(0);
  });
});
