import {
  ArtifactType,
  CandidateStage,
  EdgeType,
  EntityType,
  SeniorityLevel,
  SponsorAvailabilityStatus,
  SponsorStyle,
  UserRole,
} from "@prisma/client";

type ArtifactSeed = {
  artifactType: ArtifactType;
  title: string;
  sourceLabel: string;
  fileName?: string;
  rawText: string;
};

export type CandidateSeed = {
  key: string;
  fullName: string;
  headline: string;
  bio: string;
  region: string;
  currentStage: CandidateStage;
  artifacts: ArtifactSeed[];
};

export type SponsorSeed = {
  key: string;
  fullName: string;
  title: string;
  organization: string;
  domainExpertise: string;
  seniorityLevel: SeniorityLevel;
  sponsorStyle: SponsorStyle;
  availabilityStatus?: SponsorAvailabilityStatus;
  maxConcurrentPaths?: number;
  availabilityNote?: string;
  blackoutUntilDaysFromNow?: number;
  blackoutReason?: string;
  interestTags: string;
  geography: string;
  warmIntroAvailable: boolean;
  bio: string;
};

export type EdgeSeed = {
  fromEntityType: EntityType;
  fromKey: string;
  toEntityType: EntityType;
  toKey: string;
  edgeType: EdgeType;
  strength: number;
  notes: string;
};

const paragraph = (...sentences: string[]) => sentences.join(" ");

export const userSeeds = [
  {
    name: "Alex Mercer",
    email: "alex@signalsponsor.demo",
    role: UserRole.ADMIN,
  },
  {
    name: "Rina Patel",
    email: "rina@signalsponsor.demo",
    role: UserRole.OPERATOR,
  },
  {
    name: "Jordan Lee",
    email: "jordan@signalsponsor.demo",
    role: UserRole.OPERATOR,
  },
  {
    name: "Marta Solis",
    email: "marta@signalsponsor.demo",
    role: UserRole.OPERATOR,
  },
];

export const candidateSeeds: CandidateSeed[] = [
  {
    key: "maya-rios",
    fullName: "Maya Rios",
    headline: "Climate resilience operator building neighborhood energy pilots",
    bio: paragraph(
      "Maya builds climate and community programs that convert resident trust into repeatable local infrastructure.",
      "She has led cross-sector pilots in Oakland focused on cooling access, workforce participation, and public-interest implementation.",
      "Her strongest work sits at the intersection of climate adaptation, community partnership, and disciplined execution.",
    ),
    region: "Oakland, CA",
    currentStage: CandidateStage.MEMO_READY,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - Community Climate Programs",
        sourceLabel: "Candidate upload",
        fileName: "maya_rios_resume.pdf",
        rawText: paragraph(
          "Led a neighborhood cooling pilot across three library sites serving 1,800 residents during peak heat weeks.",
          "Built the operating plan, coordinated city staff, and delivered the pilot on schedule with a volunteer team of 14 fellows.",
          "Partnered with two workforce nonprofits to recruit paid student ambassadors from the surrounding community.",
        ),
      },
      {
        artifactType: ArtifactType.PROJECT_SUMMARY,
        title: "Project Summary - Resilient Block Network",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Maya created the Resilient Block Network after residents said existing climate plans felt abstract and inaccessible.",
          "She designed a lightweight dashboard to track signups, cooling kit delivery, and resident follow-through by block captain.",
          "The first pilot helped the team decide which local partnerships were strong enough to sustain into year two.",
        ),
      },
      {
        artifactType: ArtifactType.MENTOR_NOTE,
        title: "Mentor Note - Lena Holt",
        sourceLabel: "Program operator note",
        rawText: paragraph(
          "Maya is unusually steady under pressure and does not need external prompting to move work forward.",
          "When a city partner changed procurement rules late in the process, she adapted the rollout plan without losing community trust.",
          "I would trust her with a higher-stakes operating brief if the next sponsor can open doors in climate infrastructure funding.",
        ),
      },
    ],
  },
  {
    key: "jonah-park",
    fullName: "Jonah Park",
    headline: "Community health analyst translating messy data into clinic action",
    bio: paragraph(
      "Jonah operates between health data, frontline clinics, and neighborhood organizations.",
      "He is strongest when a team needs analytical clarity without losing sight of human context.",
      "His evidence is solid, though his sponsorship case still needs a bit more leadership proof beyond project ownership.",
    ),
    region: "Chicago, IL",
    currentStage: CandidateStage.REVIEW,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - Community Health Operations",
        sourceLabel: "Candidate upload",
        fileName: "jonah_park_resume.pdf",
        rawText: paragraph(
          "Analyzed intake bottlenecks across four community clinics and designed a new reporting cadence for care coordinators.",
          "Presented weekly patient access trends to an operating group spanning public-health staff and nonprofit partners.",
          "Built a basic staffing model that helped one clinic reduce callback delays during flu season.",
        ),
      },
      {
        artifactType: ArtifactType.RECOMMENDATION,
        title: "Recommendation - Clinic Director",
        sourceLabel: "Recommendation text",
        rawText: paragraph(
          "Jonah turns ambiguous health data into action that frontline staff can actually use.",
          "He wrote concise operating memos, translated technical tradeoffs, and earned trust from skeptical managers over time.",
          "His next step should include a larger ownership scope that tests leadership, not only analysis.",
        ),
      },
      {
        artifactType: ArtifactType.REFLECTION,
        title: "Reflection - Trust and Measurement",
        sourceLabel: "Candidate reflection",
        rawText: paragraph(
          "I learned that clinics adopt new dashboards only when they believe the person behind the analysis understands workflow reality.",
          "After an early rollout stalled, I adapted the metrics and spent more time listening to care coordinators before rebuilding the view.",
          "The strongest progress came once data review felt collaborative instead of imposed from above.",
        ),
      },
    ],
  },
  {
    key: "leila-mensah",
    fullName: "Leila Mensah",
    headline: "Workforce pathways builder connecting first-generation students to apprenticeships",
    bio: paragraph(
      "Leila has spent the last four years building practical bridges between education systems, employers, and first-generation talent.",
      "She combines community credibility with an operator's bias toward follow-through.",
      "Her case for sponsorship is strongest where workforce, education, and youth opportunity intersect.",
    ),
    region: "Atlanta, GA",
    currentStage: CandidateStage.MEMO_READY,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - Apprenticeship Pathways",
        sourceLabel: "Candidate upload",
        fileName: "leila_mensah_resume.pdf",
        rawText: paragraph(
          "Launched an employer partnership track that placed 46 community-college students into paid apprenticeships over two cohorts.",
          "Managed employer relationships, student readiness sessions, and weekly follow-through check-ins with campus advisors.",
          "Built a referral rubric that reduced last-minute dropout from the placement process.",
        ),
      },
      {
        artifactType: ArtifactType.PROJECT_SUMMARY,
        title: "Project Summary - Employer Readiness Sprint",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Leila piloted a six-week employer readiness sprint after hearing that students were losing momentum between acceptance and start date.",
          "She coordinated volunteer mentors, wrote the session sequence, and measured attendance and placement conversion across the cohort.",
          "The strongest result was not only placement volume but stronger confidence among students who had not seen themselves in corporate spaces before.",
        ),
      },
      {
        artifactType: ArtifactType.MENTOR_NOTE,
        title: "Mentor Note - Devon Price",
        sourceLabel: "Mentor note",
        rawText: paragraph(
          "Leila leads with unusual consistency and keeps both students and employers on the same page even when expectations drift.",
          "I have seen her recover a strained employer relationship by owning the miss, adjusting the workflow, and re-establishing trust quickly.",
          "She is ready for a sponsor who can advocate for regional scale, not just another advisor conversation.",
        ),
      },
    ],
  },
  {
    key: "arjun-sethi",
    fullName: "Arjun Sethi",
    headline: "Civic product fellow improving resident-service delivery",
    bio: paragraph(
      "Arjun builds civic technology that helps residents navigate public systems with less friction.",
      "He is credible with both policy staff and product teams, and his strongest artifacts show initiative paired with analytical discipline.",
      "His sponsorship path is most compelling through public-interest technology and service design.",
    ),
    region: "New York, NY",
    currentStage: CandidateStage.SPONSOR_OUTREACH,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - Civic Product and Service Design",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Built a resident service request triage prototype used by two borough teams to reduce duplicate intake reviews.",
          "Worked with policy analysts and frontline staff to map confusing handoffs in the intake process.",
          "Presented findings to a city innovation director and translated them into a phased implementation plan.",
        ),
      },
      {
        artifactType: ArtifactType.PROJECT_SUMMARY,
        title: "Project Summary - Resident Intake Redesign",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Arjun initiated the redesign after call-center staff explained that residents were repeating the same history across disconnected systems.",
          "He designed a simple service blueprint, tested it with staff, and iterated after discovering that one proposed workflow created a new burden upstream.",
          "The pilot showed moderate volume gains and much higher staff confidence in the process map.",
        ),
      },
      {
        artifactType: ArtifactType.RECOMMENDATION,
        title: "Recommendation - Civic Innovation Lead",
        sourceLabel: "Recommendation text",
        rawText: paragraph(
          "Arjun can move between product, operations, and policy without becoming vague in any of them.",
          "He writes clearly, facilitates difficult discussions, and tends to earn credibility because his recommendations are grounded in observed workflow rather than theory.",
          "A strong sponsor could place him into a higher-leverage civic systems role quickly.",
        ),
      },
    ],
  },
  {
    key: "nia-okafor",
    fullName: "Nia Okafor",
    headline: "Youth arts organizer building neighborhood storytelling labs",
    bio: paragraph(
      "Nia is a strong community builder with early evidence of program leadership in youth arts and local storytelling.",
      "Her artifacts show real mission alignment and communication strength.",
      "She likely needs one more operational proof point before a serious sponsor ask.",
    ),
    region: "Detroit, MI",
    currentStage: CandidateStage.REVIEW,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - Youth Arts Programming",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Organized neighborhood storytelling labs serving 80 high-school participants across three community sites.",
          "Coordinated artist facilitators, parent communication, and a final public showcase with local partners.",
          "Raised small-dollar support from local businesses to cover supplies and transportation stipends.",
        ),
      },
      {
        artifactType: ArtifactType.REFLECTION,
        title: "Reflection - Building Trust Through Arts",
        sourceLabel: "Candidate reflection",
        rawText: paragraph(
          "I underestimated how much consistency mattered for youth participation until attendance dropped after one facilitator changed at the last minute.",
          "We adapted by simplifying the session plan and creating a shared briefing note so families heard the same message from every adult involved.",
          "That shift taught me that creative work still needs operating discipline if it is going to last.",
        ),
      },
      {
        artifactType: ArtifactType.MENTOR_NOTE,
        title: "Mentor Note - Chloe Park",
        sourceLabel: "Mentor note",
        rawText: paragraph(
          "Nia has real public-facing communication strength and builds trust quickly with young people and parents.",
          "What I still want to see is a larger example of follow-through over a longer horizon, especially with budget ownership.",
          "She is promising, but the sponsorship case would be stronger with one more durable result.",
        ),
      },
    ],
  },
  {
    key: "elena-torres",
    fullName: "Elena Torres",
    headline: "Education equity operator scaling principal coaching systems",
    bio: paragraph(
      "Elena is an education operator who builds systems that help school leaders actually use coaching and data, not just talk about them.",
      "Her evidence profile is disciplined, repeatable, and grounded in real implementation constraints.",
      "She is a strong sponsor-ready candidate for education and leadership development networks.",
    ),
    region: "Los Angeles, CA",
    currentStage: CandidateStage.MEMO_READY,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - School Leadership Operations",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Managed a principal coaching portfolio across 27 schools and rebuilt the operating cadence for follow-up, session notes, and issue escalation.",
          "Led a cross-functional working group that aligned coaching goals with district implementation milestones.",
          "Delivered a new reporting template that improved completion rates for school action plans.",
        ),
      },
      {
        artifactType: ArtifactType.PROJECT_SUMMARY,
        title: "Project Summary - Coaching System Reset",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Elena initiated a coaching system reset when principals reported that support felt fragmented and hard to translate into school action.",
          "She mapped the full workflow, identified where follow-through broke down, and implemented a simpler operating model with clearer owner roles.",
          "Within one semester, more principals were closing action items on time and district staff had fewer escalation surprises.",
        ),
      },
      {
        artifactType: ArtifactType.RECOMMENDATION,
        title: "Recommendation - Regional Superintendent",
        sourceLabel: "Recommendation text",
        rawText: paragraph(
          "Elena is not only dependable; she improves the system around her.",
          "She can brief senior education leaders with clarity while still earning trust from principals who are skeptical of central office language.",
          "A sponsor who understands education systems could put her on a larger regional platform now.",
        ),
      },
    ],
  },
  {
    key: "samir-haddad",
    fullName: "Samir Haddad",
    headline: "Mobility systems designer prototyping safer bus rider tools",
    bio: paragraph(
      "Samir works in public-interest mobility design with a focus on rider trust, safety, and practical service adoption.",
      "His artifacts show strong analytical thinking and initiative.",
      "He needs slightly broader social proof before the strongest sponsors will advocate hard.",
    ),
    region: "Toronto, ON",
    currentStage: CandidateStage.REVIEW,
    artifacts: [
      {
        artifactType: ArtifactType.PORTFOLIO_LINK,
        title: "Portfolio Note - Rider Safety Prototype",
        sourceLabel: "Portfolio text paste",
        rawText: paragraph(
          "Designed a rider feedback prototype that let late-night bus riders flag unsafe transfer points without a long intake form.",
          "Worked with transit staff to test the language and flow before sharing a public pilot page.",
          "The prototype revealed that riders would contribute better detail when the prompt acknowledged time pressure and safety concerns directly.",
        ),
      },
      {
        artifactType: ArtifactType.PROJECT_SUMMARY,
        title: "Project Summary - Safer Transfer Pilot",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Samir started the pilot after community riders described transfer locations that felt invisible in official planning conversations.",
          "He analyzed route timing, rider narratives, and transfer volume to prioritize a small set of test locations.",
          "The pilot adapted twice after field observation showed the first signage concept was too easy to ignore.",
        ),
      },
      {
        artifactType: ArtifactType.MENTOR_NOTE,
        title: "Mentor Note - Transit Design Lead",
        sourceLabel: "Mentor note",
        rawText: paragraph(
          "Samir is unusually curious and can turn observation into a sharper prototype very quickly.",
          "He collaborates well with agency staff, but his next growth edge is leading a broader coalition instead of staying within the design lane.",
          "A sponsor in mobility systems would be well positioned to test that next level.",
        ),
      },
    ],
  },
  {
    key: "priya-raman",
    fullName: "Priya Raman",
    headline: "Biotech community translator building patient-centered trial access",
    bio: paragraph(
      "Priya operates where biotechnology, patient trust, and access barriers overlap.",
      "Her strongest evidence shows communication discipline, analytical thinking, and mission alignment.",
      "She is ready for sponsors who can connect health systems and patient-centered innovation networks.",
    ),
    region: "Boston, MA",
    currentStage: CandidateStage.MEMO_READY,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - Clinical Access Programs",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Built patient-facing enrollment materials for a clinical access initiative serving three hospital systems.",
          "Analyzed where families dropped out of the referral process and redesigned the information flow with research staff and community partners.",
          "Presented the revised workflow to biotech operators and patient advocates in the same working session.",
        ),
      },
      {
        artifactType: ArtifactType.PROJECT_SUMMARY,
        title: "Project Summary - Trial Access Navigator",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Priya initiated a trial access navigator after hearing that eligible families were abandoning the process because the language felt opaque.",
          "She created a plain-language decision guide, measured common confusion points, and iterated after community review.",
          "The work improved not only comprehension but trust, because families felt the process respected their time and questions.",
        ),
      },
      {
        artifactType: ArtifactType.RECOMMENDATION,
        title: "Recommendation - Patient Advocacy Director",
        sourceLabel: "Recommendation text",
        rawText: paragraph(
          "Priya can communicate with scientists, operators, and families without flattening the complexity of any one audience.",
          "She is disciplined, empathetic, and willing to stay with difficult implementation details long after the meeting ends.",
          "She would benefit from a sponsor who can advocate across both biotech and public-interest health contexts.",
        ),
      },
    ],
  },
  {
    key: "diego-alvarez",
    fullName: "Diego Alvarez",
    headline: "Housing finance analyst exploring equitable capital pathways",
    bio: paragraph(
      "Diego is early in his path and has credible interest in housing finance and community development.",
      "The current evidence base is thin and still reads more like potential than conviction.",
      "He is a useful demo case for candidates who need more proof before outreach.",
    ),
    region: "Miami, FL",
    currentStage: CandidateStage.INTAKE,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - Housing and Community Finance",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Supported underwriting memos for a small community development lender and tracked basic pipeline metrics.",
          "Contributed research on affordable housing capital stacks and summarized findings for an internal team meeting.",
          "Volunteered with a neighborhood tenant resource clinic on intake days.",
        ),
      },
      {
        artifactType: ArtifactType.REFLECTION,
        title: "Reflection - Why Housing Finance",
        sourceLabel: "Candidate reflection",
        rawText: paragraph(
          "I want to understand how capital decisions shape who gets stability and who gets excluded.",
          "My next step is to produce stronger evidence that I can own more than research support work.",
          "I am looking for ways to translate interest into responsibility and repeated execution.",
        ),
      },
    ],
  },
  {
    key: "aisha-coleman",
    fullName: "Aisha Coleman",
    headline: "Public-interest technologist building trust-centered civic data systems",
    bio: paragraph(
      "Aisha works on civic data systems where trust, governance, and service delivery all matter at once.",
      "Her artifacts show leadership, analytical thinking, and communication at a level that merits serious sponsorship attention.",
      "She is one of the clearest sponsor-ready profiles in the demo dataset.",
    ),
    region: "Washington, DC",
    currentStage: CandidateStage.MEMO_READY,
    artifacts: [
      {
        artifactType: ArtifactType.RESUME,
        title: "Resume - Civic Data Governance",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Led a civic data governance sprint that aligned product, legal, and resident-engagement teams around a shared trust framework.",
          "Built the implementation roadmap, facilitated executive reviews, and delivered a practical policy decision log used across two departments.",
          "Coached junior analysts on how to translate governance concerns into product requirements.",
        ),
      },
      {
        artifactType: ArtifactType.PROJECT_SUMMARY,
        title: "Project Summary - Trust-Centered Data Framework",
        sourceLabel: "Candidate upload",
        rawText: paragraph(
          "Aisha initiated a trust-centered data framework after residents and staff described the city data process as opaque and one-directional.",
          "She analyzed prior complaints, mapped approval friction, and designed a simpler review flow with clearer accountability points.",
          "The result was not only a cleaner framework but stronger adoption because teams understood why the system existed.",
        ),
      },
      {
        artifactType: ArtifactType.MENTOR_NOTE,
        title: "Mentor Note - Policy and Product Advisor",
        sourceLabel: "Mentor note",
        rawText: paragraph(
          "Aisha consistently shows the rare combination of executive communication and implementation stamina.",
          "When a governance review became politically sensitive, she held the line on substance while adapting the process to maintain momentum.",
          "A strong sponsor in civic systems could credibly advocate for her in senior cross-sector settings today.",
        ),
      },
    ],
  },
];

export const sponsorSeeds: SponsorSeed[] = [
  {
    key: "helena-brooks",
    fullName: "Helena Brooks",
    title: "Partner",
    organization: "Meridian Civic Partners",
    domainExpertise: "climate|civic|policy",
    seniorityLevel: SeniorityLevel.PARTNER,
    sponsorStyle: SponsorStyle.SELECTIVE_DOOR_OPENER,
    interestTags: "public interest|community|technology",
    geography: "North America",
    warmIntroAvailable: true,
    bio: "Helena backs operators who can bridge public systems and execution discipline. She is selective and moves when the evidence is inspectable.",
  },
  {
    key: "victor-han",
    fullName: "Victor Han",
    title: "Executive Vice President",
    organization: "Northforge Foundation",
    domainExpertise: "workforce|education|community",
    seniorityLevel: SeniorityLevel.EXECUTIVE,
    sponsorStyle: SponsorStyle.HANDS_ON,
    interestTags: "youth|equity|leadership",
    geography: "United States",
    warmIntroAvailable: true,
    bio: "Victor sponsors operators who can build practical pathways for first-generation talent and stay close to execution.",
  },
  {
    key: "naomi-winters",
    fullName: "Naomi Winters",
    title: "Managing Director",
    organization: "Harbor Health Capital",
    domainExpertise: "health|community|technology",
    seniorityLevel: SeniorityLevel.VP,
    sponsorStyle: SponsorStyle.SYSTEMS_BUILDER,
    interestTags: "patient access|analytics|public interest",
    geography: "Boston, MA",
    warmIntroAvailable: true,
    bio: "Naomi backs health operators who can connect systems insight with patient trust and measurable implementation.",
  },
  {
    key: "marcus-bell",
    fullName: "Marcus Bell",
    title: "Founder",
    organization: "Lantern Leadership Lab",
    domainExpertise: "youth|arts|education",
    seniorityLevel: SeniorityLevel.FOUNDER,
    sponsorStyle: SponsorStyle.PUBLIC_ADVOCATE,
    interestTags: "community|storytelling|leadership",
    geography: "Detroit, MI",
    warmIntroAvailable: true,
    bio: "Marcus is a visible advocate for community-rooted leaders and early institution builders.",
  },
  {
    key: "sofia-martinez",
    fullName: "Sofia Martinez",
    title: "Chief Impact Officer",
    organization: "Horizon Transit Institute",
    domainExpertise: "mobility|climate|technology",
    seniorityLevel: SeniorityLevel.C_SUITE,
    sponsorStyle: SponsorStyle.HANDS_ON,
    interestTags: "public interest|service design|community",
    geography: "Toronto, ON",
    warmIntroAvailable: true,
    bio: "Sofia sponsors mobility operators who care about riders, systems design, and practical implementation quality.",
  },
  {
    key: "daniel-reed",
    fullName: "Daniel Reed",
    title: "Partner",
    organization: "Red Cedar Ventures",
    domainExpertise: "finance|housing|technology",
    seniorityLevel: SeniorityLevel.PARTNER,
    sponsorStyle: SponsorStyle.SELECTIVE_DOOR_OPENER,
    interestTags: "capital|community|analytics",
    geography: "Miami, FL",
    warmIntroAvailable: false,
    bio: "Daniel backs disciplined operators in housing and finance once there is enough proof to justify a high-trust introduction.",
  },
  {
    key: "amara-singh",
    fullName: "Amara Singh",
    title: "Executive Director",
    organization: "Bridgewell Fellowship",
    domainExpertise: "public interest|civic|policy",
    seniorityLevel: SeniorityLevel.EXECUTIVE,
    sponsorStyle: SponsorStyle.QUIET_CONNECTOR,
    interestTags: "service design|leadership|technology",
    geography: "Washington, DC",
    warmIntroAvailable: true,
    bio: "Amara is a quiet connector for rising public-interest builders whose evidence can stand up in senior rooms.",
  },
  {
    key: "chloe-bennett",
    fullName: "Chloe Bennett",
    title: "Vice President, Community Impact",
    organization: "Aurora Education Trust",
    domainExpertise: "education|youth|workforce",
    seniorityLevel: SeniorityLevel.VP,
    sponsorStyle: SponsorStyle.SYSTEMS_BUILDER,
    interestTags: "school systems|coaching|equity",
    geography: "Los Angeles, CA",
    warmIntroAvailable: true,
    bio: "Chloe backs education leaders who improve the operating system, not just the program layer.",
  },
  {
    key: "oliver-grant",
    fullName: "Oliver Grant",
    title: "Managing Partner",
    organization: "Third Mile Advisory",
    domainExpertise: "climate|infrastructure|finance",
    seniorityLevel: SeniorityLevel.PARTNER,
    sponsorStyle: SponsorStyle.SELECTIVE_DOOR_OPENER,
    availabilityStatus: SponsorAvailabilityStatus.LIMITED,
    availabilityNote: "Strong long-term fit, but current sponsor bandwidth is narrow until the next infrastructure committee window.",
    blackoutUntilDaysFromNow: 21,
    blackoutReason: "Hold new asks until the current infrastructure committee cycle closes.",
    interestTags: "community|workforce|execution",
    geography: "California",
    warmIntroAvailable: true,
    bio: "Oliver advocates for operators who can move from local proof to scaled infrastructure execution.",
  },
  {
    key: "rachel-kim",
    fullName: "Rachel Kim",
    title: "Chief Program Officer",
    organization: "Crestline Health Collaborative",
    domainExpertise: "health|education|community",
    seniorityLevel: SeniorityLevel.C_SUITE,
    sponsorStyle: SponsorStyle.HANDS_ON,
    interestTags: "analytics|public interest|operations",
    geography: "Chicago, IL",
    warmIntroAvailable: true,
    bio: "Rachel sponsors operators who can turn frontline complexity into better systems and credible execution.",
  },
  {
    key: "theo-johnson",
    fullName: "Theo Johnson",
    title: "Founder",
    organization: "Service Commons",
    domainExpertise: "civic|technology|community",
    seniorityLevel: SeniorityLevel.FOUNDER,
    sponsorStyle: SponsorStyle.PUBLIC_ADVOCATE,
    interestTags: "resident experience|policy|trust",
    geography: "New York, NY",
    warmIntroAvailable: true,
    bio: "Theo is an active public advocate for civic product leaders who can show disciplined service improvement.",
  },
  {
    key: "vivian-okoro",
    fullName: "Vivian Okoro",
    title: "Senior Director",
    organization: "Community Futures Network",
    domainExpertise: "workforce|community|housing",
    seniorityLevel: SeniorityLevel.DIRECTOR,
    sponsorStyle: SponsorStyle.QUIET_CONNECTOR,
    interestTags: "youth|equity|capital access",
    geography: "Atlanta, GA",
    warmIntroAvailable: true,
    bio: "Vivian tends to make trusted introductions for operators working at the boundary of community systems and opportunity pipelines.",
  },
  {
    key: "ian-foster",
    fullName: "Ian Foster",
    title: "General Partner",
    organization: "North Harbor Bio Ventures",
    domainExpertise: "health|technology|finance",
    seniorityLevel: SeniorityLevel.PARTNER,
    sponsorStyle: SponsorStyle.SELECTIVE_DOOR_OPENER,
    interestTags: "patient access|biotech|analytics",
    geography: "Boston, MA",
    warmIntroAvailable: true,
    bio: "Ian selectively backs health builders who can navigate regulated complexity without losing patient trust.",
  },
  {
    key: "teresa-nolan",
    fullName: "Teresa Nolan",
    title: "Managing Director",
    organization: "Civic Ledger Initiative",
    domainExpertise: "civic|technology|governance",
    seniorityLevel: SeniorityLevel.EXECUTIVE,
    sponsorStyle: SponsorStyle.SYSTEMS_BUILDER,
    interestTags: "trust|policy|public interest",
    geography: "Washington, DC",
    warmIntroAvailable: true,
    bio: "Teresa sponsors technologists who can hold governance rigor and execution in the same frame.",
  },
];

export const relationshipSeeds: EdgeSeed[] = [
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "maya-rios",
    toEntityType: EntityType.MENTOR,
    toKey: "mentor-lena-holt",
    edgeType: EdgeType.MENTORED_BY,
    strength: 4,
    notes: "Lena Holt, climate fellowship mentor",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-ana-sloan",
    toEntityType: EntityType.CANDIDATE,
    toKey: "maya-rios",
    edgeType: EdgeType.WORKED_WITH,
    strength: 4,
    notes: "Ana Sloan, Civic Launch operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-ana-sloan",
    toEntityType: EntityType.SPONSOR,
    toKey: "helena-brooks",
    edgeType: EdgeType.OPERATOR_KNOWS,
    strength: 4,
    notes: "Ana Sloan, Civic Launch operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-ana-sloan",
    toEntityType: EntityType.SPONSOR,
    toKey: "oliver-grant",
    edgeType: EdgeType.OPERATOR_KNOWS,
    strength: 3,
    notes: "Ana Sloan, Civic Launch operator",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "jonah-park",
    toEntityType: EntityType.OPERATOR,
    toKey: "operator-rina-patel",
    edgeType: EdgeType.WORKED_WITH,
    strength: 3,
    notes: "Rina Patel, community health operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-rina-patel",
    toEntityType: EntityType.SPONSOR,
    toKey: "rachel-kim",
    edgeType: EdgeType.OPERATOR_KNOWS,
    strength: 4,
    notes: "Rina Patel, community health operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-rina-patel",
    toEntityType: EntityType.SPONSOR,
    toKey: "naomi-winters",
    edgeType: EdgeType.EVENT_CONNECTION,
    strength: 2,
    notes: "Rina Patel, community health operator",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "leila-mensah",
    toEntityType: EntityType.MENTOR,
    toKey: "mentor-devon-price",
    edgeType: EdgeType.MENTORED_BY,
    strength: 5,
    notes: "Devon Price, apprenticeship mentor",
  },
  {
    fromEntityType: EntityType.MENTOR,
    fromKey: "mentor-devon-price",
    toEntityType: EntityType.SPONSOR,
    toKey: "victor-han",
    edgeType: EdgeType.REFERRED_BY,
    strength: 4,
    notes: "Devon Price, apprenticeship mentor",
  },
  {
    fromEntityType: EntityType.MENTOR,
    fromKey: "mentor-devon-price",
    toEntityType: EntityType.SPONSOR,
    toKey: "vivian-okoro",
    edgeType: EdgeType.ALUMNI_CONNECTION,
    strength: 3,
    notes: "Devon Price, apprenticeship mentor",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "arjun-sethi",
    toEntityType: EntityType.OPERATOR,
    toKey: "operator-ana-sloan",
    edgeType: EdgeType.WORKED_WITH,
    strength: 4,
    notes: "Ana Sloan, Civic Launch operator",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "arjun-sethi",
    toEntityType: EntityType.SPONSOR,
    toKey: "amara-singh",
    edgeType: EdgeType.ALUMNI_CONNECTION,
    strength: 3,
    notes: "Bridgewell Fellowship alumni cohort",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-ana-sloan",
    toEntityType: EntityType.SPONSOR,
    toKey: "theo-johnson",
    edgeType: EdgeType.EVENT_CONNECTION,
    strength: 3,
    notes: "Ana Sloan, Civic Launch operator",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "nia-okafor",
    toEntityType: EntityType.MENTOR,
    toKey: "mentor-chloe-park",
    edgeType: EdgeType.MENTORED_BY,
    strength: 4,
    notes: "Chloe Park, arts mentor",
  },
  {
    fromEntityType: EntityType.MENTOR,
    fromKey: "mentor-chloe-park",
    toEntityType: EntityType.SPONSOR,
    toKey: "marcus-bell",
    edgeType: EdgeType.REFERRED_BY,
    strength: 4,
    notes: "Chloe Park, arts mentor",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "elena-torres",
    toEntityType: EntityType.OPERATOR,
    toKey: "operator-selena-ward",
    edgeType: EdgeType.WORKED_WITH,
    strength: 5,
    notes: "Selena Ward, district operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-selena-ward",
    toEntityType: EntityType.SPONSOR,
    toKey: "chloe-bennett",
    edgeType: EdgeType.OPERATOR_KNOWS,
    strength: 5,
    notes: "Selena Ward, district operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-selena-ward",
    toEntityType: EntityType.SPONSOR,
    toKey: "victor-han",
    edgeType: EdgeType.EVENT_CONNECTION,
    strength: 3,
    notes: "Selena Ward, district operator",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "samir-haddad",
    toEntityType: EntityType.OPERATOR,
    toKey: "operator-mei-chen",
    edgeType: EdgeType.WORKED_WITH,
    strength: 3,
    notes: "Mei Chen, transit design operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-mei-chen",
    toEntityType: EntityType.SPONSOR,
    toKey: "sofia-martinez",
    edgeType: EdgeType.OPERATOR_KNOWS,
    strength: 4,
    notes: "Mei Chen, transit design operator",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "priya-raman",
    toEntityType: EntityType.MENTOR,
    toKey: "mentor-hannah-cho",
    edgeType: EdgeType.MENTORED_BY,
    strength: 4,
    notes: "Hannah Cho, patient advocacy mentor",
  },
  {
    fromEntityType: EntityType.MENTOR,
    fromKey: "mentor-hannah-cho",
    toEntityType: EntityType.SPONSOR,
    toKey: "naomi-winters",
    edgeType: EdgeType.REFERRED_BY,
    strength: 4,
    notes: "Hannah Cho, patient advocacy mentor",
  },
  {
    fromEntityType: EntityType.MENTOR,
    fromKey: "mentor-hannah-cho",
    toEntityType: EntityType.SPONSOR,
    toKey: "ian-foster",
    edgeType: EdgeType.EVENT_CONNECTION,
    strength: 3,
    notes: "Hannah Cho, patient advocacy mentor",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "diego-alvarez",
    toEntityType: EntityType.OPERATOR,
    toKey: "operator-marla-hayes",
    edgeType: EdgeType.WORKED_WITH,
    strength: 2,
    notes: "Marla Hayes, housing finance operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-marla-hayes",
    toEntityType: EntityType.SPONSOR,
    toKey: "daniel-reed",
    edgeType: EdgeType.EVENT_CONNECTION,
    strength: 2,
    notes: "Marla Hayes, housing finance operator",
  },
  {
    fromEntityType: EntityType.CANDIDATE,
    fromKey: "aisha-coleman",
    toEntityType: EntityType.OPERATOR,
    toKey: "operator-joel-banks",
    edgeType: EdgeType.WORKED_WITH,
    strength: 5,
    notes: "Joel Banks, civic innovation operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-joel-banks",
    toEntityType: EntityType.SPONSOR,
    toKey: "amara-singh",
    edgeType: EdgeType.OPERATOR_KNOWS,
    strength: 4,
    notes: "Joel Banks, civic innovation operator",
  },
  {
    fromEntityType: EntityType.OPERATOR,
    fromKey: "operator-joel-banks",
    toEntityType: EntityType.SPONSOR,
    toKey: "teresa-nolan",
    edgeType: EdgeType.REFERRED_BY,
    strength: 5,
    notes: "Joel Banks, civic innovation operator",
  },
];
