import { OpportunityType, SponsorStyle, type Sponsor } from "@prisma/client";

type OpportunityTemplate = {
  type: OpportunityType;
  label: string;
  thesis: string;
  askStyle: string;
  whyNow: string;
  successFrame: string;
};

export const opportunityTemplates: Record<OpportunityType, OpportunityTemplate> = {
  [OpportunityType.STRETCH_ROLE]: {
    type: OpportunityType.STRETCH_ROLE,
    label: "Stretch role brief",
    thesis: "Move the candidate into a larger operating scope with visible ownership and sponsor support.",
    askStyle: "Ask for a scoped operating role, strategic project, or higher-trust responsibility with a clear decision-maker.",
    whyNow: "The candidate has enough evidence to justify a bigger test, but still benefits from a sponsor who can shape the next operating context directly.",
    successFrame: "Success looks like a concrete role expansion, defined responsibility, and a sponsor who stays close enough to observe execution quality.",
  },
  [OpportunityType.REGIONAL_SCALE_INTRO]: {
    type: OpportunityType.REGIONAL_SCALE_INTRO,
    label: "Regional scale introduction",
    thesis: "Use sponsorship to move the candidate from local proof into a broader regional or platform-level network.",
    askStyle: "Ask for one targeted introduction into a larger operator, foundation, or ecosystem leader who can extend the candidate's scale.",
    whyNow: "The evidence already supports more scope; what is missing is a higher-leverage network bridge rather than more basic coaching.",
    successFrame: "Success looks like a high-quality introduction that leads to a second meeting, scoped diligence, or a platform-level opportunity.",
  },
  [OpportunityType.PILOT_PARTNERSHIP]: {
    type: OpportunityType.PILOT_PARTNERSHIP,
    label: "Pilot partnership brief",
    thesis: "Turn current evidence into a sponsor-backed pilot, residency, or implementation partnership.",
    askStyle: "Ask for a structured pilot, sponsored project, or testbed where the candidate can demonstrate execution under sponsorship.",
    whyNow: "The candidate is strongest when tied to real operating work, so the next step should be a sponsor-backed proving ground rather than a vague endorsement.",
    successFrame: "Success looks like a live project with defined outcomes, sponsor visibility, and enough scope to generate the next proof artifact.",
  },
  [OpportunityType.PUBLIC_ADVOCACY]: {
    type: OpportunityType.PUBLIC_ADVOCACY,
    label: "Public advocacy brief",
    thesis: "Position the candidate for a visible endorsement, nomination, or public-facing platform.",
    askStyle: "Ask for a nomination, public introduction, speaker platform, or visible endorsement tied to the sponsor's credibility.",
    whyNow: "The candidate's work and narrative are strong enough to benefit from visible advocacy rather than only private signal sharing.",
    successFrame: "Success looks like a public-facing platform that compounds the candidate's credibility without overextending the current evidence set.",
  },
  [OpportunityType.BOARD_OBSERVER]: {
    type: OpportunityType.BOARD_OBSERVER,
    label: "Board observer path",
    thesis: "Use sponsorship to place the candidate near strategic decision-making without forcing immediate executive accountability.",
    askStyle: "Ask for a board observer, advisory, or strategy-table role that expands strategic context and sponsor proximity.",
    whyNow: "The candidate is ready for higher-level exposure, but the strongest immediate step is strategic access rather than a full public leap.",
    successFrame: "Success looks like recurring access to strategic conversations and a sponsor who can evaluate judgment over time.",
  },
  [OpportunityType.SYSTEMS_RESIDENCY]: {
    type: OpportunityType.SYSTEMS_RESIDENCY,
    label: "Systems residency brief",
    thesis: "Place the candidate into a systems-building role where repeatability, process design, and institutional leverage matter.",
    askStyle: "Ask for a residency, systems role, or cross-functional platform position with room to improve an operating model.",
    whyNow: "The candidate's strongest edge is not only talent but the ability to improve systems and clarify messy workflows.",
    successFrame: "Success looks like ownership over a system, workflow, or platform where the candidate can make durable improvements visible to a sponsor.",
  },
  [OpportunityType.TRUSTED_INTRO]: {
    type: OpportunityType.TRUSTED_INTRO,
    label: "Trusted intro brief",
    thesis: "Use sponsorship for a private, high-trust introduction that depends on discretion and follow-through.",
    askStyle: "Ask for a quiet introduction into a curated network where trust, preparation, and reliability matter more than scale.",
    whyNow: "The candidate is ready for a carefully chosen conversation, but the current case is best carried through a trusted connector rather than broad exposure.",
    successFrame: "Success looks like a private introduction that converts into a second conversation, a scoped diligence request, or a sponsor-backed next step.",
  },
};

export function selectOpportunityType({
  sponsor,
  candidateKeywords,
  hasLeadershipSignal,
}: {
  sponsor: Sponsor;
  candidateKeywords: string[];
  hasLeadershipSignal: boolean;
}) {
  if (sponsor.sponsorStyle === SponsorStyle.PUBLIC_ADVOCATE) {
    return OpportunityType.PUBLIC_ADVOCACY;
  }

  if (sponsor.sponsorStyle === SponsorStyle.SYSTEMS_BUILDER) {
    return OpportunityType.SYSTEMS_RESIDENCY;
  }

  if (sponsor.sponsorStyle === SponsorStyle.QUIET_CONNECTOR) {
    return OpportunityType.TRUSTED_INTRO;
  }

  if (sponsor.sponsorStyle === SponsorStyle.SELECTIVE_DOOR_OPENER) {
    return hasLeadershipSignal ? OpportunityType.REGIONAL_SCALE_INTRO : OpportunityType.BOARD_OBSERVER;
  }

  if (candidateKeywords.some((keyword) => ["climate", "civic", "technology", "policy"].includes(keyword))) {
    return OpportunityType.PILOT_PARTNERSHIP;
  }

  return OpportunityType.STRETCH_ROLE;
}

export function getOpportunityTemplate(type: OpportunityType) {
  return opportunityTemplates[type];
}
