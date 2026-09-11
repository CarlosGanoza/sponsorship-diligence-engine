# AGENTS.md

## Project overview

SignalSponsor is a full-stack Next.js MVP for evidence-backed sponsorship decisions. It is intentionally positioned as underwriting for human potential rather than mentorship, social networking, or CRM.

Core system layers:

- Prisma + SQLite domain model
- seeded fictional demo data
- workspace-scoped organizations, memberships, password-backed local auth, and server-backed sessions
- invite-based workspace onboarding, password-reset links, and revocable per-user sessions for local review environments
- AI abstraction with deterministic mock mode and optional live OpenAI mode
- transparent heuristic scoring
- explainable UI for evidence, memos, sponsor fit, and warm paths
- explicit human review states for evidence claims and recommendations
- evidence-discipline guardrails that can force hold or do-not-advance recommendations
- contradiction detection and structured proof requests for missing evidence follow-through
- artifact supersession/version history plus proof-request reminders, SLA-backed due targets, and candidate-safe update inbox behavior
- named candidate review queues and structured candidate-update submissions
- bulk review workbench for pending claims and recommendations
- blind review mode that masks candidate identity cues on primary review pages
- strict evidence mode that downgrades weak or unsupported outputs into review
- reviewer disagreement and decision-audit reporting with JSON/CSV export
- reviewer calibration and outcome-learning analytics tied to sponsor-path results
- reviewer calibration workspace that persists owners, due dates, escalation state, and follow-through on top of the analytics layer
- measured pilot proof report that packages observed movement, calibration posture, buyer go/hold criteria, and modeled assumptions into one design-partner artifact
- buyer-pack pilot brief that reuses the measured proof report and adds a structured export for design-partner packet sharing
- share-safe pilot review links for the proof report, buyer pack, commercial proof brief, pilot launch brief, and executive ROI brief, with time-bounded read-only access outside the workspace
- printable internal sponsor packets for selected sponsor targets
- sponsor-specific memo variants that reuse the same evidence base with different sponsor lenses
- structured opportunity briefs for sponsor-targeted asks
- sponsor-specific outreach plans that turn a brief into an operator-ready intro sequence
- editable email drafts and CRM handoff exports derived from the outreach plan
- persisted CRM sync records with local-outbox fallback, native provider sync, and optional webhook delivery
- editable CRM field mappings, grouped sync-health reporting, and visible queue/runtime status in Settings
- sponsor activity tracking tied to candidate-sponsor paths
- longitudinal candidate progress snapshots that preserve conviction movement over time
- recommendation freshness checks that flag stale guidance when evidence, sponsor operations, or live fit drift after generation
- automatic stage transitions and operator alerts tied to trajectory, review state, and sponsor-path activity
- configurable automation policy thresholds stored in app settings
- manual stage overrides with justification and persisted stage-event history
- alert assignment, due dates, and operator ownership queues
- sponsor pipeline items with explicit owners, due dates, next steps, and outcome notes
- operator tasks created from alerts or manual workflow follow-through
- candidate workflow notes and explicit decision logs that remain separate from AI output
- candidate compare views for side-by-side sponsorship calls
- digest routing with live email/Slack webhooks when configured, plus inspectable local outbox fallback
- analytics views for stage mix, queue ownership, sponsor activity, CRM syncs, and recent stage events
- pilot-readiness and executive ROI surfaces driven by explicit workspace settings and assumption-labeled modeling
- guided-demo route that packages the recommended buyer walkthrough from live file to commercial proof
- pilot-profile and launch-workstream state that carries buyer-facing identity, ownership, and launch readiness across onboarding, demo, ROI, and pilot brief surfaces
- pilot-launch onboarding and printable pilot-brief surfaces for design-partner rollout packaging
- commercial-proof surface with buyer objections, milestone framing, and an explicit commercial-readiness scorecard
- measured pilot baseline/checkpoint snapshots, operator-entered review-time samples, and deployment-health reporting for hosted pilot readiness
- share-safe internal review links for memo and packet snapshots
- share-safe pilot review links for proof-report, buyer-pack, commercial-proof, pilot-launch, and ROI snapshots
- request throttling for login, upload parsing, and shared review links

## Required commands

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
npm run jobs:run
```

Validation commands before finishing work:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Coding style

- Prefer readable server-first code.
- Keep business logic in `lib/`, not embedded in pages.
- Use Zod for inputs and AI outputs.
- Keep UI copy precise, sober, and executive-friendly.
- Default to simple, inspectable heuristics over hidden magic.
- Keep uploaded artifact parsing text-first in storage. File parsing should populate inspectable raw text, not introduce opaque binary workflows into the rest of the app.
- Scanned PDFs are handled through bundled local OCR. Preserve the inspectable raw-text output and keep OCR behavior transparent in UI copy and source labels.
- Original uploaded files are now stored separately through `StoredFile`. Preserve that operator-inspectable file layer without making the evidence/scoring pipeline depend on opaque binaries.
- Keep the rate-limit layer explicit and inspectable. It is a lightweight platform safeguard, not a hidden anti-user gate.
- Use existing muted palette and layout language; do not turn the product into a social feed or flashy startup landing page.

## Testing requirements

- Add or update unit tests for scoring and AI schema changes.
- Add e2e coverage when changing critical operator workflows.
- Do not mark work complete without running lint, typecheck, tests, and build if the change touches runtime paths.
- If you regenerate evidence claims or recommendations, make sure the human review state resets cleanly to pending.

## Architecture constraints

- Keep the app monolithic for the MVP.
- Preserve organization scoping on candidates, sponsors, edges, alerts, and operator-facing queries.
- Preserve membership-role enforcement. `VIEWER` is read-only, `MEMBER` is the default mutating role, and settings/demo reset remain admin/owner scoped.
- Preserve the clean boundary between `lib/ai/` providers and orchestration.
- Do not bypass Zod validation for AI responses.
- Keep recommendations explainable and evidence-backed.
- Keep the product willing to say "hold" or "do not advance" when proof is weak.
- Do not hide scoring logic from the UI.
- Keep SQLite-compatible Prisma modeling unless there is a clear migration reason.
- If you need hosted Postgres support, use `prisma/schema.postgres.prisma` and the dedicated Postgres scripts instead of trying to make Prisma provider switching dynamic.
- Preserve the separation between model-generated output and human review state.
- Preserve the distinction between recommendations, sponsor pipeline items, and operator tasks. They are related but not interchangeable.
- Preserve proof requests as explicit evidence-gap workflow objects, not as free-text notes or hidden task metadata.
- Preserve candidate updates as structured evidence-refresh records tied to artifacts or proof requests, not generic notes.
- Preserve artifact supersession/version history. Only current artifact versions should count toward evidence-backed scoring unless a review surface is intentionally showing history.
- Preserve saved queues as workspace-level review filters, not personal browser-only state.
- Preserve reviewer calibration and outcome learning as transparent reporting over real decisions and sponsor outcomes, not hidden score tuning.
- Preserve `BackgroundJob` as a durable queue record for async execution, not a cosmetic activity log.
- Preserve queue mode as optional. The app must still run end to end in inline mode for local demos and tests.
- Preserve `StoredFile` as an attachment/audit layer. Raw extracted text remains the canonical artifact input for AI and scoring.
- Keep pilot posture and executive ROI framing explicit. Do not blur observed metrics with modeled assumptions.
- Keep pilot checkpoints narrow and workspace-level. They are operational evidence, not another candidate workflow object.
- Keep operator notes and decision logs as explicit human-authored workflow context, not generated narrative.

## Mock AI mode

- Mock mode is a first-class runtime.
- The app must run with no `OPENAI_API_KEY`.
- Deterministic outputs come from the mock provider in `lib/ai/mock.ts`.
- Live mode should degrade safely to mock behavior if the key is absent, the API call fails, or output parsing fails.
- Preserve the AI runtime reporting keys in `AppSetting` so Settings can show configured mode vs effective runtime.
- Scanned PDF OCR is intentionally separate from the mock/live LLM provider split. It should continue working without an API key.
- Native Gmail/Outlook and HubSpot/Salesforce/Airtable modes must also degrade safely to the local outbox when credentials or recipient email are missing.
- Public and semi-public routes should remain protected by lightweight throttling, especially login, upload parsing, and review-share surfaces.

## What not to change casually

- The meaning of readiness and sponsor-match score breakdowns
- The human review states and their intent as operator overrides rather than model confidence
- The signal category taxonomy
- The seeded fictional dataset tone and realism
- The explainability-first UI structure
- The print-friendly sponsor memo layout
- The sponsor packet export as an internal review artifact, not an outbound polished marketing document
- The share-link snapshots as read-only internal review artifacts, not a backdoor into the live workspace
- The distinction between the base memo and sponsor-specific memo variants
- The distinction between an internal opportunity brief and the outreach plan built on top of it
- The current lightweight CRM handoff export shape, unless you are deliberately versioning the downstream contract
- The relationship between sponsor activity records and CRM sync records as operational history, not model output
- The trajectory layer as persisted audit history, not a client-only chart or ephemeral metric
- The stage automation rules as transparent heuristics that operators can inspect and challenge
- The distinction between automated stage movement, manual override, and resumed automation as separate audit events
- The distinction between a recommendation, a live sponsor pipeline item, and a task created from that pipeline or an alert
- The distinction between model output and the evidence-discipline guardrail layer that can downgrade it
- The mock alert-digest outbox as inspectable state, not a fake external delivery integration
- The neutral, privacy-conscious product language

## Validation checklist before finishing tasks

- Does the UI still show evidence, memo, sponsor fit, and actions coherently?
- Are AI outputs validated and failure-safe?
- Does mock mode still work without a key?
- Does scanned PDF intake still work without an API key?
- Do evidence claim and recommendation review controls still persist and refresh correctly?
- Do recommendation freshness states still surface correctly on candidate detail, dashboard, and pipeline views after any scoring or workflow change?
- Does the internal packet route still render and print with a selected sponsor target?
- Do sponsor-specific memo variants still change content by selected sponsor and not just header text?
- Do opportunity brief and outreach routes still switch correctly by selected sponsor target?
- Do the email draft and CRM handoff tabs still render from the same selected sponsor context?
- Do CRM syncs still degrade safely to the local outbox when no webhook is configured?
- Does sponsor activity logging persist and refresh in both outreach and sponsor detail views?
- Do progress snapshots still seed correctly and grow after runtime actions?
- Do automated stage changes and operator alerts persist and refresh in dashboard and candidate detail views?
- Do manual stage overrides leave a visible stage-history audit trail and resume automation cleanly?
- Do alert routing preferences and digest deliveries refresh correctly in Settings and Alerts?
- Do workspace login, session-protected routes, and seeded team accounts still work from `/login`?
- Does password-backed login still work for seeded accounts when `AUTH_MODE=password`?
- Do native email and CRM modes still fall back safely when provider credentials are missing?
- Do alert assignees, due dates, and analytics summaries refresh correctly after operator actions?
- Do sponsor pipeline owners, stages, due dates, and next-step notes refresh correctly after edits?
- Do alert-created tasks appear in the tasks queue and candidate workflow context without duplicating source alerts?
- Do proof requests persist assignees, due dates, task links, and resolution notes without collapsing into generic tasks?
- Do saved review queues still round-trip current filter state and reopen the expected candidate subset?
- Do candidate updates still create inspectable artifact text and refresh workflow state without bypassing proof-request history?
- Do superseded artifacts stay visible as history while current scoring and memo evidence only use the active version?
- Do proof-request reminders persist reminder count, last reminder note, and candidate-safe inbox messaging correctly?
- Do proof requests still surface SLA target, overdue state, and default policy-based due dates correctly after workflow edits?
- Do stored original files stay downloadable only inside the correct workspace context?
- Do queue-mode actions create durable background jobs instead of pretending to finish inline?
- Does `npm run jobs:run` drain pending work cleanly when queue mode is enabled?
- Does the bulk review workbench still persist approval/flagging updates and remove approved items from its queue?
- Do operator notes and decision logs save cleanly and remain separate from AI-generated memo language?
- Does blind review mode mask identity cues on dashboard, candidates, compare, and candidate detail surfaces?
- Does strict evidence mode push weak or unsupported memo output into review rather than presenting it as ready?
- Do decision-audit summaries, candidate-level alignment views, and audit exports still reflect the same guardrail logic?
- Do reviewer calibration and outcome-learning views still map back to real sponsor activities or pipeline outcomes instead of guessed success labels?
- Do pilot and ROI routes still reflect the selected pilot template and keep modeled assumptions clearly labeled as such?
- Do onboarding and pilot-brief routes still reflect the selected pilot template and present rollout guidance without blurring modeled ROI into observed proof?
- Does the commercial-proof route still present buyer objections, readiness gaps, and milestone framing without pretending to measure actual market demand?
- Do measured pilot checkpoints still compare current workspace state against a stable baseline without presenting modeled ROI as observed fact?
- Do measured pilot snapshots preserve operator-entered review-time samples and show the expected delta on ROI?
- Does `/api/health` still reflect the same deployment-health snapshot surfaced in Settings and ROI?
- Does capturing a new pilot checkpoint refresh the ROI page and preserve prior checkpoint history?
- Do memo and packet share links stay time-bounded, read-only, and render without requiring a workspace session?
- Do login throttling, upload throttling, and shared-review throttling still behave without breaking normal local demo flows?
- Do CRM field mappings still round-trip valid JSON and show up in downstream CRM payload generation?
- Do dashboard and candidate routes still surface queued background jobs after queue-related changes?
- Do memo, brief, packet, and outreach exports still render correctly after auth is added?
- Does `npm run db:seed` still succeed locally?
- Did you avoid introducing real private people or external scraping?
