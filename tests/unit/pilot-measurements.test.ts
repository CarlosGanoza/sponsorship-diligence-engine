import { buildMeasuredReviewTimeDeltaRow, buildPilotObservedDeltaRows } from "@/lib/pilot/measurements";

describe("pilot measurement deltas", () => {
  it("shows measured improvement against a baseline", () => {
    const rows = buildPilotObservedDeltaRows({
      baseline: {
        candidateCount: 10,
        memoReadyCount: 3,
        sponsorReadyCount: 2,
        openAlertsCount: 6,
        openTasksCount: 4,
        knownOutcomeCount: 1,
        disagreementRate: 35,
      },
      current: {
        candidateCount: 10,
        memoReadyCount: 6,
        sponsorReadyCount: 4,
        activePipelineCount: 5,
        openAlertsCount: 3,
        openTasksCount: 2,
        knownOutcomeCount: 4,
        positiveOutcomeCount: 3,
        disagreementRate: 22,
        blindReviewMode: true,
        strictEvidenceMode: true,
        requireOutboundApproval: true,
      },
    });

    expect(rows[0]).toMatchObject({
      label: "Memo coverage",
      currentValueLabel: "60%",
      baselineValueLabel: "30%",
      deltaLabel: "+30",
      direction: "improved",
    });
    expect(rows[3]).toMatchObject({
      label: "Workflow pressure",
      currentValueLabel: "5",
      baselineValueLabel: "10",
      deltaLabel: "-5",
      direction: "improved",
    });
    expect(rows[4]).toMatchObject({
      label: "Disagreement rate",
      currentValueLabel: "22%",
      baselineValueLabel: "35%",
      deltaLabel: "-13",
      direction: "improved",
    });
  });

  it("shows flat movement when the baseline and current state match", () => {
    const rows = buildPilotObservedDeltaRows({
      baseline: {
        candidateCount: 8,
        memoReadyCount: 4,
        sponsorReadyCount: 3,
        openAlertsCount: 2,
        openTasksCount: 2,
        knownOutcomeCount: 2,
        disagreementRate: 20,
      },
      current: {
        candidateCount: 8,
        memoReadyCount: 4,
        sponsorReadyCount: 3,
        activePipelineCount: 4,
        openAlertsCount: 2,
        openTasksCount: 2,
        knownOutcomeCount: 2,
        positiveOutcomeCount: 1,
        disagreementRate: 20,
        blindReviewMode: false,
        strictEvidenceMode: true,
        requireOutboundApproval: true,
      },
    });

    expect(rows.every((row) => row.direction === "flat")).toBe(true);
  });

  it("shows measured review-time improvement when checkpoints include operator timing samples", () => {
    const row = buildMeasuredReviewTimeDeltaRow({
      baseline: {
        averageReviewMinutes: 70,
        sampledReviewCount: 4,
      },
      checkpoint: {
        averageReviewMinutes: 46,
        sampledReviewCount: 6,
      },
    });

    expect(row).toMatchObject({
      label: "Measured review time",
      currentValueLabel: "46 min",
      baselineValueLabel: "70 min",
      deltaLabel: "-24",
      direction: "improved",
    });
  });
});
