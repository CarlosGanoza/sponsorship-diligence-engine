import { buildPilotRoiModel, getPilotTemplate, listPilotTemplates } from "@/lib/pilot/templates";

describe("pilot templates and ROI modeling", () => {
  it("falls back to the foundation template for unknown keys", () => {
    expect(getPilotTemplate("UNKNOWN")).toMatchObject({
      key: "FOUNDATION",
      label: "Small foundation",
    });
  });

  it("lists the supported pilot templates", () => {
    expect(listPilotTemplates().map((template) => template.key)).toEqual([
      "FOUNDATION",
      "FELLOWSHIP",
      "ALUMNI_NETWORK",
      "LEADERSHIP_TEAM",
    ]);
  });

  it("ships onboarding, calibration, buyer, and commercial metadata for every template", () => {
    for (const template of listPilotTemplates()) {
      expect(template.onboardingChecklist.length).toBeGreaterThan(0);
      expect(template.stakeholderMap.length).toBeGreaterThan(0);
      expect(template.calibrationPlaybook.length).toBeGreaterThan(0);
      expect(template.buyerDeliverables.length).toBeGreaterThan(0);
      expect(template.designPartnerCommitments.length).toBeGreaterThan(0);
      expect(template.buyerObjections.length).toBeGreaterThan(0);
      expect(template.commercialMilestones.length).toBeGreaterThan(0);
    }
  });

  it("builds an explicit ROI model from template assumptions and current workflow data", () => {
    const model = buildPilotRoiModel("FELLOWSHIP", {
      candidateCount: 10,
      memoReadyCount: 6,
      sponsorReadyCount: 4,
      activePipelineCount: 5,
      openAlerts: 3,
      openTasks: 2,
      knownOutcomeCount: 4,
      positiveOutcomeCount: 3,
      disagreementRate: 25,
      blindReviewMode: true,
      strictEvidenceMode: true,
      requireOutboundApproval: false,
    });

    expect(model.template.key).toBe("FELLOWSHIP");
    expect(model.modeled.activeFiles).toBe(10);
    expect(model.modeled.activePipelineCount).toBe(5);
    expect(model.modeled.hoursRecoveredPerFile).toBe(1.4);
    expect(model.modeled.monthlyHoursRecovered).toBe(14);
    expect(model.modeled.operatorDaysRecovered).toBe(1.9);
    expect(model.modeled.monthlyLaborValue).toBe(1050);
    expect(model.modeled.memoCoverage).toBe(60);
    expect(model.modeled.sponsorReadyCoverage).toBe(40);
    expect(model.modeled.knownOutcomeCoverage).toBe(40);
    expect(model.modeled.positiveOutcomeRate).toBe(75);
    expect(model.modeled.controlCoverage).toBe(67);
    expect(model.modeled.workflowPressure).toBe(5);
    expect(model.assumptions).toHaveLength(4);
  });
});
