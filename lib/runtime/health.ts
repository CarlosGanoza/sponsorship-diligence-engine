import { BackgroundJobStatus } from "@prisma/client";

import { getBundledOcrStatus } from "@/lib/artifacts/ocr";
import { env } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { getStorageRuntimeSnapshot } from "@/lib/storage/provider";

export type HealthStatus = "healthy" | "degraded" | "down";

export type HealthCheck = {
  key: string;
  label: string;
  status: HealthStatus;
  detail: string;
};

function deriveOverallStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.some((check) => check.status === "down")) {
    return "down";
  }

  if (checks.some((check) => check.status === "degraded")) {
    return "degraded";
  }

  return "healthy";
}

async function getSettingMap() {
  const settings = await prisma.appSetting.findMany({
    select: {
      key: true,
      value: true,
    },
  });

  return new Map(settings.map((setting) => [setting.key, setting.value]));
}

export async function getDeploymentHealthSnapshot() {
  const ocrStatus = getBundledOcrStatus();
  const storage = getStorageRuntimeSnapshot();

  let databaseStatus: HealthStatus = "healthy";
  let databaseDetail = "Database connection verified.";

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch (error) {
    databaseStatus = "down";
    databaseDetail = error instanceof Error ? error.message : "Database connection failed.";
  }

  const settingMap = databaseStatus === "down" ? new Map<string, string>() : await getSettingMap();
  const aiMode = settingMap.get("AI_MODE") ?? env.aiMode;
  const crmMode = settingMap.get("CRM_SYNC_MODE") ?? env.crmSyncMode;
  const emailMode = settingMap.get("EMAIL_SEND_MODE") ?? env.emailSendMode;
  const jobsMode = settingMap.get("BACKGROUND_JOBS_MODE") ?? env.backgroundJobsMode;
  const alertNotifyEmail = (settingMap.get("ALERT_NOTIFY_EMAIL") ?? "false") === "true";
  const alertNotifySlack = (settingMap.get("ALERT_NOTIFY_SLACK") ?? "false") === "true";
  const pendingBackgroundJobs =
    databaseStatus === "down"
      ? 0
      : await prisma.backgroundJob.count({
          where: {
            status: {
              in: [BackgroundJobStatus.PENDING, BackgroundJobStatus.RETRYABLE],
            },
          },
        });

  const checks: HealthCheck[] = [
    {
      key: "database",
      label: "Database",
      status: databaseStatus,
      detail: databaseDetail,
    },
    {
      key: "auth",
      label: "Workspace auth",
      status: env.authMode === "password" ? "healthy" : "degraded",
      detail:
        env.authMode === "password"
          ? "Password-backed workspace auth is configured for local operator access."
          : "Demo auth mode is enabled. Suitable for local demos, not for production workspace access.",
    },
    {
      key: "ai",
      label: "AI runtime",
      status: aiMode === "live" && !env.openAiApiKey ? "degraded" : "healthy",
      detail:
        aiMode === "live" && !env.openAiApiKey
          ? "Live AI mode is selected without an OpenAI key. The app will fall back to mock mode."
          : aiMode === "live"
            ? "Live AI mode is configured and a key is present."
            : "Mock AI mode is configured and fully available.",
    },
    {
      key: "crm",
      label: "CRM sync",
      status:
        (crmMode === "webhook" && !env.crmWebhookUrl) ||
        (crmMode === "hubspot" && !env.hubspotAccessToken && !env.hubspotCrmWebhookUrl) ||
        (crmMode === "salesforce" &&
          !(env.salesforceInstanceUrl && env.salesforceAccessToken) &&
          !env.salesforceCrmWebhookUrl) ||
        (crmMode === "airtable" && !(env.airtableAccessToken && env.airtableBaseId) && !env.airtableCrmWebhookUrl)
          ? "degraded"
          : "healthy",
      detail:
        crmMode === "webhook" && !env.crmWebhookUrl
          ? "Webhook CRM mode is selected without a webhook URL. The app will fall back to the local outbox."
          : crmMode === "hubspot" && !env.hubspotAccessToken && !env.hubspotCrmWebhookUrl
            ? "HubSpot mode is selected without a native token or provider webhook URL. The app will fall back to the local outbox."
            : crmMode === "salesforce" &&
                !(env.salesforceInstanceUrl && env.salesforceAccessToken) &&
                !env.salesforceCrmWebhookUrl
              ? "Salesforce mode is selected without native credentials or a provider webhook URL. The app will fall back to the local outbox."
              : crmMode === "airtable" &&
                  !(env.airtableAccessToken && env.airtableBaseId) &&
                  !env.airtableCrmWebhookUrl
                ? "Airtable mode is selected without native credentials or a provider webhook URL. The app will fall back to the local outbox."
                : crmMode === "mock"
                  ? "Local outbox CRM mode is configured."
                  : `${crmMode} CRM mode is configured.`,
    },
    {
      key: "email-send",
      label: "Outbound email",
      status:
        (emailMode === "webhook" && !env.emailSendWebhookUrl) ||
        (emailMode === "gmail" &&
          !(env.gmailOauthClientId && env.gmailOauthClientSecret && env.gmailOauthRefreshToken && env.gmailSenderEmail) &&
          !env.gmailSendWebhookUrl) ||
        (emailMode === "outlook" &&
          !(env.outlookTenantId && env.outlookOauthClientId && env.outlookOauthClientSecret && env.outlookOauthRefreshToken) &&
          !env.outlookSendWebhookUrl)
          ? "degraded"
          : "healthy",
      detail:
        emailMode === "webhook" && !env.emailSendWebhookUrl
          ? "Webhook email mode is selected without a webhook URL. Sends will fall back to the local outbox."
          : emailMode === "gmail" &&
              !(env.gmailOauthClientId && env.gmailOauthClientSecret && env.gmailOauthRefreshToken && env.gmailSenderEmail) &&
              !env.gmailSendWebhookUrl
            ? "Gmail mode is selected without native OAuth credentials or a provider webhook URL. Sends will fall back to the local outbox."
            : emailMode === "outlook" &&
                !(env.outlookTenantId && env.outlookOauthClientId && env.outlookOauthClientSecret && env.outlookOauthRefreshToken) &&
                !env.outlookSendWebhookUrl
              ? "Outlook mode is selected without native OAuth credentials or a provider webhook URL. Sends will fall back to the local outbox."
              : emailMode === "mock"
                ? "Local mock email delivery is configured."
                : `${emailMode} delivery mode is configured.`,
    },
    {
      key: "storage",
      label: "File storage",
      status: storage.mode === "local" ? "healthy" : "degraded",
      detail: `Local file storage is configured at ${storage.rootPath}.`,
    },
    {
      key: "jobs",
      label: "Background jobs",
      status:
        jobsMode === "queue" && !env.jobRunnerToken && pendingBackgroundJobs > 0
          ? "degraded"
          : "healthy",
      detail:
        jobsMode === "queue"
          ? pendingBackgroundJobs > 0
            ? env.jobRunnerToken
              ? `${pendingBackgroundJobs} queued jobs are waiting for the worker or cron runner.`
              : `${pendingBackgroundJobs} queued jobs are waiting, but JOB_RUNNER_TOKEN is not configured for cron-triggered execution.`
            : "Queue mode is configured and no pending jobs are waiting."
          : "Background work is configured to run inline inside operator actions.",
    },
    {
      key: "digests",
      label: "Digest delivery",
      status:
        (alertNotifyEmail && !env.emailDigestWebhookUrl) || (alertNotifySlack && !env.slackDigestWebhookUrl)
          ? "degraded"
          : "healthy",
      detail:
        (alertNotifyEmail && !env.emailDigestWebhookUrl) || (alertNotifySlack && !env.slackDigestWebhookUrl)
          ? "At least one digest channel is enabled without a live webhook. Deliveries will stay in the local outbox."
          : "Digest routing is either fully configured or safely using the local outbox.",
    },
    {
      key: "ocr",
      label: "Document OCR",
      status: ocrStatus.available ? "healthy" : "degraded",
      detail: ocrStatus.detail,
    },
  ];

  return {
    checkedAt: new Date().toISOString(),
    status: deriveOverallStatus(checks),
    appName: env.appName,
    checks,
  };
}
