import { buildCommercialReadinessModel } from "@/lib/pilot/commercial";

describe("commercial readiness modeling", () => {
  it("scores a buyer-ready live pilot higher than an internal prototype", () => {
    const strong = buildCommercialReadinessModel({
      candidateCount: 12,
      memoReadyCount: 7,
      sponsorReadyCount: 5,
      activePipelineCount: 4,
      knownOutcomeCount: 4,
      positiveOutcomeCount: 3,
      openAlerts: 2,
      openTasks: 3,
      checkpointCount: 2,
      hasMeasuredBaseline: true,
      guidedDemoMode: true,
      blindReviewMode: true,
      strictEvidenceMode: true,
      requireOutboundApproval: true,
      healthStatus: "healthy",
    });
    const weak = buildCommercialReadinessModel({
      candidateCount: 3,
      memoReadyCount: 1,
      sponsorReadyCount: 0,
      activePipelineCount: 0,
      knownOutcomeCount: 0,
      positiveOutcomeCount: 0,
      openAlerts: 10,
      openTasks: 9,
      checkpointCount: 0,
      hasMeasuredBaseline: false,
      guidedDemoMode: false,
      blindReviewMode: false,
      strictEvidenceMode: false,
      requireOutboundApproval: false,
      healthStatus: "degraded",
    });

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.stageLabel).toBe("Repeatable commercial motion");
    expect(weak.stageLabel).toBe("Internal prototype");
    expect(weak.gaps.length).toBeGreaterThan(0);
  });
});
