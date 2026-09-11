import { BriefStatus, OpportunityType, SeniorityLevel, SponsorAvailabilityStatus, SponsorStyle, type Sponsor } from "@prisma/client";

import { buildOutreachPlan, determineOutreachMode } from "@/lib/outreach/plan";

function createSponsor(style: SponsorStyle, warmIntroAvailable = true): Sponsor {
  return {
    id: `sponsor-${style}`,
    organizationId: "org-1",
    fullName: "Nadia Voss",
    title: "Executive Director",
    organization: "Bridgepoint Network",
    domainExpertise: "education|workforce",
    seniorityLevel: SeniorityLevel.EXECUTIVE,
    sponsorStyle: style,
    interestTags: "leadership|talent",
    geography: "United States",
    warmIntroAvailable,
    availabilityStatus: SponsorAvailabilityStatus.OPEN,
    maxConcurrentPaths: 4,
    availabilityNote: null,
    blackoutUntil: null,
    blackoutReason: null,
    bio: "Sponsor bio",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("outreach plans", () => {
  it("uses warm intro mode when a brief is ready and a path exists", () => {
    expect(
      determineOutreachMode({
        briefStatus: BriefStatus.READY,
        connectionPath: ["Candidate -> operator -> sponsor"],
        warmIntroAvailable: true,
      }),
    ).toBe("WARM_INTRO");
  });

  it("uses operator briefing mode when the brief is on hold", () => {
    const plan = buildOutreachPlan({
      brief: {
        title: "Pilot brief",
        opportunityType: OpportunityType.PILOT_PARTNERSHIP,
        status: BriefStatus.HOLD,
        summary: "Turn current evidence into a scoped pilot partnership.",
        whyNow: "The candidate has enough traction to warrant a structured test.",
        sponsorAsk: "Ask for a sponsor-backed pilot conversation.",
        talkingPointsList: ["Strong execution signal."],
        proofToBringList: ["Resume: Led a 12-site pilot."],
        successIndicatorsList: ["Second diligence meeting."],
      },
      candidate: {
        fullName: "Maya Rios",
        headline: "Regional workforce operator",
        region: "Phoenix, AZ",
      },
      sponsor: createSponsor(SponsorStyle.SELECTIVE_DOOR_OPENER),
      connectionPath: ["Candidate -> operator -> sponsor"],
      warmPathNote: "Tighten evidence on cross-region execution.",
      sponsorAngle: "A reliable operator who can translate local proof into broader execution scope.",
      risks: ["Cross-region operating proof is still emerging."],
      matchScore: 81,
    });

    expect(plan.mode).toBe("OPERATOR_BRIEFING");
    expect(plan.cautionNote.toLowerCase()).toContain("pause external outreach");
    expect(plan.followUpDeliverables.join(" ")).toContain("Cross-region operating proof is still emerging.");
  });
});
