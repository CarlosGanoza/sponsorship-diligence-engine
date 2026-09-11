import {
  buildPilotCommercialSharePayload,
  buildPilotOnboardingSharePayload,
  buildPilotPackSharePayload,
  buildPilotReportSharePayload,
  buildPilotRoiSharePayload,
  parsePilotReviewSharePayload,
  serializePilotReviewSharePayload,
} from "@/lib/pilot/share";

describe("pilot review share payloads", () => {
  it("serializes and parses pilot proof report snapshots", () => {
    const payload = buildPilotReportSharePayload({
      kind: "pilot_report",
      title: "Northline proof report",
      templateLabel: "Small foundation",
      healthStatus: "healthy",
      pilotProfile: {
        pilotName: "Northline design partner",
        designPartnerName: "Northline Foundation",
        programName: "Emerging Leaders",
        primaryContactName: "Elena Hart",
        primaryContactEmail: "elena@northline.test",
        packSummary: "Measured proof for a contained pilot.",
      },
      report: {
        title: "Northline proof report",
        generatedAtLabel: "March 24, 2026",
        recommendationLabel: "Ready for a contained design-partner pilot",
        recommendationDetail: "Observed proof and control posture are both visible.",
        stageLabel: "Proof-building pilot",
        summary: "Measured workflow proof for the design partner.",
        observedProof: ["Two sponsor-ready files already exist."],
        modeledAssumptions: ["Modeled labor savings remain assumptions."],
        currentSnapshot: [
          {
            label: "Commercial readiness",
            value: "72/100",
            detail: "Pilot proof is credible but still bounded.",
          },
        ],
        goNoGoCriteria: [
          {
            label: "Measured baseline on file",
            status: "ready",
            detail: "Baseline captured by the operator.",
          },
        ],
        measuredPilot: {
          hasBaseline: true,
          baselineLabel: "March 1, 2026",
          latestCheckpointLabel: "March 20, 2026",
          checkpointCount: 2,
          note: "Observed movement is anchored to a baseline.",
          deltaRows: [
            {
              label: "Memo coverage",
              deltaLabel: "+12 pts",
              currentValueLabel: "68%",
              baselineValueLabel: "56%",
              detail: "More files now reach memo-ready quality.",
              direction: "improved",
            },
          ],
        },
        calibration: {
          statusLabel: "Calibration in range",
          blockers: [],
          openCount: 1,
          escalatedCount: 0,
          readyCount: 3,
          highRiskReviewers: [
            {
              reviewerName: "Mina Shah",
              calibrationStatus: "ready",
              disagreementRate: 14,
              knownOutcomeCount: 6,
              recommendation: "Keep current reviewer scope.",
            },
          ],
        },
        risks: ["Known outcome volume is still thin."],
        nextMoves: ["Capture one more checkpoint before expansion."],
        buyerPressureTest: [
          {
            objection: "This may still be workflow theater.",
            response: "Show the observed movement, not only the template.",
            proofPoint: "Measured checkpoint deltas and strict evidence mode.",
          },
        ],
        successMetrics: ["Time to memo under 48 hours."],
      },
    });

    expect(parsePilotReviewSharePayload(serializePilotReviewSharePayload(payload))).toEqual(payload);
  });

  it("serializes and parses pilot buyer-pack snapshots", () => {
    const payload = buildPilotPackSharePayload({
      kind: "pilot_pack",
      title: "Northline buyer pack",
      templateLabel: "Small foundation",
      healthStatus: "degraded",
      pilotProfile: {
        pilotName: "Northline design partner",
        designPartnerName: "Northline Foundation",
        programName: "Emerging Leaders",
        primaryContactName: "Elena Hart",
        primaryContactEmail: "elena@northline.test",
        packSummary: "Buyer-ready packet built from measured proof.",
      },
      buyerPack: {
        title: "Northline buyer pack",
        subtitle: "Prepared for Northline Foundation",
        recommendationLabel: "Pilot proof is building, but still needs evidence",
        recommendationDetail: "Lead with observed workflow discipline and explicit gaps.",
        measuredDecision: {
          label: "Proof-building pilot",
          detail: "Measured movement exists, but it remains bounded.",
        },
        observedProofHighlights: ["Two sponsor-ready files already exist."],
        modeledEconomicsHighlights: [
          {
            label: "Hours recovered / month",
            value: "18",
            detail: "Planning number, not a proven savings claim.",
          },
        ],
        measuredMovementHighlights: [
          {
            label: "Memo coverage",
            deltaLabel: "+12 pts",
            detail: "Now 68% versus baseline 56%.",
          },
        ],
        goNoGoCriteria: [
          {
            label: "Measured baseline on file",
            status: "ready",
            detail: "Baseline captured by the operator.",
          },
        ],
        buyerDeliverables: ["Internal memo and packet exports."],
        buyerObjections: [
          {
            objection: "What is actually proven?",
            response: "Separate observed workflow proof from modeled economics.",
            proofPoint: "Pilot proof report and buyer pack.",
          },
        ],
        nextMoves: ["Run one contained design-partner pilot."],
        successMetrics: ["Faster sponsor-ready queue movement."],
      },
    });

    expect(parsePilotReviewSharePayload(serializePilotReviewSharePayload(payload))).toEqual(payload);
  });

  it("serializes and parses commercial proof snapshots", () => {
    const payload = buildPilotCommercialSharePayload({
      kind: "pilot_commercial",
      title: "Commercial proof · Northline Foundation",
      templateLabel: "Small foundation",
      healthStatus: "healthy",
      pilotProfile: {
        pilotName: "Northline design partner",
        designPartnerName: "Northline Foundation",
        programName: "Emerging Leaders",
        primaryContactName: "Elena Hart",
        primaryContactEmail: "elena@northline.test",
        packSummary: "Commercial proof built from measured pilot posture.",
      },
      bestBuyerMotion: {
        audience: "Program officers deciding who merits reputational capital.",
        whyItFits: "Sparse operator time and high trust stakes reward discipline.",
        firstPilotGoal: "Reduce informal sponsorship decisions before outreach.",
      },
      readiness: {
        score: 68,
        stageLabel: "Live pilot proof building",
        breakdown: [
          {
            label: "Governance readiness",
            score: 19,
            maxScore: 25,
            detail: "Blind review, strict evidence, outbound approval, and health are visible.",
          },
        ],
        gaps: ["Capture a measured baseline before the next buyer call."],
        nextMoves: ["Package one positive and one hold outcome."],
      },
      buyerObjections: [
        {
          objection: "This looks like generic workflow software.",
          response: "Keep the pilot anchored on sponsor-facing underwriting calls.",
          proofPoint: "Show one sponsor-ready packet and one held file.",
        },
      ],
      milestones: [
        {
          title: "Pilot launch approved",
          owner: "Program lead",
          detail: "A live slate and written review standard are in place.",
        },
      ],
    });

    expect(parsePilotReviewSharePayload(serializePilotReviewSharePayload(payload))).toEqual(payload);
  });

  it("serializes and parses pilot launch snapshots", () => {
    const payload = buildPilotOnboardingSharePayload({
      kind: "pilot_onboarding",
      title: "Pilot launch · Northline Foundation",
      templateLabel: "Small foundation",
      healthStatus: "degraded",
      pilotProfile: {
        pilotName: "Northline design partner",
        designPartnerName: "Northline Foundation",
        programName: "Emerging Leaders",
        primaryContactName: "Elena Hart",
        primaryContactEmail: "elena@northline.test",
        packSummary: "Launch checklist for a contained design-partner pilot.",
        targetLaunchDateLabel: "April 10, 2026",
      },
      currentSlate: {
        candidateCount: 12,
        sponsorReadyCount: 4,
      },
      launchPosture: {
        guidedDemoMode: true,
        blindReviewMode: true,
        strictEvidenceMode: true,
        requireOutboundApproval: true,
      },
      bestBuyerMotion: {
        audience: "Program officers and small foundations.",
        firstPilotGoal: "Run a contained underwriting pilot on a live slate.",
      },
      designPartnerCommitments: ["One program owner attends the weekly review check-in."],
      launchWorkstream: {
        items: [
          {
            slug: "choose-one-operator-owner",
            index: 0,
            title: "Choose one operator owner",
            detail: "Pick a single operator who will run the slate.",
            defaultOwner: "Program lead",
            currentOwner: "Program lead",
            status: "IN_PROGRESS",
            dueAt: "2026-04-04",
            note: "Owner confirmed; review standard still being finalized.",
            completedAt: null,
            updatedAt: null,
          },
        ],
        summary: {
          total: 4,
          readyCount: 1,
          inProgressCount: 2,
          notStartedCount: 1,
          overdueCount: 0,
          completionRate: 25,
          statusLabel: "In launch prep",
          nextDueAt: "2026-04-04",
          blockers: ["Set the review standard before the first pilot memo."],
        },
      },
      onboardingChecklist: [
        {
          title: "Choose one operator owner",
          owner: "Program lead",
          detail: "Pick a single operator who will run the pilot slate.",
        },
      ],
      stakeholderMap: [
        {
          role: "Program lead",
          detail: "Owns final advancement calls.",
        },
      ],
      calibrationPlaybook: ["Review three seeded files together before touching live candidates."],
      buyerDeliverables: ["Pilot brief and ROI view."],
    });

    expect(parsePilotReviewSharePayload(serializePilotReviewSharePayload(payload))).toEqual(payload);
  });

  it("serializes and parses executive ROI snapshots", () => {
    const payload = buildPilotRoiSharePayload({
      kind: "pilot_roi",
      title: "Executive ROI · Northline Foundation",
      templateLabel: "Small foundation",
      templateSummary: "Best when a foundation team needs a disciplined way to separate promising files from sponsor-ready files.",
      healthStatus: "healthy",
      pilotProfile: {
        pilotName: "Northline design partner",
        designPartnerName: "Northline Foundation",
        programName: "Emerging Leaders",
        primaryContactName: "Elena Hart",
        primaryContactEmail: "elena@northline.test",
        packSummary: "Measured ROI posture for the current pilot.",
      },
      modeled: {
        monthlyHoursRecovered: 18,
        operatorDaysRecovered: 2.3,
        monthlyLaborValue: 7200,
        controlCoverage: 82,
        memoCoverage: 68,
        sponsorReadyCoverage: 42,
        knownOutcomeCoverage: 24,
        workflowPressure: 6,
        disagreementRate: 14,
        positiveOutcomeRate: 60,
      },
      launchPosture: {
        blindReviewMode: true,
        strictEvidenceMode: true,
        requireOutboundApproval: true,
      },
      baseline: {
        capturedAtLabel: "March 1, 2026",
        authorLabel: "Mina Shah",
        note: "Measured before the first live slate review.",
        averageReviewMinutes: 47,
        sampledReviewCount: 8,
      },
      observedDeltas: [
        {
          label: "Memo coverage",
          deltaLabel: "+12 pts",
          currentValueLabel: "68%",
          baselineValueLabel: "56%",
          detail: "More files now reach memo-ready quality.",
          direction: "improved",
        },
      ],
      recentSnapshots: [
        {
          id: "snapshot-1",
          title: "Northline baseline",
          snapshotType: "BASELINE",
          capturedAtLabel: "March 1, 2026",
          authorLabel: "Mina Shah",
          note: "Measured before the first live slate review.",
          averageReviewMinutes: 47,
          sampledReviewCount: 8,
          memoCoverage: 56,
          sponsorReadyCoverage: 28,
          workflowPressure: 9,
        },
      ],
      assumptions: ["Modeled labor savings remain assumptions until more checkpoints exist."],
      health: {
        checkedAtLabel: "March 24, 2026",
        checks: [
          {
            key: "database",
            label: "Database",
            status: "healthy",
            detail: "Primary data store reachable.",
          },
        ],
      },
    });

    expect(parsePilotReviewSharePayload(serializePilotReviewSharePayload(payload))).toEqual(payload);
  });
});
