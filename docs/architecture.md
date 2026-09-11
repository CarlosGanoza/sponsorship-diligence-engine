# Architecture

## Overview

SignalSponsor is a monolithic Next.js App Router application designed for a polished MVP. The architecture prioritizes:

- explainability
- deterministic demo reliability
- minimal operational overhead
- a clean path from mock mode to live AI mode

## Major layers

### App layer

`app/` holds server-rendered pages and server actions. Pages focus on presentation and orchestration, while writes flow through `app/actions.ts`.

### UI layer

`components/` contains local shadcn-style primitives plus feature components for dashboards, candidates, sponsors, memos, and settings.

The printable packet, brief, outreach, and memo surfaces live alongside the rest of the UI so they can reuse the same evidence, review, and recommendation read models.

### Data access layer

`lib/db/prisma.ts` exposes the Prisma singleton.

`lib/db/queries.ts` builds read models for:

- dashboard KPIs
- candidate detail views
- sponsor directory views
- settings status
- pilot configuration status
- analytics summaries
- sponsor pipeline queue
- operator task queue
- candidate compare views
- sponsor packet, opportunity brief, outreach, and memo routes via the shared candidate detail read model

### Workspace and session layer

`Organization`, `OrganizationMembership`, and `AppSession` provide a simple workspace model for the operator console.

The app is still an MVP, but most operator-facing queries now scope by `organizationId` so seeded team accounts, alerts, candidates, sponsors, and graph edges all resolve inside the current workspace session.

`lib/auth/session.ts` owns session creation, cookie management, and route protection.

### Review layer

`lib/review/` holds deterministic helpers for summarizing human review state.

Evidence claims and recommendations each carry their own review status, review note, and review timestamp. This keeps model output separate from operator judgment while still making approval and flagging visible in the UI.

### Safety layer

`lib/safety/guardrails.ts` computes an evidence-discipline report over artifacts, claims, memos, and current recommendations. It audits memo support coverage, identifies missing proof, detects potential contradictions in the evidence base, surfaces caution flags, and can downgrade the system's stance from `advance` to `hold` or `do_not_advance`.

`lib/recommendations/freshness.ts` evaluates whether stored recommendation rows are still trustworthy against the latest evidence file and live sponsor operating context. Candidate detail, dashboard, and pipeline views use the same freshness report so operators can see when a stored recommendation is fresh, drifting, or stale before acting on it.

`lib/safety/settings.ts` persists operator controls such as blind review mode and strict evidence mode.

### Audit layer

`lib/audits/report.ts` builds a reusable decision-audit view over the current file state. It compares the latest human underwriting decision to the current evidence guardrail, classifies disagreement direction, and aggregates pattern breakdowns by stage, region, evidence depth, and review state.

`app/audits/page.tsx` exposes that read model as an operator-facing review surface, while `app/api/audits/export/route.ts` exposes JSON and CSV exports for offline review and governance workflows.

`lib/proof-requests/` turns missing-proof and contradiction signals into first-class workflow records with assignees, SLA-backed due targets, task conversion, reminder history, and resolution notes. This keeps “request more proof” from collapsing into a generic note or stale decision log.

`CandidateUpdate` records preserve the return path after a proof request or informal follow-up. They link structured update submissions back to the refreshed artifact text, operator attribution, and incorporation state so new evidence can be reviewed as part of the underwriting file instead of living as an uncited note.

Proof requests also carry reminder history. Candidate-safe update routes can show open asks, reminder cadence, and submission guidance without exposing internal memo language or sponsor judgment.

`lib/calibration/report.ts` derives reviewer calibration and outcome-learning signals from the same decision-audit rows plus persisted sponsor activity and pipeline outcomes. It does not mutate the core guardrail; it adds transparent pressure where similar override patterns have historically worked or failed.

`lib/calibration/workspace.ts` turns those reviewer-calibration signals into a persisted operating workstream with owners, due dates, escalation state, and completion history. `/calibration` is intentionally separate from `/analytics`: analytics explains what is happening, while the calibration workspace records what the team is doing about it.

### Progress layer

`lib/progress/` captures immutable candidate progress snapshots at key workflow points such as intake, evidence refresh, memo generation, recommendation refresh, CRM sync, and sponsor activity logging.

The trajectory layer is persisted so the dashboard and candidate detail page can show how readiness, evidence depth, and sponsor fit have moved over time instead of rendering a client-only chart from current state.

### Automation layer

`lib/automation/` evaluates candidate stage from transparent rules over readiness, review friction, trajectory movement, brief/memo readiness, and live sponsor-path activity.

This layer also creates persisted operator alerts so stage changes, blockers, outreach-ready files, stalled trajectories, and manual overrides appear in the product as inspectable state rather than hidden server-side logic.

Manual stage overrides are stored separately from automated stage moves through `CandidateStageEvent` records. That keeps human intervention auditable without discarding the current automation rationale.

`lib/alerts/digest.ts` turns open alerts into delivery records for email, Slack, and ops-queue digests. When webhook URLs are absent, the system falls back to a local outbox so operators can still inspect routing decisions and digest payload summaries.

### Workflow layer

`lib/workflow/pipeline.ts` materializes `BEST_SPONSOR` recommendations into durable `SponsorPipelineItem` records. These records are where ownership, due dates, next steps, and sponsor-path stage movement live.

`lib/workflow/tasks.ts` turns operator alerts into owned `OperatorTask` records and manages lightweight task state transitions.

Proof requests can also materialize into tasks, but they remain a separate persistence object because the evidence gap itself is part of the underwriting record.

`SavedView` records persist reusable candidate queues. They capture normalized filter state at the workspace level so operators can reopen stable review slices without relying on browser history or ad hoc personal bookmarks.

Candidate-authored human context is stored separately through `CandidateNote` and `CandidateDecision` so operator judgment remains inspectable without mutating memo or recommendation output.

### Pilot layer

`lib/pilot/templates.ts` centralizes buyer-facing pilot posture, onboarding checklists, stakeholder maps, calibration playbooks, printable pilot-brief content, commercial objections, and ROI modeling. It deliberately keeps pilot framing explicit and assumption-labeled, so `/onboarding`, `/pilot`, `/demo`, `/pilot/pack`, `/commercial`, and `/roi` can reuse the same template definitions without inventing a second product story or hiding unsupported economics in the UI.

`lib/pilot/measurements.ts` captures workspace-level pilot snapshots as narrow baseline/checkpoint records. These records preserve observed operating movement, including optional operator-entered review-time samples, without mutating candidate history or inventing customer outcomes that have not happened.

`lib/pilot/commercial.ts` turns current workspace state into a transparent commercial-readiness scorecard. It scores buyer packaging, governance readiness, operating proof, measured learning, and buyer signal without pretending to measure real market demand.

`lib/pilot/workspace.ts` keeps the buyer-facing pilot profile and launch-workstream state explicit. That lets onboarding, guided demo, ROI, commercial proof, and the pilot brief all describe the same design-partner deployment instead of each page inventing its own narrative.

`lib/pilot/report.ts` turns those same inputs into one measured proof artifact. `/pilot/report` is intentionally narrower than a general analytics view: it packages observed workflow movement, calibration posture, go/hold criteria, and modeled assumptions into a single design-partner report and keeps the observed-versus-modeled boundary explicit.

`lib/pilot/pack.ts` takes that measured proof artifact and reshapes it into the buyer packet used by `/pilot/pack` and `/api/pilot/pack`. The distinction matters: the proof report is the sober measurement view, while the buyer pack is the packet an operator can hand to a real design partner without manually assembling multiple pages.

`lib/pilot/share.ts` is the controlled public-review boundary for buyer-facing pilot materials. It now serializes time-bounded read-only payloads for the proof report, buyer pack, commercial proof brief, pilot launch brief, and executive ROI brief so external sharing does not require exposing the broader operator workspace.

Both pilot export routes now support JSON and markdown. JSON preserves structured downstream use, while markdown gives operators a portable document format without introducing a second templating system.

`lib/pilot/share.ts` serializes proof-report and buyer-pack snapshots into time-bounded read-only review payloads for `/pilot/review/[token]`. This keeps design-partner review sharing separate from workspace auth while still avoiding a second rendering system.

### Review sharing layer

`lib/review/share.ts` serializes memo and packet snapshots into time-bounded read-only review payloads. These snapshots are intentionally narrower than the live workspace and power `/review/[token]` without exposing broader operator state.

### Memo variant layer

`lib/memo/variant.ts` builds sponsor-specific memo variants from the existing memo, sponsor match data, selected evidence claims, and sponsor archetype. This avoids a second persistence model while still changing the memo language meaningfully by sponsor target.

### Opportunity and outreach layer

`lib/opportunities/` packages sponsor-targeted opportunity briefs and persists them as first-class records so the dashboard, candidate detail page, sponsor detail page, and brief list can all reuse the same ask package.

`lib/outreach/plan.ts` derives sponsor-specific outreach plans from the selected opportunity brief, memo variant, warm path, and sponsor fit breakdown.

`lib/outreach/email.ts` builds editable outbound drafts from the current outreach plan.

`lib/outreach/handoff.ts` builds a structured CRM handoff record plus CSV serialization, while `app/api/outreach/[candidateId]/handoff/route.ts` exposes the JSON/CSV export surface.

`app/api/exports/[candidateId]/route.ts` provides structured export surfaces for memo, brief, packet, and outreach routes.

`lib/crm/provider.ts` handles resilient CRM sync execution. It supports a local mock outbox by default, native HubSpot/Salesforce/Airtable sync when credentials exist, and provider-specific webhook compatibility, while persisting effective runtime mode and fallback notes into `AppSetting`.

`lib/crm/mappings.ts` keeps downstream field mappings explicit. Settings surfaces edit provider-specific JSON mappings, and sync execution remaps payload fields through those mappings before native or webhook delivery.

`lib/outreach/sender.ts` follows the same pattern for outbound email. It supports local outbox mode by default, webhook adapters when configured, and native Gmail/Outlook delivery when OAuth credentials and recipient email are present.

### Runtime health layer

`lib/runtime/health.ts` provides a deployment-health snapshot over database access, AI configuration, CRM sync posture, digest delivery posture, and bundled OCR availability. The same read model is used in Settings, ROI, and `/api/health`.

`lib/runtime/rate-limit.ts` adds a small, explicit in-process throttle for login attempts, upload parsing, and public review-share access. It is intentionally simple for MVP deployment hardening and should be treated as a local safeguard, not a substitute for edge/network-layer rate limiting in a larger hosted environment.

Outreach plans and email drafts are intentionally generated on demand so the brief remains the durable internal artifact and the outbound framing stays easy to revise.

### AI layer

`lib/ai/` is split into:

- `schemas.ts`: Zod contracts for structured outputs
- `mock.ts`: deterministic provider used offline
- `live.ts`: OpenAI-backed provider
- `pipeline.ts`: extraction, memo generation, and recommendation orchestration

The rest of the app should call the pipeline, not providers directly.

### Scoring layer

`lib/scoring/` contains transparent heuristics:

- sponsor readiness scoring
- sponsor-match scoring

These functions are intentionally simple and inspectable so the UI can show breakdowns directly.

### Seed layer

`lib/seed/demo-data.ts` contains curated fictional demo records.

`lib/seed/run-seed.ts` resets the database, inserts records, runs extraction, generates seeded memos, and computes recommendations.

## Data model

Core Prisma models:

- `Candidate`
- `Artifact`
- `EvidenceClaim`
- `Sponsor`
- `RelationshipEdge`
- `SponsorMemo`
- `Recommendation`
- `OpportunityBrief`
- `CrmSyncRecord`
- `StoredFile`
- `BackgroundJob`
- `SponsorActivity`
- `CandidateProgressSnapshot`
- `CandidateNote`
- `CandidateDecision`
- `SponsorPipelineItem`
- `OperatorTask`
- `OperatorAlert`
- `CandidateStageEvent`
- `AlertDigestDelivery`
- `PilotMetricSnapshot`
- `CandidateUpdate`
- `SavedView`
- `User`
- `Organization`
- `OrganizationMembership`
- `AppSession`
- `AppSetting`

`EvidenceClaim` and `Recommendation` also carry explicit human review fields so demo and live workflows can represent approved, pending, and flagged operator decisions.

SQLite compatibility is preserved so the MVP can run locally with minimal setup. The structure is still credible for later migration to Postgres.

## Runtime behavior

### Mock mode

- default when no API key exists
- deterministic
- good enough for offline demos and tests

### Live mode

- toggled through `AppSetting`
- uses OpenAI via `lib/ai/live.ts`
- still validates every response with Zod
- should fall back to mock behavior if the key is unavailable

### File storage

- original uploads are stored through `StoredFile`
- the stored file is an operator-inspectable attachment, not the evidence source of truth
- extracted `rawText` remains the canonical input for AI, scoring, and memo generation
- the local MVP storage provider writes into `FILE_STORAGE_PATH` and serves files back through authenticated API routes
- artifact supersession/versioning keeps corrected uploads visible as audit history while scoring and evidence-backed read models use only current artifact versions by default

### Background jobs

- queue mode is controlled through `AppSetting` or env
- `BackgroundJob` is the durable queue record for heavy work such as evidence extraction, memo generation, recommendation generation, digest delivery, and CRM handoff sync
- inline mode remains the default so local demos do not require a separate worker
- queue mode can be drained through `npm run jobs:work`, `npm run jobs:run`, or a protected `/api/jobs/run` trigger
- dashboard, candidate detail, and settings surfaces expose queued or retryable work so async state is visible without opening a separate ops console

## Key tradeoffs

- Arrays are stored as delimited strings in SQLite-friendly fields for MVP simplicity.
- Relationship edges are modeled generically instead of fully normalized because the graph is curated and small in v1.
- Recommendation explanations are persisted to the database so seeded and generated demo flows both feel complete.
- Human review is stored directly on claims and recommendations so operators can override or hold model outputs without mutating the underlying evidence text.
- Evidence-discipline guardrails are computed, not persisted, because they should reflect the latest combination of proof, review state, and generated memo language.
- Sponsor packets are assembled from existing memo, evidence, review, and sponsor-match records rather than triggering a second AI generation path.
- Sponsor-specific memo variants are generated on demand from the same underlying evidence and recommendation set, so the base memo remains stable while targeted framing can change.
- Opportunity briefs are persisted because they represent a stable internal ask package that should be searchable, filterable, and reviewable across candidates and sponsors.
- Outreach plans are not persisted because they are lightweight operator packaging built from the brief and current sponsor context.
- CRM handoff exports are generated, not stored, because they are downstream transport artifacts rather than core product state.
- CRM sync records are stored because the sync attempt itself is part of the operator audit trail.
- Stored files are stored separately from artifacts because the original upload should remain downloadable for audit and operator review without polluting the evidence-processing layer with binary state.
- Background jobs are stored because durable async work needs visible status, retry behavior, and hosted execution paths beyond the request lifecycle.
- Sponsor activity records are stored separately from CRM syncs so teams can track introductions, meetings, follow-up, and outcomes even when no external CRM is configured.
- Candidate progress snapshots are stored because longitudinal conviction change is part of the product narrative and should survive refreshes, demo resets, and later analytics work.
- Candidate notes and decision logs are stored because underwriting judgment should be attributable, durable, and distinct from model output.
- Sponsor pipeline items are stored because a sponsor match becomes real operator work only after ownership, timing, and next-step state exist.
- Operator tasks are stored because alerts alone are not enough once work must be assigned, tracked, and closed.
- Operator alerts are stored because stage automation should leave an inspectable audit trail and create actionable queue items for human operators.
- Candidate stage events are stored because manual overrides and automation resumes should be auditable separately from the current candidate row.
- Alert digest deliveries are stored because routing decisions are part of the operator workflow even before real external notification delivery exists.
- Workspace memberships and sessions are stored because protected operator routes, alert ownership, and team-level analytics are now part of the product surface.
