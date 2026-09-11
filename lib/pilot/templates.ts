import { clampNumber, toFixedNumber } from "@/lib/utils/format";

export const PILOT_TEMPLATE_KEYS = [
  "FOUNDATION",
  "FELLOWSHIP",
  "ALUMNI_NETWORK",
  "LEADERSHIP_TEAM",
] as const;

export type PilotTemplateKey = (typeof PILOT_TEMPLATE_KEYS)[number];

export type PilotLaunchChecklistItem = {
  title: string;
  owner: string;
  detail: string;
};

export type PilotStakeholderItem = {
  role: string;
  detail: string;
};

export type PilotBuyerObjection = {
  objection: string;
  response: string;
  proofPoint: string;
};

export type PilotCommercialMilestone = {
  title: string;
  owner: string;
  detail: string;
};

export type PilotTemplateDefinition = {
  key: PilotTemplateKey;
  label: string;
  audience: string;
  summary: string;
  whyItFits: string;
  firstPilotGoal: string;
  successMetrics: string[];
  rolloutSteps: string[];
  demoFocus: string[];
  onboardingChecklist: PilotLaunchChecklistItem[];
  stakeholderMap: PilotStakeholderItem[];
  calibrationPlaybook: string[];
  buyerDeliverables: string[];
  designPartnerCommitments: string[];
  buyerObjections: PilotBuyerObjection[];
  commercialMilestones: PilotCommercialMilestone[];
  roiAssumptions: {
    manualHoursPerFile: number;
    assistedHoursPerFile: number;
    operatorHourlyCost: number;
  };
};

export type PilotTemplateConfig = PilotTemplateDefinition;

const PILOT_TEMPLATES: Record<PilotTemplateKey, PilotTemplateDefinition> = {
  FOUNDATION: {
    key: "FOUNDATION",
    label: "Small foundation",
    audience: "Program officers and small foundations deciding who merits reputational capital, access, or nomination support.",
    summary: "Best when a foundation team needs a disciplined way to separate promising candidates from sponsor-ready candidates.",
    whyItFits:
      "Foundations often have sparse operator time, high trust stakes, and a need to show why one person moved forward while another was held.",
    firstPilotGoal: "Reduce informal sponsorship decisions and create a traceable memo before any high-trust introduction or nomination.",
    successMetrics: [
      "At least 80% of reviewed candidates have a grounded sponsor memo before outreach.",
      "Every sponsor-facing ask shows a visible evidence trail and missing-proof section.",
      "Operators can explain why a file advanced, held, or requested more proof in one meeting.",
    ],
    rolloutSteps: [
      "Week 1: seed an existing slate, choose one operator owner, and set the review standard.",
      "Week 2: run memos on the active slate and resolve obvious proof gaps.",
      "Week 3: test sponsor packets and opportunity briefs on the top advocacy candidates.",
      "Week 4: compare decisions, outcomes, and workflow time against the old process.",
    ],
    demoFocus: [
      "Show how evidence becomes a sponsor memo rather than a generic candidate profile.",
      "Show the proof-request loop for files that are promising but not yet ready.",
      "Show the audit layer so the institution can defend decisions later.",
    ],
    onboardingChecklist: [
      {
        title: "Choose one operator owner",
        owner: "Program lead",
        detail: "Pick a single operator who will run the pilot slate, own weekly review cadence, and decide what counts as sponsor-ready.",
      },
      {
        title: "Seed a contained slate",
        owner: "Ops analyst",
        detail: "Load 10 to 20 live candidates already under consideration so the pilot replaces a real decision bottleneck instead of a hypothetical one.",
      },
      {
        title: "Set the review standard",
        owner: "Review committee",
        detail: "Agree in writing on what should trigger hold, request-more-proof, and sponsor-ready decisions before generating new memos.",
      },
      {
        title: "Capture a baseline",
        owner: "Pilot manager",
        detail: "Record current review time, workflow pressure, and evidence quality before the first sponsor memo is used in a real process.",
      },
    ],
    stakeholderMap: [
      {
        role: "Program lead",
        detail: "Owns final advancement calls and keeps the pilot tied to real nomination or grant workflows.",
      },
      {
        role: "Reviewer",
        detail: "Checks whether the evidence file is strong enough to justify external trust-spending decisions.",
      },
      {
        role: "Executive sponsor",
        detail: "Needs a short packet showing governance, workload reduction, and why the process is safer than operator memory.",
      },
    ],
    calibrationPlaybook: [
      "Review three seeded files together before touching live candidates, and align on what counts as sponsor-ready proof.",
      "Use blind review on the first pass when status or familiarity could distort judgment.",
      "Log at least one explicit reason whenever a human decision overrides the current guardrail.",
      "Treat request-more-proof as a valid pilot outcome, not as pilot failure.",
    ],
    buyerDeliverables: [
      "Pilot brief that frames the first 30 days, design-partner commitment, and governance posture.",
      "Executive ROI page that separates observed workflow proof from modeled economics.",
      "Audit summary showing how disagreements, proof requests, and holds are handled.",
      "One sponsor-ready packet and one held file to show both advancement and restraint.",
    ],
    designPartnerCommitments: [
      "One program owner attends a weekly 30-minute review check-in.",
      "The pilot runs on a live slate of at least 10 candidates already under consideration.",
      "At least one real sponsor-facing decision or hold decision is logged during the pilot window.",
    ],
    buyerObjections: [
      {
        objection: "This looks like another talent workflow tool.",
        response:
          "Keep the pilot anchored on sponsor-facing decisions, held files, and request-more-proof outcomes. The product should show underwriting restraint, not generic case management.",
        proofPoint: "Use one sponsor-ready packet and one held file from the same slate.",
      },
      {
        objection: "We do not want an AI system flattering candidates or hiding weak evidence.",
        response:
          "Blind review, strict evidence mode, guardrails, contradiction handling, and human review states are first-class controls. The system can explicitly hold or block outreach.",
        proofPoint: "Open audits, review states, and the evidence-discipline panel during the pilot brief.",
      },
      {
        objection: "Our team does not have time for another heavy implementation.",
        response:
          "The first motion is a contained 10-to-20-file slate with one operator owner, one weekly review rhythm, and measured baseline/checkpoint capture.",
        proofPoint: "Show the launch checklist and measured baseline workflow on the onboarding and ROI routes.",
      },
    ],
    commercialMilestones: [
      {
        title: "Pilot launch approved",
        owner: "Program lead",
        detail: "A live slate, named owner, and written review standard are in place before the first external sponsor decision.",
      },
      {
        title: "Governance proof recorded",
        owner: "Reviewer lead",
        detail: "The team logs at least one hold or request-more-proof outcome and one disagreement resolution during the pilot.",
      },
      {
        title: "Sponsor-facing outcome observed",
        owner: "Executive sponsor",
        detail: "At least one real sponsor path reaches a known outcome so the pilot can discuss result quality, not just workflow hygiene.",
      },
    ],
    roiAssumptions: {
      manualHoursPerFile: 3.2,
      assistedHoursPerFile: 1.7,
      operatorHourlyCost: 90,
    },
  },
  FELLOWSHIP: {
    key: "FELLOWSHIP",
    label: "Fellowship operator",
    audience: "Program teams reviewing high-potential applicants, finalists, and alumni who may need real sponsorship rather than advice.",
    summary: "Best when fellowship operators want a repeatable way to turn diverse artifacts into a sponsor-ready case.",
    whyItFits:
      "Fellowship programs often have rich qualitative evidence, but weak operational discipline around who gets intros, nominations, and active backing.",
    firstPilotGoal: "Standardize finalist sponsorship review so advocacy is based on inspectable proof instead of operator memory.",
    successMetrics: [
      "Finalists can be compared side by side with a clear evidence and readiness view.",
      "Warm-path and sponsor recommendations are inspectable before any outreach draft is approved.",
      "Second-review triggers catch high-risk disagreements before the operator team moves externally.",
    ],
    rolloutSteps: [
      "Week 1: import finalists or alumni currently being considered for sponsorship.",
      "Week 2: generate evidence claims and sponsor memos for the core slate.",
      "Week 3: run compare views, briefs, and outreach plans for the top candidates.",
      "Week 4: capture which sponsor paths moved and which files still need stronger proof.",
    ],
    demoFocus: [
      "Show compare view and committee-style decision discipline.",
      "Show sponsor-specific memo variants for the same underlying file.",
      "Show outreach approvals so enthusiasm does not outrun evidence.",
    ],
    onboardingChecklist: [
      {
        title: "Import finalists or alumni under real discussion",
        owner: "Program manager",
        detail: "Start with finalists or alumni already on the table for intros, board nomination, or sponsor attention.",
      },
      {
        title: "Define the sponsorship threshold",
        owner: "Selection lead",
        detail: "Clarify what additional proof is required beyond application quality before a fellowship operator makes an introduction or nomination ask.",
      },
      {
        title: "Stage a committee calibration session",
        owner: "Reviewer lead",
        detail: "Use compare view and committee review on a small sample to align on advancement language before wider use.",
      },
      {
        title: "Capture operator baseline time",
        owner: "Pilot manager",
        detail: "Record how long finalist sponsorship review currently takes so measured workflow gains can be compared later.",
      },
    ],
    stakeholderMap: [
      {
        role: "Program manager",
        detail: "Owns the active finalist slate and decides which candidates need sponsor attention instead of only coaching.",
      },
      {
        role: "Committee reviewer",
        detail: "Applies a consistent evidence standard across the finalist cohort and surfaces disagreement explicitly.",
      },
      {
        role: "Alumni or external connector",
        detail: "Tests whether a recommended sponsor path is credible before the team spends reputational capital.",
      },
    ],
    calibrationPlaybook: [
      "Start with two strong files and one clearly incomplete file so the team sees both advancement and hold behavior.",
      "Check whether the memo language stays grounded when the same candidate is viewed through different sponsor variants.",
      "Use second-review triggers on files that would otherwise move on narrative polish alone.",
      "Require every committee decision to leave a short rationale separate from generated memo language.",
    ],
    buyerDeliverables: [
      "Committee-ready compare view for finalists or alumni under sponsorship consideration.",
      "Pilot brief that shows the fellowship-specific rollout and operating asks.",
      "Executive ROI framing that shows governance work, not only labor savings.",
      "One opportunity brief and outreach plan showing how an approved ask is operationalized.",
    ],
    designPartnerCommitments: [
      "A reviewer cohort agrees to run one calibration session before external sponsorship is attempted.",
      "The live pilot includes at least one real sponsor introduction decision and one request-more-proof outcome.",
      "Final advancement decisions are recorded in the workflow instead of remaining in email or operator memory.",
    ],
    buyerObjections: [
      {
        objection: "We already have application review and finalist notes.",
        response:
          "SignalSponsor is not replacing selection review. It addresses the separate question of who is ready for active backing, introductions, and reputational capital.",
        proofPoint: "Use compare view plus sponsor-specific memo variants to show the distinction between finalist quality and sponsor readiness.",
      },
      {
        objection: "Committee decisions are nuanced; a score will flatten them.",
        response:
          "Scores are transparent heuristics only. Final signoff, committee votes, disagreement resolution, and request-more-proof workflows remain human-authored.",
        proofPoint: "Show the committee workflow alongside the breakdown cards and decision logs.",
      },
      {
        objection: "We cannot let outreach happen before the file is ready.",
        response:
          "Outreach approvals, stale-recommendation warnings, and review gates keep sponsor-facing movement tied to current evidence quality.",
        proofPoint: "Open the outreach plan and approval posture from a strong and a weak file.",
      },
    ],
    commercialMilestones: [
      {
        title: "Finalist calibration complete",
        owner: "Reviewer lead",
        detail: "A small reviewer group has compared at least three live files and aligned on what changes a candidate from promising to sponsor-ready.",
      },
      {
        title: "Active ask packaged",
        owner: "Program manager",
        detail: "One live candidate moves from memo into a sponsor-specific brief and approved outreach plan.",
      },
      {
        title: "Decision quality evidenced",
        owner: "Selection lead",
        detail: "The pilot can point to one sponsor movement and one explicit hold with rationale recorded inside the workflow.",
      },
    ],
    roiAssumptions: {
      manualHoursPerFile: 2.8,
      assistedHoursPerFile: 1.4,
      operatorHourlyCost: 75,
    },
  },
  ALUMNI_NETWORK: {
    key: "ALUMNI_NETWORK",
    label: "Alumni network",
    audience: "Alumni and community teams matching credible members to senior backers, operators, and warm introductions.",
    summary: "Best when an alumni network has relationship capital but lacks a disciplined underwriting layer before introductions.",
    whyItFits:
      "Alumni networks usually know many people, but do not always know which member is actually ready for a serious sponsor ask right now.",
    firstPilotGoal: "Turn informal 'who should we introduce?' judgment into a traceable shortlist with evidence-backed sponsor fit.",
    successMetrics: [
      "Operators can explain why a particular sponsor was chosen and what missing proof remains.",
      "Relationship-path recommendations stay tied to warm-path provenance rather than vague networking logic.",
      "Sponsor pipeline items are visible enough to avoid duplicate or poorly timed asks.",
    ],
    rolloutSteps: [
      "Week 1: seed active member files and a curated sponsor directory.",
      "Week 2: validate sponsor match quality and path explanations.",
      "Week 3: run outreach planning on the best-fit sponsor targets.",
      "Week 4: compare sponsor responsiveness and operator effort across the pilot.",
    ],
    demoFocus: [
      "Show sponsor matching and warm-path transparency.",
      "Show sponsor pipeline ownership and next-step discipline.",
      "Show why a file should wait if the evidence is still thin.",
    ],
    onboardingChecklist: [
      {
        title: "Curate the first sponsor directory",
        owner: "Network lead",
        detail: "Start with sponsors and connectors the alumni team actually trusts, not the full long tail of possible names.",
      },
      {
        title: "Pick an active slate",
        owner: "Community operator",
        detail: "Use members currently being considered for intros, board nominations, or visible opportunities.",
      },
      {
        title: "Define path hygiene rules",
        owner: "Program lead",
        detail: "Agree on duplicate-ask rules, timing windows, and what should count as a strong enough warm path.",
      },
      {
        title: "Capture first-path baseline",
        owner: "Pilot manager",
        detail: "Record current time spent deciding who to introduce and how often those asks stall or duplicate.",
      },
    ],
    stakeholderMap: [
      {
        role: "Community operator",
        detail: "Owns the member slate and determines when a warm path is worth activating.",
      },
      {
        role: "Network lead",
        detail: "Curates sponsor quality, availability, and the real relationship graph instead of treating every contact as equal.",
      },
      {
        role: "Senior connector",
        detail: "Needs a clear path rationale and proof summary before agreeing to spend relational capital.",
      },
    ],
    calibrationPlaybook: [
      "Review one strong warm-path recommendation and one blocked path so operators see how the system withholds weak asks.",
      "Pressure-test sponsor fit against timing and capacity, not only domain overlap.",
      "Use the negative-memory layer explicitly when a sponsor is wrong for timing or fit.",
      "Track whether operator overrides improve real sponsor responsiveness or just reflect preference.",
    ],
    buyerDeliverables: [
      "Pilot brief that shows how the alumni team will avoid duplicate or poorly timed asks.",
      "Current sponsor directory posture with live availability and overlap warnings.",
      "Executive ROI view showing whether operator effort and sponsor motion become more disciplined.",
      "One sponsor packet and one blocked path explanation for trust-building demos.",
    ],
    designPartnerCommitments: [
      "The network team maintains a curated sponsor list rather than a generic imported contact list.",
      "Operators agree to log live sponsor outcomes so match quality can be assessed against reality.",
      "At least one real warm-path decision is run through the full brief and pipeline workflow.",
    ],
    buyerObjections: [
      {
        objection: "We already know our alumni network; we do not need more software.",
        response:
          "The value is not directory storage. It is deciding which member is ready for a serious introduction, through which path, and with what proof on file.",
        proofPoint: "Show sponsor ranking, warm-path provenance, and duplicate-ask warnings on one active candidate.",
      },
      {
        objection: "Network introductions are too relationship-sensitive for automation.",
        response:
          "The system does not automate trust. It surfaces the current best path, missing proof, and timing risks so operators can use judgment with more discipline.",
        proofPoint: "Open a candidate with a strong sponsor fit and a weaker backup path, then compare the right-now explanation.",
      },
      {
        objection: "We cannot risk spamming the same sponsor through multiple operators.",
        response:
          "Pipeline ownership, sponsor portfolio history, capacity controls, and negative memory are part of the operating model before live outreach begins.",
        proofPoint: "Use the pipeline and sponsor detail views to show portfolio overlap and path controls.",
      },
    ],
    commercialMilestones: [
      {
        title: "Sponsor directory bounded",
        owner: "Network lead",
        detail: "The pilot launches with a trusted sponsor set, clear path-hygiene rules, and named path owners.",
      },
      {
        title: "Path quality tested",
        owner: "Community operator",
        detail: "At least one live candidate is reviewed through multiple sponsor paths with provenance and timing risk visible.",
      },
      {
        title: "Outcome or hold recorded",
        owner: "Program lead",
        detail: "A real path either advances or is explicitly held with duplicate, timing, or proof rationale captured.",
      },
    ],
    roiAssumptions: {
      manualHoursPerFile: 2.4,
      assistedHoursPerFile: 1.2,
      operatorHourlyCost: 65,
    },
  },
  LEADERSHIP_TEAM: {
    key: "LEADERSHIP_TEAM",
    label: "Leadership development team",
    audience: "Leadership and talent teams deciding who deserves stretch opportunities, executive advocacy, or sponsor attention.",
    summary: "Best when a leadership team wants a more rigorous, less political way to decide who should receive visible sponsorship.",
    whyItFits:
      "Leadership teams often already have internal signal, but need a defensible process before nominating someone for a stretch role or high-trust opportunity.",
    firstPilotGoal: "Create a sober sponsorship review process for stretch roles and visible leadership bets.",
    successMetrics: [
      "Every advanced file includes strengths, risks, open questions, and explicit next-step rationale.",
      "Blind review and strict evidence mode reduce the role of title, familiarity, and narrative polish.",
      "Operator workload and stage movement become visible enough for leadership reporting.",
    ],
    rolloutSteps: [
      "Week 1: align on sponsorship criteria and activate blind review where helpful.",
      "Week 2: generate sponsor memos for the active internal slate.",
      "Week 3: pressure-test disagreements, holds, and proof requests with a second reviewer.",
      "Week 4: package results into pilot ROI and governance reporting for leadership.",
    ],
    demoFocus: [
      "Show blind review and decision audit together.",
      "Show readiness scoring and stage automation as transparent heuristics.",
      "Show the executive ROI view with assumptions called out clearly.",
    ],
    onboardingChecklist: [
      {
        title: "Agree on sponsorship criteria",
        owner: "Leadership sponsor",
        detail: "Define what should justify executive advocacy, stretch-role nomination, or sponsor attention before files are reviewed.",
      },
      {
        title: "Enable governance controls early",
        owner: "Program admin",
        detail: "Start with blind review, strict evidence mode, and outbound approval enabled so the pilot is visibly disciplined from day one.",
      },
      {
        title: "Seed a live internal slate",
        owner: "Talent lead",
        detail: "Run the pilot on active internal candidates who may receive stretch opportunities or high-trust sponsorship.",
      },
      {
        title: "Record a leadership baseline",
        owner: "Pilot manager",
        detail: "Capture current review time and decision ambiguity before the pilot starts so executive reporting is credible later.",
      },
    ],
    stakeholderMap: [
      {
        role: "Talent lead",
        detail: "Runs the candidate slate and ensures the pilot replaces real nomination or stretch-role workflows.",
      },
      {
        role: "Executive sponsor",
        detail: "Needs visible governance, documented rationale, and a restrained advancement posture before trusting the system.",
      },
      {
        role: "Second reviewer",
        detail: "Validates contentious files and makes disagreement resolution part of the operating process.",
      },
    ],
    calibrationPlaybook: [
      "Run one blind-review calibration session before sharing candidate names more broadly.",
      "Use decision audit output to compare human judgments with guardrail posture, not to punish disagreement.",
      "Treat sponsor-facing approval as a separate control from candidate readiness.",
      "Log override reasons in plain language so leadership reporting can distinguish governance from preference.",
    ],
    buyerDeliverables: [
      "Pilot brief that positions the product as an underwriting layer for high-trust internal sponsorship decisions.",
      "Executive ROI framing with explicit assumptions and governance proof.",
      "Decision audit summary showing how overrides, holds, and second review are handled.",
      "A sponsor-ready packet and a held file showing that the system can advance and withhold credibly.",
    ],
    designPartnerCommitments: [
      "Leadership agrees to evaluate the pilot on decision quality and governance, not only time saved.",
      "The pilot uses a real internal slate with at least one visible advancement or hold decision.",
      "A second reviewer participates in high-risk files during the pilot window.",
    ],
    buyerObjections: [
      {
        objection: "This feels too qualitative for leadership development.",
        response:
          "The product is built around inspectable artifacts, structured claims, and sponsor-ready memos that separate evidence from impression.",
        proofPoint: "Show a leadership candidate where the file advances only after the evidence set crosses the sponsor threshold.",
      },
      {
        objection: "We cannot put executive sponsorship decisions behind a black box.",
        response:
          "Every recommendation has visible scoring, cited evidence, review state, and audit history. Operators can challenge or override the system explicitly.",
        proofPoint: "Open the audit summary, decision logs, and stage history for one live leadership file.",
      },
      {
        objection: "We do not want this to become another HR system.",
        response:
          "The pilot should stay narrow: a bounded slate, sponsorship calls, and executive advocacy decisions. It is underwriting for backing, not a broad talent suite.",
        proofPoint: "Frame the pilot through the leadership-team template and use the commercial proof page as the buyer narrative.",
      },
    ],
    commercialMilestones: [
      {
        title: "Executive sponsorship use case defined",
        owner: "Team manager",
        detail: "The buyer agrees on which leadership decisions belong in the pilot and which stay outside scope.",
      },
      {
        title: "Governance review completed",
        owner: "Executive sponsor",
        detail: "The team reviews evidence controls, human override paths, and audit posture before treating the workflow as decision support.",
      },
      {
        title: "Advocacy outcome captured",
        owner: "Leadership operator",
        detail: "A real leadership sponsorship decision reaches a known outcome so the pilot can talk about signal quality, not only workflow efficiency.",
      },
    ],
    roiAssumptions: {
      manualHoursPerFile: 3.0,
      assistedHoursPerFile: 1.5,
      operatorHourlyCost: 85,
    },
  },
};

export function isPilotTemplateKey(input: string): input is PilotTemplateKey {
  return PILOT_TEMPLATE_KEYS.includes(input as PilotTemplateKey);
}

export function getPilotTemplate(input?: string | null): PilotTemplateDefinition {
  if (input && isPilotTemplateKey(input)) {
    return PILOT_TEMPLATES[input];
  }

  return PILOT_TEMPLATES.FOUNDATION;
}

export function listPilotTemplates() {
  return PILOT_TEMPLATE_KEYS.map((key) => PILOT_TEMPLATES[key]);
}

export type PilotRoiInput = {
  candidateCount: number;
  memoReadyCount: number;
  sponsorReadyCount: number;
  activePipelineCount: number;
  openAlerts: number;
  openTasks: number;
  knownOutcomeCount: number;
  positiveOutcomeCount: number;
  disagreementRate: number;
  blindReviewMode: boolean;
  strictEvidenceMode: boolean;
  requireOutboundApproval: boolean;
};

export function buildPilotRoiModel(templateKey: PilotTemplateKey, input: PilotRoiInput) {
  const template = getPilotTemplate(templateKey);
  const activeFiles = Math.max(input.candidateCount, input.activePipelineCount, 1);
  const hoursRecoveredPerFile = Math.max(
    template.roiAssumptions.manualHoursPerFile - template.roiAssumptions.assistedHoursPerFile,
    0.2,
  );
  const monthlyHoursRecovered = toFixedNumber(activeFiles * hoursRecoveredPerFile, 1);
  const operatorDaysRecovered = toFixedNumber(monthlyHoursRecovered / 7.5, 1);
  const monthlyLaborValue = Math.round(monthlyHoursRecovered * template.roiAssumptions.operatorHourlyCost);
  const knownOutcomeCoverage = clampNumber(
    Math.round((input.knownOutcomeCount / Math.max(input.candidateCount, 1)) * 100),
    0,
    100,
  );
  const positiveOutcomeRate = input.knownOutcomeCount
    ? clampNumber(Math.round((input.positiveOutcomeCount / input.knownOutcomeCount) * 100), 0, 100)
    : 0;
  const controlCoverage =
    [input.blindReviewMode, input.strictEvidenceMode, input.requireOutboundApproval].filter(Boolean).length / 3;

  return {
    template,
    modeled: {
      activeFiles,
      activePipelineCount: input.activePipelineCount,
      hoursRecoveredPerFile: toFixedNumber(hoursRecoveredPerFile, 1),
      monthlyHoursRecovered,
      operatorDaysRecovered,
      monthlyLaborValue,
      sponsorReadyCoverage: clampNumber(
        Math.round((input.sponsorReadyCount / Math.max(input.candidateCount, 1)) * 100),
        0,
        100,
      ),
      memoCoverage: clampNumber(Math.round((input.memoReadyCount / Math.max(input.candidateCount, 1)) * 100), 0, 100),
      knownOutcomeCoverage,
      positiveOutcomeRate,
      controlCoverage: Math.round(controlCoverage * 100),
      disagreementRate: clampNumber(input.disagreementRate, 0, 100),
      workflowPressure: input.openAlerts + input.openTasks,
    },
    assumptions: [
      `Manual sponsorship review is modeled at ${template.roiAssumptions.manualHoursPerFile} hours per file.`,
      `SignalSponsor-assisted review is modeled at ${template.roiAssumptions.assistedHoursPerFile} hours per file.`,
      `Operator time is valued at $${template.roiAssumptions.operatorHourlyCost}/hour for this pilot model.`,
      "These numbers are modeled planning assumptions, not observed financial outcomes.",
    ],
  };
}
