import { CandidateStage, MemoStatus, type CandidateProgressSnapshot } from "@prisma/client";

import { buildCandidateTrajectory } from "@/lib/progress";

function makeSnapshot(
  overrides: Partial<CandidateProgressSnapshot>,
): CandidateProgressSnapshot {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    candidateId: overrides.candidateId ?? "candidate-1",
    label: overrides.label ?? "Snapshot",
    summary: overrides.summary ?? "Summary",
    stage: overrides.stage ?? CandidateStage.REVIEW,
    readinessScore: overrides.readinessScore ?? 40,
    topSponsorMatchScore: overrides.topSponsorMatchScore ?? 45,
    artifactCount: overrides.artifactCount ?? 2,
    evidenceClaimCount: overrides.evidenceClaimCount ?? 4,
    highSignalClaimCount: overrides.highSignalClaimCount ?? 2,
    approvedItemCount: overrides.approvedItemCount ?? 0,
    flaggedItemCount: overrides.flaggedItemCount ?? 0,
    relationshipEdgeCount: overrides.relationshipEdgeCount ?? 1,
    memoStatus: overrides.memoStatus ?? MemoStatus.NOT_STARTED,
    capturedAt: overrides.capturedAt ?? new Date("2026-01-01T00:00:00.000Z"),
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("candidate progress trajectory", () => {
  it("summarizes readiness movement across snapshots", () => {
    const trajectory = buildCandidateTrajectory([
      makeSnapshot({
        id: "snap-1",
        label: "Initial intake",
        stage: CandidateStage.INTAKE,
        readinessScore: 29,
        topSponsorMatchScore: 18,
        artifactCount: 1,
        evidenceClaimCount: 0,
        highSignalClaimCount: 0,
        capturedAt: new Date("2026-01-10T00:00:00.000Z"),
      }),
      makeSnapshot({
        id: "snap-2",
        label: "Evidence pack expanded",
        stage: CandidateStage.REVIEW,
        readinessScore: 47,
        topSponsorMatchScore: 39,
        artifactCount: 2,
        evidenceClaimCount: 5,
        highSignalClaimCount: 2,
        capturedAt: new Date("2026-02-10T00:00:00.000Z"),
      }),
      makeSnapshot({
        id: "snap-3",
        label: "Current file state",
        stage: CandidateStage.MEMO_READY,
        readinessScore: 61,
        topSponsorMatchScore: 57,
        artifactCount: 3,
        evidenceClaimCount: 8,
        highSignalClaimCount: 4,
        approvedItemCount: 2,
        memoStatus: MemoStatus.READY,
        capturedAt: new Date("2026-03-10T00:00:00.000Z"),
      }),
    ]);

    expect(trajectory.hasSnapshots).toBe(true);
    expect(trajectory.deltaFromStart).toBe(32);
    expect(trajectory.deltaFromPrevious).toBe(14);
    expect(trajectory.claimDelta).toBe(8);
    expect(trajectory.stageChanged).toBe(true);
    expect(trajectory.momentum).toBe("accelerating");
  });

  it("marks trajectories with flagged items as needing attention", () => {
    const trajectory = buildCandidateTrajectory([
      makeSnapshot({
        id: "snap-1",
        readinessScore: 52,
        flaggedItemCount: 0,
        capturedAt: new Date("2026-02-01T00:00:00.000Z"),
      }),
      makeSnapshot({
        id: "snap-2",
        readinessScore: 54,
        flaggedItemCount: 1,
        capturedAt: new Date("2026-03-01T00:00:00.000Z"),
      }),
    ]);

    expect(trajectory.deltaFromPrevious).toBe(2);
    expect(trajectory.momentum).toBe("needs_attention");
  });
});
