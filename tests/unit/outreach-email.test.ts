import { BriefStatus, SeniorityLevel, SponsorAvailabilityStatus, SponsorStyle, type Sponsor } from "@prisma/client";

import { buildEmailDrafts } from "@/lib/outreach/email";

function createSponsor(style: SponsorStyle): Sponsor {
  return {
    id: `sponsor-${style}`,
    organizationId: "org-1",
    fullName: "Avery Stone",
    title: "Managing Director",
    organization: "North Harbor Network",
    domainExpertise: "education|community|public interest",
    seniorityLevel: SeniorityLevel.EXECUTIVE,
    sponsorStyle: style,
    interestTags: "youth|leadership",
    geography: "United States",
    warmIntroAvailable: true,
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

describe("outreach email drafts", () => {
  it("builds warm-intro drafts with connector and sponsor-specific framing", () => {
    const drafts = buildEmailDrafts({
      brief: {
        status: BriefStatus.READY,
        whyNow: "The candidate is ready for a larger platform-level introduction.",
        sponsorAsk: "Ask for one strategic introduction into a regional operator network.",
        summary: "This is a strong operator with clear follow-through.",
        proofToBringList: ["Resume: Led a 12-site operator partnership."],
        talkingPointsList: ["Strong follow-through in multi-site delivery."],
      },
      candidate: {
        fullName: "Maya Rios",
        headline: "Regional workforce operator",
        region: "Phoenix, AZ",
      },
      connectionPath: ["Candidate -> operator -> sponsor"],
      outreachPlan: {
        mode: "WARM_INTRO",
        subjectLine: "Maya Rios · Regional Scale Intro via North Harbor Network",
        meetingGoal: "Secure a sponsor-backed next step.",
        cautionNote: "Lead with cited proof.",
      },
      risks: ["Cross-region execution proof is still developing."],
      sponsor: createSponsor(SponsorStyle.SELECTIVE_DOOR_OPENER),
      warmPathNote: "Route through the operator first.",
    });

    expect(drafts).toHaveLength(3);
    expect(drafts[0]?.label).toContain("Warm intro");
    expect(drafts[0]?.body).toContain("comfortable making a warm introduction");
    expect(drafts[1]?.subject).toContain("Maya Rios");
    expect(drafts[2]?.body).toContain("Thank you for taking the conversation");
  });

  it("turns hold-state outreach into internal-only drafts", () => {
    const drafts = buildEmailDrafts({
      brief: {
        status: BriefStatus.HOLD,
        whyNow: "The candidate is strong but not yet safe for external outreach.",
        sponsorAsk: "Ask for a scoped pilot conversation.",
        summary: "The case needs one more proof artifact before outreach.",
        proofToBringList: ["Project summary: Delivered a high-retention pilot."],
        talkingPointsList: ["Strong implementation signal."],
      },
      candidate: {
        fullName: "Leila Mensah",
        headline: "Workforce operator",
        region: "Atlanta, GA",
      },
      connectionPath: ["Candidate -> mentor -> sponsor"],
      outreachPlan: {
        mode: "OPERATOR_BRIEFING",
        subjectLine: "Leila Mensah · Pilot Partnership via North Harbor Network",
        meetingGoal: "Resolve hold conditions.",
        cautionNote: "Pause external outreach.",
      },
      risks: ["Independent reference depth is still limited."],
      sponsor: createSponsor(SponsorStyle.HANDS_ON),
      warmPathNote: "Tighten the evidence set first.",
    });

    expect(drafts[1]?.label).toContain("Internal hold note");
    expect(drafts[1]?.body).toContain("Reason outreach should stay internal for now");
    expect(drafts[2]?.recipientLabel).toContain("Operator team");
  });
});
