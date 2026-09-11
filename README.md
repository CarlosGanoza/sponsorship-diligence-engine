# SignalSponsor

SignalSponsor is a demoable SaaS MVP for evidence-backed sponsorship decisions. It helps operators decide when someone is worth sponsoring, not only mentoring, by turning submitted artifacts into structured signals, sponsor-ready conviction memos, and transparent sponsor-match recommendations.

Suggested future brand direction: `Conviction Ledger`. The current codebase and env names stay neutral around the working title.

## Why sponsorship is different from mentorship

Mentorship offers guidance. Sponsorship spends reputational capital. That means the threshold for action is higher: a sponsor needs inspectable evidence, a credible read on risks, and a clear reason why this person is ready for advocacy now.

SignalSponsor is designed to close that gap. It turns resumes, project summaries, mentor notes, recommendations, reflections, and portfolio text into:

- traceable evidence claims
- transparent readiness scoring
- a sponsor memo grounded in cited evidence
- next advocacy actions
- sponsor and warm-path recommendations from a curated graph

## MVP scope

The current MVP includes:

- landing page, dashboard, candidates, sponsors, memo, settings, pipeline, tasks, alerts, analytics, and candidate compare pages
- dedicated pilot-readiness and executive-ROI pages for buyer-facing walkthroughs inside the product
- guided demo route that sequences the recommended buyer walkthrough from underwriting file to memo, brief, outreach, commercial proof, and the measured pilot proof report
- template-specific pilot-launch and onboarding guidance for design-partner rollout preparation
- persisted pilot profile and launch-workstream tracker that carries buyer-facing identity, ownership, and launch status across onboarding, ROI, pilot brief, and demo surfaces
- printable pilot brief page that packages measured proof, governance posture, buyer objections, and ROI framing into one buyer-facing packet
- printable pilot proof report that separates observed pilot movement, calibration posture, and buyer go/hold criteria from modeled ROI assumptions
- share-safe pilot review links for the proof report, buyer pack, commercial proof brief, pilot launch brief, and executive ROI brief, with time-bounded read-only access outside the operator workspace
- commercial-proof page that turns the current workspace into an explicit buyer-readiness scorecard with objections, milestones, and next commercial moves
- measured pilot checkpointing on the ROI page, so observed pilot movement can be compared against a recorded baseline
- operator-entered measured review-time samples on pilot snapshots, so ROI can show true review-time movement alongside workflow deltas
- workspace login with seeded team accounts, password-backed local auth, and protected operator routes
- invite-based teammate onboarding, password-reset links, and per-user session revocation for local review environments
- Prisma + SQLite data model
- seeded fictional demo data
- drag-and-drop or text-paste artifact intake with server-side parsing for `txt`, `md`, `pdf`, and `docx`
- original upload storage with authenticated download access, while keeping raw extracted text as the canonical evidence record
- artifact supersession and version history, so corrected or stronger evidence can replace prior artifact versions without inflating scoring
- bundled OCR for scanned or image-only PDFs, with transparent parsing notes when OCR is used
- mock AI mode that works fully offline
- live OpenAI-backed mode behind a clean service layer
- heuristic readiness and sponsor match scoring with visible breakdowns
- recommendation freshness checks that flag stale sponsor guidance when evidence, sponsor operating context, or live fit drift after generation
- memo traceability, inline artifact citations, and warm-path explanations
- human review states for evidence claims and recommendations, with approve, pending, and flagged notes
- blind review mode for masking identity cues on core review surfaces
- strict evidence mode that pushes weak or unsupported outputs back into review
- evidence-discipline guardrails that compute support coverage, missing proof, potential contradictions, and hold/do-not-advance recommendations
- proof-request workflow that turns missing evidence or contradiction review into tracked operator follow-through
- proof-request reminders plus a candidate-safe secure inbox that shows open asks, reminder history, submission guidance, and SLA-backed due targets
- named review queues that let operators save filter states into reusable candidate worklists
- structured candidate-update submissions that turn new proof into explicit evidence refresh cycles
- bulk review workbench for clearing pending claims and recommendations without line-by-line repetition
- structured opportunity briefs that package sponsor-specific asks, proof sets, and success indicators
- printable internal sponsor packets that bundle memo, evidence, review notes, and warm path by selected sponsor target
- share-safe internal review links for memo and packet snapshots, with time-bounded read-only access outside the main workspace
- request throttling for login attempts, upload parsing, and shared review links so public/demo surfaces are less scrapeable and less brittle under repeated access
- sponsor-specific memo variants that change the memo language by sponsor archetype and target
- sponsor-specific outreach plans with intro framing, meeting agenda, diligence prompts, and follow-up deliverables
- editable sponsor email drafts and CRM handoff exports built from the selected outreach plan
- persisted CRM sync records with safe local outbox fallback, direct HubSpot/Salesforce/Airtable modes, and optional webhook delivery
- editable CRM field mappings and sync-health summaries in Settings so downstream payload shape stays inspectable
- durable background jobs for heavy AI generation, digest delivery, and CRM handoff sync when queue mode is enabled
- sponsor activity tracking for intro requests, meetings, follow-up, and recorded outcomes
- longitudinal progress snapshots that show how readiness, evidence depth, and sponsor fit move over time
- automatic stage transitions and operator alerts driven by trajectory, review state, and sponsor-path activity
- configurable stage-policy thresholds in Settings
- manual stage overrides with justification, persisted stage history, and resumable automation
- alert assignment, due dates, and operator ownership queues
- sponsor pipeline tracking with stage ownership, due dates, next steps, and outcome notes
- operator notes and explicit decision logs that stay separate from AI-generated output
- task creation from alerts plus seeded/manual workflow tasks for operator follow-through
- side-by-side candidate compare view for relative sponsorship decisions
- alert routing controls plus live webhook delivery for email and Slack when configured, with local outbox fallback
- analytics for stage mix, queue ownership, alerts, sponsor activity, CRM sync, and recent stage events
- pilot template configuration and guided demo mode for foundations, fellowships, alumni networks, and leadership teams
- executive ROI modeling that separates observed workflow proof from explicit operating assumptions
- buyer-ready pilot packaging through `/demo`, `/onboarding`, `/pilot/pack`, and `/commercial`
- measured proof-report packaging through `/pilot/report` and `/api/pilot/report` for a single buyer-facing design-partner artifact
- buyer-pack export packaging through `/pilot/pack` and `/api/pilot/pack` so the design-partner packet can be reused outside the live UI
- read-only pilot review sharing through `/pilot/review/[token]`, so proof materials, buyer-readiness briefs, and ROI framing can be opened without a workspace session
- markdown downloads for the proof report and buyer pack so pilot materials can move as readable documents, not only structured JSON
- deployment health checks exposed in Settings, ROI, and `/api/health`
- decision-audit reporting for reviewer disagreement, workflow-pattern inspection, and exportable audit snapshots
- reviewer calibration and outcome-learning analytics tied to real sponsor-path results
- persisted reviewer calibration workspace with owners, due dates, escalation state, and action follow-through beyond passive reporting
- JSON and markdown export surfaces for memo, brief, packet, and outreach views
- unit tests and critical e2e flows

## Local setup

1. Ensure Node is available. In this workspace, Node is activated through `nvm`.
2. Create the env file:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
npm install
```

4. Initialize the database and seed demo data:

```bash
npm run db:push
npm run db:seed
```

5. Start the app:

```bash
npm run dev
```

Then open `http://localhost:3000`.

6. Use one of the seeded demo accounts from `/login` to enter the workspace. The default local password comes from `DEMO_USER_PASSWORD` and defaults to `signalsponsor-demo`.
7. Admins can issue new invite links from `/settings`, and `/reset-password` can issue local password-reset links without requiring email delivery credentials.

## Environment variables

`.env.example` includes:

- `DATABASE_URL`
- `POSTGRES_DATABASE_URL`
- `AUTH_MODE=demo|password`
- `DEMO_USER_PASSWORD`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_MODE=mock|live`
- `FILE_STORAGE_MODE=local`
- `FILE_STORAGE_PATH`
- `BACKGROUND_JOBS_MODE=inline|queue`
- `BACKGROUND_JOBS_POLL_INTERVAL_MS`
- `JOB_RUNNER_TOKEN`
- `CRM_SYNC_MODE=mock|webhook|hubspot|salesforce|airtable`
- `CRM_WEBHOOK_URL`
- `HUBSPOT_CRM_WEBHOOK_URL`
- `SALESFORCE_CRM_WEBHOOK_URL`
- `AIRTABLE_CRM_WEBHOOK_URL`
- `HUBSPOT_ACCESS_TOKEN`
- `SALESFORCE_INSTANCE_URL`
- `SALESFORCE_ACCESS_TOKEN`
- `AIRTABLE_ACCESS_TOKEN`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_NAME`
- `EMAIL_SEND_MODE=mock|webhook|gmail|outlook`
- `EMAIL_SEND_WEBHOOK_URL`
- `GMAIL_SEND_WEBHOOK_URL`
- `OUTLOOK_SEND_WEBHOOK_URL`
- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`
- `GMAIL_OAUTH_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL`
- `OUTLOOK_TENANT_ID`
- `OUTLOOK_OAUTH_CLIENT_ID`
- `OUTLOOK_OAUTH_CLIENT_SECRET`
- `OUTLOOK_OAUTH_REFRESH_TOKEN`
- `OUTLOOK_SENDER_EMAIL`
- `EMAIL_DIGEST_WEBHOOK_URL`
- `SLACK_DIGEST_WEBHOOK_URL`
- `UPLOAD_RATE_LIMIT_WINDOW_MS`
- `UPLOAD_RATE_LIMIT_MAX_REQUESTS`
- `PUBLIC_REVIEW_RATE_LIMIT_WINDOW_MS`
- `PUBLIC_REVIEW_RATE_LIMIT_MAX_REQUESTS`
- `LOGIN_RATE_LIMIT_WINDOW_MS`
- `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`
- `NEXT_PUBLIC_APP_NAME`

## Mock mode

Mock mode is the default and is first-class, not a placeholder.

- If `OPENAI_API_KEY` is missing, the app still works end to end.
- The mock provider deterministically generates evidence claims, memos, next actions, and sponsor-match explanations from submitted artifacts.
- The settings page can toggle between `mock` and `live`. If live mode is selected without a key, runtime safely falls back to mock behavior.
- If live mode returns malformed JSON or another provider error, the AI layer falls back to mock outputs and records the effective runtime mode plus the latest fallback note in Settings.
- AI prompts and local guardrails are intentionally skeptical: they can return `hold` or `do_not_advance`, not only positive next steps.
- Scanned PDFs do not require an API key. They use bundled local OCR with packaged English language data.
- CRM sync behaves similarly: the app works fully without a webhook or native CRM credentials, and handoffs are still recorded to the local outbox with explicit runtime notes.
- Gmail and Outlook delivery can use native OAuth credentials when configured, but still degrade safely to stored outbound records when recipient email or provider credentials are missing.
- Alert digests also degrade safely. Without digest webhook URLs, delivery records still land in the local outbox so queue state remains inspectable.
- Background jobs default to inline mode locally, so the app still works with no worker process. Queue mode can be enabled in Settings or env when you want durable async execution.
- Original upload storage also works locally with no external object store. Stored files live under `FILE_STORAGE_PATH` and stay organization-scoped.
- Login, upload parsing, and shared internal review links now have simple in-app throttling. Defaults are tuned for local demos, and Settings makes the active limits inspectable.

## Demo data

The repo ships with a curated fictional dataset:

- 10 candidates
- 14 sponsors
- 30 artifacts
- extracted evidence claims generated during seed
- relationship graph edges across candidates, mentors, operators, and sponsors
- seeded memos and recommendations
- seeded human review states across claims and recommendations

## Workflow status behavior

- Memo generation uses explicit status states: `not started`, `processing`, `ready`, and `needs review`.
- The settings page shows both the configured AI mode and the last effective runtime mode.
- The candidate review surfaces distinguish between strong sponsor targets and directional matches that still need more proof.
- If a PDF lacks selectable text, the parser runs OCR on the first 4 pages and surfaces a parsing note in the intake form.
- Evidence claims and recommendations each carry a separate human review state. Regenerating them resets review back to pending on purpose.
- Candidate detail now includes an evidence-discipline panel that shows support coverage, missing proof, contradiction signals, caution flags, and a guardrail decision.
- Candidate detail also shows the latest human underwriting call beside the current guardrail so operators can inspect disagreement at the file level.
- Candidate workflow now includes proof requests with assignees, due dates, task conversion, and resolution notes so evidence gaps become explicit work.
- Candidate workflow now also includes structured update submissions, linked proof-request resolution, and incorporation state so new evidence does not disappear into generic notes.
- Candidate index now supports named queues that persist filtered review views for repeated operator use.
- Candidate workflow now includes a bulk review workbench for pending claims and recommendations when the operator needs throughput instead of sentence-level inspection.
- Candidate detail now also shows outcome-learning pressure from similar evidence/readiness buckets when the workspace has enough sponsor-result history to justify it.
- Recommendation surfaces now show freshness state so operators can see when stored guidance is fresh, drifting, or stale against the live sponsor context.
- Blind review mode masks candidate names, headlines, and regions on the main review surfaces.
- Strict evidence mode pushes memo outputs into `needs review` when proof is weak or unsupported.
- Internal sponsor packets can be switched across top sponsor targets without rerunning generation.
- Sponsor-specific memo variants can be previewed from sponsor-fit cards and sponsor detail views, while keeping the base memo intact.
- Opportunity briefs can be filtered centrally and switched across sponsor targets from a single candidate route.
- Outreach plans derive from opportunity briefs and package the exact intro request, meeting goal, evidence set, and follow-up sequence for operators.
- Outreach plans now include editable email drafts plus JSON/CSV CRM handoff exports so operators can move from internal diligence into execution without rewriting the case.
- CRM sync records and sponsor activity events are persisted and visible in outreach, sponsor, dashboard, and settings surfaces.
- Candidate dashboards now track conviction movement over time with seeded history plus automatic snapshots after intake, evidence refreshes, memo generation, recommendations, and outbound ops events.
- Candidate stages now update automatically from transparent heuristics, and open operator alerts can be reviewed and resolved from the dashboard, alerts center, or candidate detail page.
- Manual stage overrides pause automation cleanly, persist operator justification, and leave a stage-event audit trail before automation is resumed.
- Sponsor pipeline items are persisted separately from recommendations so operators can track ownership, timing, and outcomes as a sponsor path becomes real work.
- Candidate workflow tabs now include operator notes, explicit decision logs, sponsor pipeline items, and candidate-specific tasks.
- Alerts can now be converted directly into operator tasks, and the seeded demo includes active task and pipeline queues out of the box.
- Candidate compare brings readiness, movement, top sponsor, strongest proof, and workflow load into one side-by-side review surface.
- Demo seed includes recent alert-digest deliveries so routing and outbox behavior are visible immediately.
- Workspace settings now expose automation thresholds, team membership, and digest webhook readiness.
- Settings now also expose CRM field mappings, grouped CRM sync health, and queue-mode runtime posture.
- Protected routes now authenticate through seeded workspace accounts on `/login`, and analytics surfaces summarize queue ownership, stage health, and outbound ops activity.
- Pilot posture can now be switched in Settings, and the workspace includes dedicated `/pilot` and `/roi` routes for buyer walkthroughs and assumption-labeled ROI framing.
- ROI now includes measured baseline/checkpoint snapshots so pilot movement can be recorded inside the workspace instead of living only in modeled assumptions.
- ROI snapshots now also accept operator-entered average review minutes and sample sizes, so measured pilot proof can include real review-time movement rather than only workflow-state deltas.
- Settings and ROI now surface deployment health, and `/api/health` returns the same JSON snapshot for hosted checks.
- Dashboard and candidate workflow routes now surface recent queued work so operators can see pending or recoverable background jobs without leaving the primary review flow.
- Proof requests now carry transparent SLA targets, overdue/due-soon status, and default policy-based due dates when the operator does not set one manually.
- The audits page tracks reviewer disagreement, decision coverage, and pattern breakdowns by stage, evidence depth, review state, and region, with JSON/CSV export.
- Analytics now includes reviewer calibration and outcome-learning sections so teams can see which override patterns actually led to positive or negative sponsor results.
- Memo, brief, packet, and outreach routes can all be exported as structured files for downstream review or handoff.
- Memo and packet routes can now generate time-bounded read-only review links for internal sharing without exposing the rest of the operator workspace.
- Pilot proof-report and buyer-pack routes can now generate the same style of time-bounded read-only links for design-partner review without exposing the operator workspace.

Reset demo data at any time:

```bash
npm run db:reset
```

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run db:push
npm run db:generate:postgres
npm run db:push:postgres
npm run db:reset:postgres
npm run db:seed
npm run db:reset
npm run jobs:run
npm run jobs:work
```

## Screenshots

Placeholders for future review assets:

- `docs/screenshots/landing-page.png`
- `docs/screenshots/dashboard.png`
- `docs/screenshots/candidate-detail.png`
- `docs/screenshots/memo-print-view.png`
- `docs/screenshots/opportunity-brief.png`
- `docs/screenshots/outreach-plan.png`
- `docs/screenshots/outreach-email-workbench.png`
- `docs/screenshots/crm-sync-and-activity.png`
- `docs/screenshots/candidate-trajectory.png`
- `docs/screenshots/operator-alerts.png`
- `docs/screenshots/alerts-center.png`
- `docs/screenshots/sponsor-pipeline.png`
- `docs/screenshots/operator-tasks.png`
- `docs/screenshots/candidate-compare.png`
- `docs/screenshots/evidence-discipline.png`
- `docs/screenshots/decision-audits.png`
- `docs/screenshots/pilot-readiness.png`
- `docs/screenshots/executive-roi.png`
- `docs/screenshots/pilot-measurements.png`
- `docs/screenshots/deployment-health.png`

## Architecture notes

- `app/`: App Router pages and server actions
- `components/`: UI primitives and feature components
- `lib/ai/`: mock/live providers, schemas, and orchestration pipeline
- `lib/scoring/`: sponsor readiness and sponsor-match heuristics
- `lib/db/`: Prisma client and read-model queries
- `lib/storage/`: local file storage provider and download access helpers
- `lib/jobs/`: durable background job queue and worker handlers
- `lib/seed/`: curated demo dataset and seed runner
- `prisma/`: schema and seed entrypoint
- `tests/`: unit and e2e coverage

More detail lives in:

- [`docs/architecture.md`](./docs/architecture.md)
- [`docs/deployment.md`](./docs/deployment.md)
- [`docs/product-spec.md`](./docs/product-spec.md)
- [`docs/future-roadmap.md`](./docs/future-roadmap.md)
- [`AGENTS.md`](./AGENTS.md)

## Next steps roadmap

- Postgres-backed deployment path for stateless hosting
- production-grade auth beyond local seeded demo accounts
- deeper CRM sync destinations and bidirectional status reconciliation
- richer graph reasoning and sponsor-path analytics
- outbound draft approval workflows and assignee-level SLA escalation
- sponsor portfolio views, compare presets, and richer queue routing policies across candidates, tasks, and pipeline
- deeper fairness review exports, reviewer calibration workflows, and disagreement resolution history
- multilingual OCR and richer link ingestion
- richer sponsor funnel, operator workload, and conversion reporting
