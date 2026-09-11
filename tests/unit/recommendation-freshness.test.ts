import { ProofRequestStatus, RecommendationType } from "@prisma/client";

import {
  buildRecommendationFreshnessReport,
  summarizeRecommendationFreshness,
} from "@/lib/recommendations/freshness";

describe("recommendation freshness", () => {
  it("keeps a recommendation fresh when nothing meaningful changed", () => {
    const updatedAt = new Date("2026-03-01T10:00:00.000Z");
    const report = buildRecommendationFreshnessReport({
      recommendation: {
        score: 78,
        updatedAt,
        recommendationType: RecommendationType.BEST_SPONSOR,
      },
      currentScore: 80,
      currentRightNowLabel: "Ready now",
      candidate: {
        updatedAt: new Date("2026-02-27T10:00:00.000Z"),
      },
      sponsor: {
        updatedAt: new Date("2026-02-28T10:00:00.000Z"),
      },
    });

    expect(report.severity).toBe("fresh");
    expect(report.label).toBe("Fresh recommendation");
    expect(report.reasons).toHaveLength(0);
  });

  it("moves to watch when evidence changed after generation", () => {
    const report = buildRecommendationFreshnessReport({
      recommendation: {
        score: 72,
        updatedAt: new Date("2026-03-01T10:00:00.000Z"),
        recommendationType: RecommendationType.NEXT_ACTION,
      },
      currentScore: 75,
      currentRightNowLabel: "Promising now",
      candidate: {
        updatedAt: new Date("2026-03-02T10:00:00.000Z"),
      },
      artifacts: [
        {
          updatedAt: new Date("2026-03-02T12:00:00.000Z"),
        },
      ],
    });

    expect(report.severity).toBe("watch");
    expect(report.reasons).toContain("Candidate evidence changed after this recommendation was generated.");
  });

  it("marks a recommendation stale when the sponsor is paused and score drift is high", () => {
    const report = buildRecommendationFreshnessReport({
      recommendation: {
        score: 84,
        updatedAt: new Date("2026-03-01T10:00:00.000Z"),
        recommendationType: RecommendationType.BEST_SPONSOR,
      },
      currentScore: 68,
      currentRightNowLabel: "Paused right now",
      proofRequests: [
        {
          updatedAt: new Date("2026-03-02T08:00:00.000Z"),
          status: ProofRequestStatus.OPEN,
        },
      ],
      sponsorActivities: [
        {
          createdAt: new Date("2026-03-02T09:00:00.000Z"),
          updatedAt: new Date("2026-03-02T09:00:00.000Z"),
        },
      ],
    });

    expect(report.severity).toBe("stale");
    expect(report.label).toBe("Stale recommendation");
    expect(report.scoreDrift).toBe(-16);
    expect(report.reasons).toContain("Current sponsor operating context is paused right now.");
  });

  it("summarizes the worst freshness state across recommendation rows", () => {
    const summary = summarizeRecommendationFreshness([
      {
        isStale: false,
        severity: "fresh",
        label: "Fresh recommendation",
        summary: "Aligned",
        freshnessScore: 96,
        scoreDrift: 1,
        currentScore: 76,
        currentRightNowLabel: "Ready now",
        reasons: [],
      },
      {
        isStale: true,
        severity: "stale",
        label: "Stale recommendation",
        summary: "Review it.",
        freshnessScore: 34,
        scoreDrift: -12,
        currentScore: 61,
        currentRightNowLabel: "Capacity constrained",
        reasons: ["Drift"],
      },
    ]);

    expect(summary.stale).toBe(1);
    expect(summary.label).toBe("Stale recommendation drift");
  });
});
