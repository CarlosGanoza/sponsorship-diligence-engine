# Product Spec

## Product thesis

SignalSponsor helps influential people and institutions decide when someone is worth sponsoring, not only mentoring.

This is:

- an evidence-backed review workspace
- a conviction-building tool for operators and sponsors
- a traceable recommendation layer over candidate evidence and relationship context

This is not:

- a mentorship app
- a LinkedIn clone
- a CRM

## Primary users

- talent program operators
- fellowship and scholarship teams
- alumni network operators
- leadership development teams
- small foundations and nonprofits
- senior sponsors who want better signal before advocating

## Core workflow

1. Candidate submits artifacts.
2. Operators work inside a shared workspace with traceable team sessions.
3. The system extracts structured evidence claims.
4. An operator can review, approve, or flag the extracted signals.
5. The system generates a sponsor-ready memo.
6. The system recommends the best next advocacy action and sponsor path.
7. The system packages the best sponsor-specific opportunity brief.
8. The system turns that brief into an outreach plan the operator can actually use.
9. The system drafts sponsor-facing emails and structured CRM handoff data from that same plan.
10. The system records CRM sync state and sponsor activity so the advocacy path remains operationally visible.
11. The system preserves progress snapshots so operators can see whether conviction is compounding or stalling over time.
12. The system automatically updates candidate stage and raises operator alerts when trajectory or review state materially changes the case.
13. Operators can assign alerts, set due dates, and tune stage-policy thresholds without code changes.
14. Operators can pause automation with a justified manual stage override and later resume the rule engine.
15. Open alerts can be bundled into inspectable digest deliveries for email, Slack, and internal ops routing.
16. Recommended sponsors become durable pipeline items with owners, next steps, and stage progression.
17. Operators can turn alerts into explicit tasks and keep candidate-specific notes and decisions alongside the file.
18. Relative decisions can be made in a side-by-side compare view instead of only one candidate at a time.
19. The system can say hold or do not advance when proof is weak, unsupported, or contradicted by review friction.
20. Operators can optionally hide identity cues during review through blind review mode.
21. Operators can inspect where human underwriting decisions diverge from the current evidence guardrail and export that audit state for review.
22. Missing proof and contradiction review can be opened as explicit proof requests with owners, due dates, task conversion, and resolution notes.
23. Reviewer calibration and outcome learning connect disagreement patterns back to actual sponsor outcomes so the team can see where overrides were justified and where thresholds should tighten.
24. Reviewer calibration is also an operating workflow, not just a chart: reviewers can be assigned, escalated, and tracked through explicit calibration follow-through.
24. Operators can save reusable candidate queues from the current filter state instead of rebuilding the same review slices repeatedly.
25. New evidence can be submitted through a structured candidate-update workflow that links refreshed artifacts back to proof requests and incorporation status.
26. Original files can be stored alongside artifacts so operators can inspect the source document while the system still reasons only over extracted text.
27. Pending claims and recommendations can be reviewed in bulk when the operator needs throughput on a stable file segment.
28. Operators can switch the product into a pilot template for foundations, fellowships, alumni networks, or leadership teams without changing the underlying workflow.
29. The workspace includes a guided pilot route and an explicit executive ROI surface that separates observed workflow proof from modeled assumptions.
30. Operators can capture pilot baselines and checkpoints so measured workflow movement is preserved inside the workspace over time.
31. Pilot snapshots can also store operator-entered review-time samples so the ROI view can compare workflow-state movement with true measured review-time movement.
32. Memo and packet routes can generate time-bounded read-only review links for internal sharing without exposing the rest of the workspace.
33. Deployment health is inspectable in-product and via `/api/health` for hosted pilot readiness checks.
34. Heavy work can run through a durable background-job queue when hosted execution should not depend on a single request lifecycle.
35. The workspace includes a commercial-proof route that turns the current pilot into a buyer-readiness scorecard with explicit objections, milestones, gaps, and next sales moves.
36. A guided demo route sequences the recommended buyer walkthrough and reuses the same pilot profile, launch workstream, commercial proof, and measured proof-report surfaces instead of relying on operator memory.
37. Pilot identity and launch-readiness state are persisted so onboarding, ROI, commercial proof, and the pilot brief all describe the same buyer-facing deployment.
38. A measured pilot proof report consolidates observed movement, calibration posture, go/hold criteria, and modeled assumptions into one buyer-facing artifact instead of forcing operators to stitch those claims together manually.
39. The pilot brief now acts as a buyer packet built from the same proof-report data, so design-partner materials can move as a single packet rather than separate pages.
40. Pilot proof and buyer-pack exports support markdown as well as JSON so operators can reuse those artifacts outside the live workspace without rewriting them.
41. Pilot proof-report and buyer-pack routes can also generate time-bounded read-only review links so design-partner materials can be reviewed without granting workspace access.

## Product principles

- explainability first
- trust over hype
- human-in-the-loop
- evidence-backed outputs only
- inspectable recommendations
- privacy-conscious language
- no fake certainty

## MVP features

- candidate profile intake
- workspace login with seeded team accounts
- text-first artifact capture
- original-file storage with protected download access
- evidence extraction
- human review states for claims and recommendations
- sponsor memo generation
- structured opportunity briefs
- sponsor-specific internal review packets
- sponsor-specific memo variants
- sponsor-specific outreach plans
- editable outreach email drafts
- CRM handoff export
- CRM sync with safe fallback
- sponsor activity tracking
- longitudinal progress tracking
- automatic stage transitions and operator alerts
- configurable stage-policy settings
- alert assignment and due dates
- sponsor pipeline queue and candidate-level sponsor pipeline tracking
- task queue with alert-to-task conversion
- operator notes and decision log
- candidate compare page
- evidence-discipline guardrails and blind review controls
- contradiction detection and proof-request workflow
- named review queues, structured candidate updates, and bulk review workbench
- pilot-readiness and executive ROI surfaces for buyer-facing evaluation
- guided demo route with buyer talk track and sequenced proof walkthrough
- pilot-launch onboarding and printable pilot brief surfaces for design-partner rollout
- persisted pilot profile and launch-workstream tracker for buyer-facing packaging and launch execution
- commercial-proof surface for buyer objection handling and design-partner readiness framing
- measured pilot proof-report surface for a single buyer-facing design-partner packet
- buyer-pack pilot brief with JSON export for design-partner review packets
- share-safe pilot review links for proof-report, buyer-pack, commercial-proof, pilot-launch, and executive-ROI snapshots
- measured pilot checkpoints and deployment health reporting
- decision audits for disagreement tracking and pattern inspection
- reviewer calibration and outcome-learning analytics
- manual stage override history with operator justification
- alert routing controls, delivery records, and optional live webhooks
- durable background jobs with inline or queue execution modes
- analytics dashboard for stage mix, queue ownership, and outbound ops activity
- memo, brief, packet, and outreach export surfaces
- curated sponsor directory
- relationship graph
- recommendation engine
- admin dashboard
- settings page for AI mode and demo reset
- printable memo page

## Non-goals

- unreviewed bulk outbound email automation
- LinkedIn scraping
- deep bidirectional CRM integration
- billing
- enterprise permissions
- mobile app

## Success criteria

- boots locally with a short command sequence
- seeded demo works without an API key
- seeded team accounts can enter a protected workspace locally
- candidates and sponsors are navigable
- sponsor memos are viewable and printable
- evidence behind recommendations is inspectable
- the interface feels serious and credible
