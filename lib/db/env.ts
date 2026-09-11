export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  postgresDatabaseUrl: process.env.POSTGRES_DATABASE_URL ?? "",
  authMode: process.env.AUTH_MODE === "demo" ? "demo" : "password",
  demoUserPassword: process.env.DEMO_USER_PASSWORD ?? "signalsponsor-demo",
  fileStorageMode: process.env.FILE_STORAGE_MODE === "local" ? "local" : "local",
  fileStoragePath: process.env.FILE_STORAGE_PATH ?? ".data/storage",
  backgroundJobsMode: process.env.BACKGROUND_JOBS_MODE === "queue" ? "queue" : "inline",
  backgroundJobsPollIntervalMs: Number(process.env.BACKGROUND_JOBS_POLL_INTERVAL_MS ?? "5000"),
  jobRunnerToken: process.env.JOB_RUNNER_TOKEN ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  aiMode: process.env.AI_MODE === "live" ? "live" : "mock",
  crmSyncMode:
    process.env.CRM_SYNC_MODE === "hubspot"
      ? "hubspot"
      : process.env.CRM_SYNC_MODE === "salesforce"
        ? "salesforce"
        : process.env.CRM_SYNC_MODE === "airtable"
          ? "airtable"
          : process.env.CRM_SYNC_MODE === "webhook"
            ? "webhook"
            : "mock",
  crmWebhookUrl: process.env.CRM_WEBHOOK_URL ?? "",
  hubspotCrmWebhookUrl: process.env.HUBSPOT_CRM_WEBHOOK_URL ?? "",
  salesforceCrmWebhookUrl: process.env.SALESFORCE_CRM_WEBHOOK_URL ?? "",
  airtableCrmWebhookUrl: process.env.AIRTABLE_CRM_WEBHOOK_URL ?? "",
  hubspotAccessToken: process.env.HUBSPOT_ACCESS_TOKEN ?? "",
  salesforceInstanceUrl: process.env.SALESFORCE_INSTANCE_URL ?? "",
  salesforceAccessToken: process.env.SALESFORCE_ACCESS_TOKEN ?? "",
  airtableAccessToken: process.env.AIRTABLE_ACCESS_TOKEN ?? "",
  airtableBaseId: process.env.AIRTABLE_BASE_ID ?? "",
  airtableTableName: process.env.AIRTABLE_TABLE_NAME ?? "Sponsor Handoffs",
  emailSendMode:
    process.env.EMAIL_SEND_MODE === "gmail"
      ? "gmail"
      : process.env.EMAIL_SEND_MODE === "outlook"
        ? "outlook"
        : process.env.EMAIL_SEND_MODE === "webhook"
          ? "webhook"
          : "mock",
  emailSendWebhookUrl: process.env.EMAIL_SEND_WEBHOOK_URL ?? "",
  gmailSendWebhookUrl: process.env.GMAIL_SEND_WEBHOOK_URL ?? "",
  outlookSendWebhookUrl: process.env.OUTLOOK_SEND_WEBHOOK_URL ?? "",
  gmailOauthClientId: process.env.GMAIL_OAUTH_CLIENT_ID ?? "",
  gmailOauthClientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET ?? "",
  gmailOauthRefreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN ?? "",
  gmailSenderEmail: process.env.GMAIL_SENDER_EMAIL ?? "",
  outlookTenantId: process.env.OUTLOOK_TENANT_ID ?? "",
  outlookOauthClientId: process.env.OUTLOOK_OAUTH_CLIENT_ID ?? "",
  outlookOauthClientSecret: process.env.OUTLOOK_OAUTH_CLIENT_SECRET ?? "",
  outlookOauthRefreshToken: process.env.OUTLOOK_OAUTH_REFRESH_TOKEN ?? "",
  outlookSenderEmail: process.env.OUTLOOK_SENDER_EMAIL ?? "",
  emailDigestWebhookUrl: process.env.EMAIL_DIGEST_WEBHOOK_URL ?? "",
  slackDigestWebhookUrl: process.env.SLACK_DIGEST_WEBHOOK_URL ?? "",
  uploadRateLimitWindowMs: Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS ?? "60000"),
  uploadRateLimitMaxRequests: Number(process.env.UPLOAD_RATE_LIMIT_MAX_REQUESTS ?? "20"),
  publicReviewRateLimitWindowMs: Number(process.env.PUBLIC_REVIEW_RATE_LIMIT_WINDOW_MS ?? "60000"),
  publicReviewRateLimitMaxRequests: Number(process.env.PUBLIC_REVIEW_RATE_LIMIT_MAX_REQUESTS ?? "30"),
  loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? "300000"),
  loginRateLimitMaxAttempts: Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? "12"),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "SignalSponsor",
};
