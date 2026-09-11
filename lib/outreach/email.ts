import { BriefStatus, type Candidate, type OpportunityBrief, type Sponsor } from "@prisma/client";

import type { OutreachMode } from "@/lib/outreach/plan";

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function joinBullets(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export type EmailDraft = {
  id: string;
  label: string;
  recipientLabel: string;
  purpose: string;
  subject: string;
  body: string;
};

export function buildEmailDrafts({
  candidate,
  sponsor,
  brief,
  outreachPlan,
  connectionPath,
  warmPathNote,
  risks,
}: {
  candidate: Pick<Candidate, "fullName" | "headline" | "region">;
  sponsor: Pick<Sponsor, "fullName" | "organization" | "title" | "warmIntroAvailable">;
  brief: Pick<OpportunityBrief, "status" | "whyNow" | "sponsorAsk" | "summary"> & {
    proofToBringList: string[];
    talkingPointsList: string[];
  };
  outreachPlan: {
    mode: OutreachMode;
    subjectLine: string;
    meetingGoal: string;
    cautionNote: string;
  };
  connectionPath: string[];
  warmPathNote?: string | null;
  risks: string[];
}) {
  const sponsorFirstName = firstName(sponsor.fullName);
  const candidateFirstName = firstName(candidate.fullName);
  const evidenceBullets = joinBullets(brief.proofToBringList.slice(0, 3));
  const talkingPoints = joinBullets(brief.talkingPointsList.slice(0, 3));
  const riskNote = risks[0] ?? warmPathNote ?? "No material unresolved risk is currently recorded beyond the normal diligence questions.";
  const warmPathSummary = connectionPath.join(" -> ");
  const holdLanguage =
    brief.status === BriefStatus.HOLD
      ? "\n\nThis case is currently on hold for external outreach until flagged review items are resolved."
      : "";

  const connectorBody = `Hi [Connector Name],

I would value your judgment on whether you would be comfortable making a warm introduction to ${sponsor.fullName} regarding ${candidate.fullName}.

I believe the case is strongest as follows:
${brief.summary}

Why now:
${brief.whyNow}

The specific ask would be:
${brief.sponsorAsk}

If you were open to carrying it, I would send:
${evidenceBullets}

The main diligence question I would flag upfront:
${riskNote}${holdLanguage}

If helpful, I can forward the one-page brief and cited evidence before you decide.

Best,
[Your Name]`;

  const sponsorBody = `Hi ${sponsorFirstName},

I’m sending a targeted sponsorship case for ${candidate.fullName}, currently a ${candidate.headline.toLowerCase()} based in ${candidate.region}.

The reason this is worth your attention now:
${brief.whyNow}

What stands out in the current evidence:
${talkingPoints}

The ask I would put in front of you is simple:
${brief.sponsorAsk}

If useful, I can send the underlying brief and the top supporting artifacts ahead of a short conversation.

Best,
[Your Name]`;

  const followUpBody = `Hi ${sponsorFirstName},

Thank you for taking the conversation on ${candidate.fullName}.

As discussed, I’m following up with the most relevant proof set and the immediate next step:
${evidenceBullets}

Immediate goal:
${outreachPlan.meetingGoal}

If it is useful, I can also send a tighter written brief with citations and the specific diligence questions we are tracking.

Best,
[Your Name]`;

  const internalHoldBody = `Internal note

Candidate: ${candidate.fullName}
Target sponsor: ${sponsor.fullName}
Current outreach mode: ${outreachPlan.mode}

Reason outreach should stay internal for now:
${outreachPlan.cautionNote}

Before reopening outreach, resolve:
- ${riskNote}
- Reconfirm whether the current warm path (${warmPathSummary || "not available"}) is still the right route
- Tighten the proof set to the three artifacts most directly supporting the ask`;

  const drafts: EmailDraft[] = [
    {
      id: "connector-request",
      label: outreachPlan.mode === "DIRECT_NOTE" ? "Internal sponsor prep note" : "Warm intro request",
      recipientLabel: outreachPlan.mode === "DIRECT_NOTE" ? "Operator team" : "Connector",
      purpose:
        outreachPlan.mode === "DIRECT_NOTE"
          ? "Use this to align internally before sending a direct sponsor note."
          : "Use this to request a warm introduction without overstating the candidate case.",
      subject:
        outreachPlan.mode === "DIRECT_NOTE"
          ? `${candidateFirstName} · sponsor prep for ${sponsor.organization}`
          : `Warm introduction request · ${candidate.fullName} to ${sponsor.fullName}`,
      body: outreachPlan.mode === "DIRECT_NOTE" ? internalHoldBody : connectorBody,
    },
    {
      id: "sponsor-note",
      label: outreachPlan.mode === "OPERATOR_BRIEFING" ? "Internal hold note" : "Sponsor note",
      recipientLabel: outreachPlan.mode === "OPERATOR_BRIEFING" ? "Operator team" : sponsor.fullName,
      purpose:
        outreachPlan.mode === "OPERATOR_BRIEFING"
          ? "Keep the current case in internal circulation until the hold is resolved."
          : "Use this once the sponsor is in the loop, either directly or after an introduction.",
      subject:
        outreachPlan.mode === "OPERATOR_BRIEFING"
          ? `Hold note · ${candidate.fullName} sponsorship case`
          : outreachPlan.subjectLine,
      body: outreachPlan.mode === "OPERATOR_BRIEFING" ? internalHoldBody : sponsorBody,
    },
    {
      id: "follow-up",
      label: "Follow-up note",
      recipientLabel: outreachPlan.mode === "OPERATOR_BRIEFING" ? "Operator team" : sponsor.fullName,
      purpose:
        outreachPlan.mode === "OPERATOR_BRIEFING"
          ? "Track the reopen conditions before any external follow-up."
          : "Send within 24 hours of the first sponsor conversation.",
      subject:
        outreachPlan.mode === "OPERATOR_BRIEFING"
          ? `Reopen checklist · ${candidate.fullName}`
          : `Follow-up · ${candidate.fullName}`,
      body: outreachPlan.mode === "OPERATOR_BRIEFING" ? internalHoldBody : followUpBody,
    },
  ];

  return drafts;
}
