import { getPilotTemplate } from "@/lib/pilot/templates";
import {
  buildReviewerCalibrationWorkspace,
  serializeUpdatedReviewerCalibrationWorkspace,
} from "@/lib/calibration/workspace";

const reviewers = [
  {
    reviewerId: "reviewer-jordan",
    reviewerName: "Jordan Lee",
    comparedFiles: 5,
    alignedCount: 3,
    disagreementCount: 2,
    disagreementRate: 40,
    alignmentRate: 60,
    humanMoreOptimisticCount: 2,
    systemMoreOptimisticCount: 0,
    knownOutcomeCount: 4,
    optimisticPositiveCount: 1,
    optimisticNegativeCount: 2,
    conservativePositiveCount: 0,
    conservativeNegativeCount: 1,
    status: "watch" as const,
    recommendation: "Tighten the proof threshold before sponsor-facing movement.",
  },
  {
    reviewerId: "reviewer-priya",
    reviewerName: "Priya Raman",
    comparedFiles: 4,
    alignedCount: 4,
    disagreementCount: 0,
    disagreementRate: 0,
    alignmentRate: 100,
    humanMoreOptimisticCount: 0,
    systemMoreOptimisticCount: 0,
    knownOutcomeCount: 3,
    optimisticPositiveCount: 0,
    optimisticNegativeCount: 0,
    conservativePositiveCount: 0,
    conservativeNegativeCount: 0,
    status: "well_calibrated" as const,
    recommendation: "Current threshold is holding up against observed sponsor outcomes.",
  },
];

describe("reviewer calibration workspace", () => {
  it("builds persisted reviewer calibration workflow defaults from analytics rows", () => {
    const workspace = buildReviewerCalibrationWorkspace({
      reviewers,
      template: getPilotTemplate("FOUNDATION"),
      rawValue: undefined,
    });

    expect(workspace.summary.total).toBe(2);
    expect(workspace.summary.escalatedCount).toBe(1);
    expect(workspace.summary.readyCount).toBe(1);
    expect(workspace.summary.statusLabel).toBe("Needs calibration work");
    expect(workspace.overview.watchCount).toBe(1);
    expect(workspace.items[0]).toMatchObject({
      reviewerName: "Jordan Lee",
      status: "ESCALATED",
      reviewerSlug: "jordan-lee",
    });
  });

  it("updates reviewer calibration state and preserves ready completion metadata", () => {
    const nextState = serializeUpdatedReviewerCalibrationWorkspace({
      currentValue: JSON.stringify({
        "reviewer-priya": {
          status: "READY",
          owner: "Calibration lead",
          completedAt: "2026-03-01T10:00:00.000Z",
        },
      }),
      reviewerId: "reviewer-jordan",
      update: {
        status: "READY",
        owner: "Jordan Lee",
        dueAt: "2026-04-01",
        note: "Threshold documented and shared with committee reviewers.",
      },
    });

    const workspace = buildReviewerCalibrationWorkspace({
      reviewers,
      template: getPilotTemplate("FOUNDATION"),
      rawValue: nextState,
    });
    const updatedItem = workspace.items.find((item) => item.reviewerId === "reviewer-jordan");

    expect(updatedItem).toMatchObject({
      status: "READY",
      currentOwner: "Jordan Lee",
      dueAt: "2026-04-01",
      note: "Threshold documented and shared with committee reviewers.",
    });
    expect(updatedItem?.completedAt).toBeTruthy();
  });
});
