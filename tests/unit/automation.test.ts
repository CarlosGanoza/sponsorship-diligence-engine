import { CandidateStage } from "@prisma/client";

import { computeAutomationDecision } from "@/lib/automation";

describe("stage automation", () => {
  it("moves strong files with live sponsor paths into sponsor outreach", () => {
    const decision = computeAutomationDecision({
      artifactsCount: 3,
      claimsCount: 8,
      readinessScore: 78,
      reviewFlagged: 0,
      hasPriorSnapshot: true,
      trajectoryMomentum: "building",
      trajectoryDelta: 6,
      latestArtifactCount: 3,
      previousArtifactCount: 3,
      latestClaimCount: 8,
      previousClaimCount: 7,
      hasReadyMemo: true,
      hasReadyBrief: true,
      topSponsorMatchScore: 72,
      hasActiveSponsorPath: true,
    });

    expect(decision.stage).toBe(CandidateStage.SPONSOR_OUTREACH);
  });

  it("holds files with flagged review blockers and stalled evidence", () => {
    const decision = computeAutomationDecision({
      artifactsCount: 3,
      claimsCount: 6,
      readinessScore: 52,
      reviewFlagged: 1,
      hasPriorSnapshot: true,
      trajectoryMomentum: "needs_attention",
      trajectoryDelta: 0,
      latestArtifactCount: 3,
      previousArtifactCount: 3,
      latestClaimCount: 6,
      previousClaimCount: 6,
      hasReadyMemo: false,
      hasReadyBrief: false,
      topSponsorMatchScore: 48,
      hasActiveSponsorPath: false,
    });

    expect(decision.stage).toBe(CandidateStage.HOLD);
  });

  it("keeps incomplete files in intake", () => {
    const decision = computeAutomationDecision({
      artifactsCount: 1,
      claimsCount: 1,
      readinessScore: 24,
      reviewFlagged: 0,
      hasPriorSnapshot: false,
      trajectoryMomentum: "steady",
      trajectoryDelta: 0,
      latestArtifactCount: 1,
      previousArtifactCount: 1,
      latestClaimCount: 1,
      previousClaimCount: 1,
      hasReadyMemo: false,
      hasReadyBrief: false,
      topSponsorMatchScore: 12,
      hasActiveSponsorPath: false,
    });

    expect(decision.stage).toBe(CandidateStage.INTAKE);
  });

  it("does not treat a new file as stalled without a prior snapshot", () => {
    const decision = computeAutomationDecision({
      artifactsCount: 3,
      claimsCount: 5,
      readinessScore: 54,
      reviewFlagged: 1,
      hasPriorSnapshot: false,
      trajectoryMomentum: "steady",
      trajectoryDelta: 0,
      latestArtifactCount: 3,
      previousArtifactCount: 3,
      latestClaimCount: 5,
      previousClaimCount: 5,
      hasReadyMemo: false,
      hasReadyBrief: false,
      topSponsorMatchScore: 38,
      hasActiveSponsorPath: false,
    });

    expect(decision.stage).toBe(CandidateStage.REVIEW);
    expect(decision.stalledTrajectory).toBe(false);
  });
});
