# Deployment

## Current state

The repository is fully runnable locally with SQLite and seeded demo data.

For hosted deployment, there are now two realistic paths:

- run the app on a Node host with persistent disk and keep SQLite for demos or internal pilots
- move the datasource to Postgres before deploying to a stateless platform such as Vercel

## Recommended hosted shape

### App host

- Vercel for the Next.js application
- Postgres for persistent data
- local file storage or mounted persistent disk for original uploads, unless you replace it with object storage later
- a worker process or cron-triggered queue runner if `BACKGROUND_JOBS_MODE=queue`
- either native provider credentials or webhook endpoints for CRM sync and outbound email
- webhook endpoints for email digests and Slack digests when live delivery is desired

### Required env vars

- `DATABASE_URL`
- `POSTGRES_DATABASE_URL`
- `AUTH_MODE`
- `DEMO_USER_PASSWORD`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_MODE`
- `FILE_STORAGE_MODE`
- `FILE_STORAGE_PATH`
- `BACKGROUND_JOBS_MODE`
- `BACKGROUND_JOBS_POLL_INTERVAL_MS`
- `JOB_RUNNER_TOKEN`
- `CRM_SYNC_MODE`
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
- `EMAIL_SEND_MODE`
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

## SQLite deployment

SQLite is still the fastest path for:

- local demos
- product reviews
- internal prototyping

If you keep SQLite in a hosted environment, use a platform with a persistent volume and run:

```bash
npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run build
npm run start
```

## Postgres deployment path

The repo now includes `prisma/schema.postgres.prisma` plus dedicated scripts:

```bash
npm run db:generate:postgres
npm run db:push:postgres
npm run db:reset:postgres
npm run db:seed
```

Recommended hosted sequence:

1. Set `POSTGRES_DATABASE_URL` to the hosted database.
2. Run `npm run db:generate:postgres`.
3. Run `npm run db:push:postgres`.
4. Run `npm run db:seed` only if you want the fictional demo workspace in that environment.
5. Decide whether background work will stay `inline` or run in `queue` mode.
6. If you use queue mode, deploy either:
   - a long-running worker with `npm run jobs:work`
   - or a cron job that POSTs to `/api/jobs/run` with `Authorization: Bearer $JOB_RUNNER_TOKEN`
7. Build and deploy the app.

## Vercel notes

- `next build` is already passing in this repository.
- API routes are Node-based and compatible with server execution.
- The app now expects a workspace session for protected routes, so `/login` is the correct entrypoint for hosted review environments.
- For anything beyond a local demo, keep `AUTH_MODE=password` and rotate `DEMO_USER_PASSWORD` or replace the seeded credentials before sharing access.
- Do not deploy the current SQLite default to Vercel without moving persistence off local disk.
- Queue mode on Vercel should use a cron or external trigger against `/api/jobs/run` plus `JOB_RUNNER_TOKEN`.
- Original upload storage needs persistent disk if you keep the bundled local storage provider in production.
- The built-in rate limiter is process-local. For real production traffic, pair it with platform or edge-layer throttling and abuse protection.

## Operational checks after deploy

- Can a seeded demo user sign in at `/login`?
- Do dashboard, candidates, sponsors, briefs, alerts, settings, and analytics load correctly?
- Does `/api/health` return `healthy` or an explainable `degraded` state?
- Do memo, packet, brief, and outreach exports respond?
- Can stored original uploads be downloaded from candidate detail after upload?
- If queue mode is enabled, do queued jobs drain through the worker or `/api/jobs/run`?
- Do CRM handoff routes return JSON and CSV?
- Do email and Slack digest webhooks succeed when configured?
- Do alert assignments and due dates persist?

## Pilot instrumentation

For live pilots, the ROI page now supports measured baseline and checkpoint capture inside the workspace.

- Capture a baseline before the pilot starts.
- Capture checkpoints after a review cycle or operating milestone.
- Use those snapshots to compare observed movement against the modeled ROI section.
- Treat the measured delta rows as operating evidence, not as full financial proof.
