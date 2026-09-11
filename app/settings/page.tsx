import { env } from "@/lib/db/env";
import { getSettingsSnapshot } from "@/lib/db/queries";
import { getBundledOcrStatus } from "@/lib/artifacts/ocr";
import { AppShell } from "@/components/dashboard/app-shell";
import { AccessManagementControls } from "@/components/settings/access-management-controls";
import { RecoveryQueueControls } from "@/components/settings/recovery-queue-controls";
import { SettingsControls } from "@/components/settings/settings-controls";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getPilotTemplate } from "@/lib/pilot/templates";
import { getDeploymentHealthSnapshot } from "@/lib/runtime/health";
import { formatDate } from "@/lib/utils/format";

export default async function SettingsPage() {
  const snapshot = await getSettingsSnapshot();
  const ocrStatus = getBundledOcrStatus();
  const pilotTemplate = getPilotTemplate(snapshot.pilotTemplate);
  const health = await getDeploymentHealthSnapshot();

  return (
    <AppShell
      title="Settings and demo mode"
      description="Inspect workspace status, configure AI, pilot posture, CRM, alert routing, and automation policy, and reset the local seeded dataset."
    >
      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Environment status</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Configured AI mode</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.aiMode === "mock" ? "sage" : "gold"}>{snapshot.aiMode}</Badge>
                <p className="text-sm text-ink-500">Runtime fallback remains safe.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Effective runtime</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.aiRuntimeMode === "live" ? "sage" : "gold"}>
                  {snapshot.aiRuntimeMode}
                </Badge>
                <p className="text-sm text-ink-500">What the last AI task actually used.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">OpenAI key</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={env.openAiApiKey ? "sage" : "gold"}>{env.openAiApiKey ? "present" : "missing"}</Badge>
                <p className="text-sm text-ink-500">
                  {env.openAiApiKey ? "Live mode available." : "Mock mode remains fully functional."}
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">App name</p>
              <p className="mt-3 text-sm text-ink-700">{snapshot.appName}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Blind review mode</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.blindReviewMode ? "sage" : "muted"}>
                  {snapshot.blindReviewMode ? "enabled" : "disabled"}
                </Badge>
                <p className="text-sm text-ink-500">Masks identity cues on core review surfaces.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Strict evidence mode</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.strictEvidenceMode ? "sage" : "gold"}>
                  {snapshot.strictEvidenceMode ? "enabled" : "disabled"}
                </Badge>
                <p className="text-sm text-ink-500">Weak or unsupported outputs are pushed into review.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Outbound approval</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.requireOutboundApproval ? "sage" : "gold"}>
                  {snapshot.requireOutboundApproval ? "required" : "optional"}
                </Badge>
                <p className="text-sm text-ink-500">Sponsor-facing release and CRM handoff stay gated when enabled.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Sponsor-facing redaction</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.blockSponsorFacingPii ? "sage" : "gold"}>
                  {snapshot.blockSponsorFacingPii ? "required" : "warning only"}
                </Badge>
                <p className="text-sm text-ink-500">Contact details in sponsor-facing text are blocked when enabled.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Workspace</p>
              <p className="mt-3 text-sm text-ink-700">{snapshot.workspace.name}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Pilot template</p>
              <p className="mt-3 text-sm text-ink-700">{pilotTemplate.label}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Guided demo mode</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.guidedDemoMode ? "sage" : "muted"}>
                  {snapshot.guidedDemoMode ? "enabled" : "disabled"}
                </Badge>
                <p className="text-sm text-ink-500">Prioritizes a recommended walkthrough for buyers and pilot reviewers.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Model</p>
              <p className="mt-3 text-sm text-ink-700">{env.openAiModel}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Scanned PDF OCR</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={ocrStatus.available ? "sage" : "gold"}>{ocrStatus.label}</Badge>
                <p className="text-sm text-ink-500">{ocrStatus.detail}</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Auth mode</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={env.authMode === "password" ? "sage" : "gold"}>{env.authMode}</Badge>
                <p className="text-sm text-ink-500">
                  {env.authMode === "password"
                    ? "Workspace login requires a password-backed seeded account."
                    : "Local demo sign-in remains enabled."}
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Configured CRM mode</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.crmMode === "mock" ? "sage" : "gold"}>{snapshot.crmMode}</Badge>
                <p className="text-sm text-ink-500">Controls how handoff sync is attempted.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Effective CRM runtime</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.crmRuntimeMode === "webhook" ? "sage" : "gold"}>
                  {snapshot.crmRuntimeMode}
                </Badge>
                <p className="text-sm text-ink-500">What the last sync actually used.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Configured email mode</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.emailSendMode === "mock" ? "sage" : "gold"}>{snapshot.emailSendMode}</Badge>
                <p className="text-sm text-ink-500">Controls how outbound draft delivery is attempted.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Effective email runtime</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.emailRuntimeMode === "mock" ? "gold" : "sage"}>
                  {snapshot.emailRuntimeMode}
                </Badge>
                <p className="text-sm text-ink-500">What the last outbound send actually used.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Background jobs mode</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={snapshot.backgroundJobsMode === "queue" ? "gold" : "sage"}>
                  {snapshot.backgroundJobsMode}
                </Badge>
                <p className="text-sm text-ink-500">Controls whether heavy work runs inline or through the durable queue.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">File storage</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant="sage">{snapshot.fileStorageMode}</Badge>
                <p className="text-sm text-ink-500">Original uploads are stored separately from the inspectable raw-text evidence record.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">CRM providers</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge
                  variant={
                    env.crmWebhookUrl || env.hubspotAccessToken || (env.salesforceInstanceUrl && env.salesforceAccessToken) || (env.airtableAccessToken && env.airtableBaseId)
                      ? "sage"
                      : "gold"
                  }
                >
                  {env.crmWebhookUrl || env.hubspotAccessToken || (env.salesforceInstanceUrl && env.salesforceAccessToken) || (env.airtableAccessToken && env.airtableBaseId)
                    ? "configured"
                    : "missing"}
                </Badge>
                <p className="text-sm text-ink-500">
                  Direct HubSpot, Salesforce, Airtable, or webhook sync can all fall back safely to the local CRM outbox.
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Email send adapters</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge
                  variant={
                    env.emailSendWebhookUrl ||
                    (env.gmailOauthClientId && env.gmailOauthClientSecret && env.gmailOauthRefreshToken && env.gmailSenderEmail) ||
                    (env.outlookTenantId && env.outlookOauthClientId && env.outlookOauthClientSecret && env.outlookOauthRefreshToken)
                      ? "sage"
                      : "gold"
                  }
                >
                  {env.emailSendWebhookUrl ||
                  (env.gmailOauthClientId && env.gmailOauthClientSecret && env.gmailOauthRefreshToken && env.gmailSenderEmail) ||
                  (env.outlookTenantId && env.outlookOauthClientId && env.outlookOauthClientSecret && env.outlookOauthRefreshToken)
                    ? "configured"
                    : "missing"}
                </Badge>
                <p className="text-sm text-ink-500">Webhook, Gmail, and Outlook delivery can all fall back safely to the local outbox.</p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Email digest webhook</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={env.emailDigestWebhookUrl ? "sage" : "gold"}>
                  {env.emailDigestWebhookUrl ? "present" : "missing"}
                </Badge>
                <p className="text-sm text-ink-500">
                  {env.emailDigestWebhookUrl ? "Email digests can deliver live." : "Email digests remain local outbox only."}
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Slack digest webhook</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant={env.slackDigestWebhookUrl ? "sage" : "gold"}>
                  {env.slackDigestWebhookUrl ? "present" : "missing"}
                </Badge>
                <p className="text-sm text-ink-500">
                  {env.slackDigestWebhookUrl ? "Slack digests can deliver live." : "Slack digests remain local outbox only."}
                </p>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Upload throttle</p>
              <p className="mt-3 text-sm text-ink-700">
                {env.uploadRateLimitMaxRequests} parse requests / {Math.round(env.uploadRateLimitWindowMs / 1000)}s
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Shared review throttle</p>
              <p className="mt-3 text-sm text-ink-700">
                {env.publicReviewRateLimitMaxRequests} link opens / {Math.round(env.publicReviewRateLimitWindowMs / 1000)}s
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Login throttle</p>
              <p className="mt-3 text-sm text-ink-700">
                {env.loginRateLimitMaxAttempts} attempts / {Math.round(env.loginRateLimitWindowMs / 60000)} min
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Last AI runtime note</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">{snapshot.aiRuntimeNote}</p>
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Last CRM runtime note</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">{snapshot.crmRuntimeNote}</p>
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Last email runtime note</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">{snapshot.emailRuntimeNote}</p>
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Background jobs runtime note</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">{snapshot.backgroundJobsRuntimeNote}</p>
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">File storage path</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">{snapshot.fileStoragePath}</p>
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Alert routing</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">
              Email digest: {snapshot.alertNotifyEmail ? "enabled" : "disabled"} · Slack digest:{" "}
              {snapshot.alertNotifySlack ? "enabled" : "disabled"} · Ops queue:{" "}
              {snapshot.alertNotifyOps ? "enabled" : "disabled"}
            </p>
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Pilot runtime note</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">{snapshot.pilotRuntimeNote}</p>
          </div>
          <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Deployment health</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={health.status === "healthy" ? "sage" : health.status === "degraded" ? "gold" : "danger"}>
                {health.status}
              </Badge>
              {health.checks.map((check) => (
                <Badge
                  key={check.key}
                  variant={check.status === "healthy" ? "sage" : check.status === "degraded" ? "gold" : "danger"}
                >
                  {check.label}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-sm leading-7 text-ink-600">
              Checked at {formatDate(health.checkedAt)}. The same deployment snapshot is available at <code>/api/health</code>.
            </p>
          </div>
        </Card>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Demo data status</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Object.entries(snapshot.counts).map(([key, value]) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={key}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{key}</p>
                <p className="mt-2 font-serif text-4xl text-ink-900">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Workspace access</p>
          <p className="mt-1 text-sm text-ink-500">
            Manage invite links, revoke active sessions, and keep local workspace access closer to a real operating environment.
          </p>
          <div className="mt-5">
            <AccessManagementControls
              currentSessionId={snapshot.currentSessionId}
              currentUserEmail={snapshot.currentUser.email}
              invites={snapshot.workspaceInvites}
              sessions={snapshot.currentUserSessions}
            />
          </div>
        </Card>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Sensitive action trail</p>
          <p className="mt-1 text-sm text-ink-500">
            Recent sponsor-facing sends, approvals, CRM handoffs, and stage changes are recorded here.
          </p>
          <div className="mt-5 space-y-4">
            {snapshot.recentAuditLogs.map((log) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={log.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{log.targetType.replaceAll("_", " ")}</Badge>
                    {log.actor?.name ? <Badge variant="sage">{log.actor.name}</Badge> : null}
                  </div>
                  <p className="text-sm text-ink-500">{log.createdAtLabel}</p>
                </div>
                <p className="mt-3 text-sm font-medium text-ink-900">{log.title}</p>
                <p className="mt-2 text-sm leading-6 text-ink-500">{log.detail}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
                  {log.candidate?.fullName ?? "No candidate"} {log.sponsor?.fullName ? `· ${log.sponsor.fullName}` : ""}
                </p>
              </div>
            ))}
            {snapshot.recentAuditLogs.length === 0 ? (
              <p className="text-sm text-ink-500">No sensitive-action audit records have been written yet.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <Card className="px-6 py-6">
        <p className="text-sm font-medium text-ink-900">Recent digest deliveries</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {snapshot.recentDigestDeliveries.map((delivery) => (
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={delivery.id}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">{delivery.channel.replaceAll("_", " ")}</p>
              <p className="mt-2 text-sm text-ink-700">{delivery.createdAtLabel}</p>
              <p className="mt-2 text-sm leading-6 text-ink-500">{delivery.summary}</p>
            </div>
          ))}
          {snapshot.recentDigestDeliveries.length === 0 ? (
            <p className="text-sm text-ink-500">No alert digest deliveries have been recorded yet.</p>
          ) : null}
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Recent background jobs</p>
          <div className="mt-5 space-y-4">
            {snapshot.recentBackgroundJobs.map((job) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={job.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        job.status === "SUCCEEDED"
                          ? "sage"
                          : job.status === "FAILED"
                            ? "danger"
                            : job.status === "RETRYABLE"
                              ? "gold"
                              : "muted"
                      }
                    >
                      {job.status.replaceAll("_", " ")}
                    </Badge>
                    <Badge variant="muted">{job.jobType.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-ink-500">{job.createdAtLabel}</p>
                </div>
                <p className="mt-3 text-sm font-medium text-ink-900">{job.title}</p>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  {job.candidate?.fullName ? `${job.candidate.fullName} · ` : ""}
                  {job.requestedBy?.name ? `Requested by ${job.requestedBy.name}` : "Workspace worker job"}
                </p>
                {job.errorMessage ? <p className="mt-2 text-sm leading-6 text-rose-700">{job.errorMessage}</p> : null}
              </div>
            ))}
            {snapshot.recentBackgroundJobs.length === 0 ? (
              <p className="text-sm text-ink-500">No background jobs have been recorded yet.</p>
            ) : null}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">Recent stored files</p>
          <div className="mt-5 space-y-4">
            {snapshot.recentStoredFiles.map((file) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={file.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{file.purpose.replaceAll("_", " ")}</Badge>
                    <Badge variant="muted">{file.provider}</Badge>
                  </div>
                  <p className="text-sm text-ink-500">{file.createdAtLabel}</p>
                </div>
                <p className="mt-3 text-sm font-medium text-ink-900">{file.originalFileName}</p>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  {file.candidate?.fullName ? `${file.candidate.fullName} · ` : ""}
                  {file.byteSize} bytes · {file.sourceLabel}
                </p>
              </div>
            ))}
            {snapshot.recentStoredFiles.length === 0 ? (
              <p className="text-sm text-ink-500">No stored files have been recorded yet.</p>
            ) : null}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">CRM sync health</p>
          <p className="mt-1 text-sm text-ink-500">
            Provider and object-level sync outcomes so fallback or failure patterns are visible before they become workflow drift.
          </p>
          <div className="mt-5 space-y-4">
            {snapshot.crmSyncHealth.map((row) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={`${row.providerMode}-${row.objectType}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{row.providerMode}</Badge>
                    <Badge variant="muted">{row.objectType.replaceAll("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-ink-500">{row.total} total</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Synced</p>
                    <p className="mt-2 font-serif text-3xl text-ink-900">{row.synced}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Fallback</p>
                    <p className="mt-2 font-serif text-3xl text-ink-900">{row.fallback}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Failed</p>
                    <p className="mt-2 font-serif text-3xl text-ink-900">{row.failed}</p>
                  </div>
                </div>
              </div>
            ))}
            {snapshot.crmSyncHealth.length === 0 ? (
              <p className="text-sm text-ink-500">No CRM sync history has been recorded yet.</p>
            ) : null}
          </div>
        </Card>
      </section>

      <Card className="px-6 py-6">
        <div className="border-b border-ink-100 pb-4">
          <p className="text-sm font-medium text-ink-900">Recovery queues</p>
          <p className="mt-1 text-sm text-ink-500">
            Retry failed durable jobs and degraded CRM handoffs without leaving operator follow-through stranded.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant={snapshot.counts.recoveryJobs > 0 ? "gold" : "sage"}>
            {snapshot.counts.recoveryJobs} recovery jobs
          </Badge>
          <Badge variant={snapshot.counts.recoveryCrmSyncs > 0 ? "gold" : "sage"}>
            {snapshot.counts.recoveryCrmSyncs} recovery CRM syncs
          </Badge>
        </div>
        <div className="mt-5">
          <RecoveryQueueControls
            backgroundJobs={snapshot.recoveryBackgroundJobs}
            crmSyncs={snapshot.recoveryCrmSyncs}
          />
        </div>
      </Card>

      <Card className="px-6 py-6">
        <p className="text-sm font-medium text-ink-900">Workspace team</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {snapshot.teamMembers.map((member) => (
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={member.id}>
              <p className="text-sm font-medium text-ink-900">{member.name}</p>
              <p className="mt-1 text-sm text-ink-500">{member.email}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-ink-400">
                {member.membershipRole} · {member.role}
              </p>
              {member.title ? <p className="mt-2 text-sm text-ink-600">{member.title}</p> : null}
            </div>
          ))}
        </div>
      </Card>

      <SettingsControls
        aiMode={snapshot.aiMode as "mock" | "live"}
        alertNotifyEmail={snapshot.alertNotifyEmail}
        alertNotifyOps={snapshot.alertNotifyOps}
        alertNotifySlack={snapshot.alertNotifySlack}
        automationPolicy={snapshot.automationPolicy}
        backgroundJobsMode={snapshot.backgroundJobsMode as "inline" | "queue"}
        blindReviewMode={snapshot.blindReviewMode}
        blockSponsorFacingPii={snapshot.blockSponsorFacingPii}
        crmMode={snapshot.crmMode as "mock" | "webhook" | "hubspot" | "salesforce" | "airtable"}
        crmFieldMappings={snapshot.crmFieldMappings}
        emailSendMode={snapshot.emailSendMode as "mock" | "webhook" | "gmail" | "outlook"}
        hasEmailDigestWebhook={Boolean(env.emailDigestWebhookUrl)}
        hasCrmWebhookUrl={Boolean(env.crmWebhookUrl)}
        hasHubspotAccessToken={Boolean(env.hubspotAccessToken)}
        hasSalesforceConfig={Boolean(env.salesforceInstanceUrl && env.salesforceAccessToken)}
        hasAirtableConfig={Boolean(env.airtableAccessToken && env.airtableBaseId)}
        hasEmailWebhookUrl={Boolean(env.emailSendWebhookUrl)}
        hasGmailConfig={Boolean(env.gmailOauthClientId && env.gmailOauthClientSecret && env.gmailOauthRefreshToken && env.gmailSenderEmail)}
        hasOutlookConfig={Boolean(env.outlookTenantId && env.outlookOauthClientId && env.outlookOauthClientSecret && env.outlookOauthRefreshToken)}
        hasJobRunnerToken={Boolean(env.jobRunnerToken)}
        hasOpenAiKey={Boolean(env.openAiApiKey)}
        hasSlackDigestWebhook={Boolean(env.slackDigestWebhookUrl)}
        guidedDemoMode={snapshot.guidedDemoMode}
        pilotTemplate={pilotTemplate.key}
        requireOutboundApproval={snapshot.requireOutboundApproval}
        strictEvidenceMode={snapshot.strictEvidenceMode}
      />
    </AppShell>
  );
}
