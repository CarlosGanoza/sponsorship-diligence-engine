import {
  SponsorActivityStatus,
  SponsorActivityType,
  SponsorPipelineStage,
} from "@prisma/client";

import { getPipelineStageFromActivity, maxPipelineStage } from "@/lib/workflow/pipeline";

describe("sponsor pipeline workflow", () => {
  it("keeps the furthest stage when asked to move backward", () => {
    expect(
      maxPipelineStage(SponsorPipelineStage.MEETING_SCHEDULED, SponsorPipelineStage.BRIEF_READY),
    ).toBe(SponsorPipelineStage.MEETING_SCHEDULED);
  });

  it("maps blocked sponsor activity to a passed pipeline outcome", () => {
    expect(
      getPipelineStageFromActivity(
        SponsorActivityType.INTRO_REQUESTED,
        SponsorActivityStatus.BLOCKED,
      ),
    ).toBe(SponsorPipelineStage.PASSED);
  });

  it("maps follow-up and outcome events to later pipeline stages", () => {
    expect(
      getPipelineStageFromActivity(
        SponsorActivityType.FOLLOW_UP_SENT,
        SponsorActivityStatus.COMPLETED,
      ),
    ).toBe(SponsorPipelineStage.ADVOCATING);

    expect(
      getPipelineStageFromActivity(
        SponsorActivityType.OUTCOME_RECORDED,
        SponsorActivityStatus.COMPLETED,
      ),
    ).toBe(SponsorPipelineStage.CLOSED);
  });
});
