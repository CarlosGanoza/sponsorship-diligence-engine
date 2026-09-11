import { EmailDeliveryStatus, EmailSendMode } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/db/env";
import { refreshOAuthAccessToken } from "@/lib/integrations/oauth";

type RuntimeMode = "mock" | "webhook" | "gmail" | "outlook";

export type OutboundEmailRequest = {
  candidateId: string;
  candidateName: string;
  sponsorId: string;
  sponsorName: string;
  opportunityBriefId?: string | null;
  draftId: string;
  draftLabel: string;
  recipientLabel: string;
  recipientEmail?: string | null;
  subject: string;
  body: string;
};

export type EmailSendResult = {
  providerMode: EmailSendMode;
  status: EmailDeliveryStatus;
  externalMessageId: string | null;
  providerThreadId: string | null;
  payloadJson: string;
  sendNote: string;
};

async function persistEmailRuntimeState(mode: RuntimeMode, note: string) {
  const payload = note.trim().slice(0, 280);

  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await prisma.appSetting.upsert({
      where: { key: "EMAIL_RUNTIME_MODE" },
      update: { value: mode },
      create: { key: "EMAIL_RUNTIME_MODE", value: mode },
    });

    await prisma.appSetting.upsert({
      where: { key: "EMAIL_RUNTIME_NOTE" },
      update: { value: payload },
      create: { key: "EMAIL_RUNTIME_NOTE", value: payload },
    });
  } catch {
    // Email runtime state should not block delivery.
  }
}

export async function resolveEmailSendMode() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "EMAIL_SEND_MODE" },
    });

    if (
      setting?.value === "mock" ||
      setting?.value === "webhook" ||
      setting?.value === "gmail" ||
      setting?.value === "outlook"
    ) {
      return setting.value;
    }
  } catch {
    return env.emailSendMode;
  }

  return env.emailSendMode;
}

function buildMockResult(request: OutboundEmailRequest, note: string): EmailSendResult {
  return {
    providerMode: EmailSendMode.MOCK,
    status: EmailDeliveryStatus.SENT,
    externalMessageId: `local-email-${Date.now()}`,
    providerThreadId: null,
    payloadJson: JSON.stringify({
      contractVersion: "v2",
      provider: "mock",
      request,
    }),
    sendNote: note,
  };
}

export function buildEmailProviderPayload(provider: RuntimeMode, request: OutboundEmailRequest) {
  const base = {
    contractVersion: "v2",
    provider,
    candidate: {
      id: request.candidateId,
      name: request.candidateName,
    },
    sponsor: {
      id: request.sponsorId,
      name: request.sponsorName,
    },
    opportunityBriefId: request.opportunityBriefId ?? null,
    message: {
      draftId: request.draftId,
      draftLabel: request.draftLabel,
      recipientLabel: request.recipientLabel,
      recipientEmail: request.recipientEmail ?? null,
      subject: request.subject,
      body: request.body,
    },
  };

  if (provider === "gmail") {
    return {
      ...base,
      gmailMessage: {
        from: env.gmailSenderEmail || null,
        to: request.recipientEmail ?? null,
        subject: request.subject,
        plainTextBody: request.body,
      },
    };
  }

  if (provider === "outlook") {
    return {
      ...base,
      outlookMessage: {
        from: env.outlookSenderEmail || null,
        to: request.recipientEmail ?? null,
        subject: request.subject,
        body: {
          contentType: "Text",
          content: request.body,
        },
      },
    };
  }

  return base;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function buildGmailRawMessage(request: OutboundEmailRequest) {
  const sender = env.gmailSenderEmail.trim();
  const recipient = request.recipientEmail?.trim() ?? "";
  const message = [
    `From: ${sender}`,
    `To: ${recipient}`,
    `Subject: ${request.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    request.body,
  ].join("\r\n");

  return encodeBase64Url(message);
}

function hasGmailConfig() {
  return Boolean(
    env.gmailOauthClientId &&
      env.gmailOauthClientSecret &&
      env.gmailOauthRefreshToken &&
      env.gmailSenderEmail,
  );
}

function hasOutlookConfig() {
  return Boolean(
    env.outlookTenantId &&
      env.outlookOauthClientId &&
      env.outlookOauthClientSecret &&
      env.outlookOauthRefreshToken,
  );
}

function buildMissingRecipientResult(provider: RuntimeMode, request: OutboundEmailRequest, note: string) {
  return {
    ...buildMockResult(request, `${note} Saved to the local email outbox instead.`),
    status: EmailDeliveryStatus.FALLBACK,
    payloadJson: JSON.stringify(buildEmailProviderPayload(provider, request)),
  } satisfies EmailSendResult;
}

async function postToWebhook(
  provider: RuntimeMode,
  url: string,
  request: OutboundEmailRequest,
  successNote: string,
  missingUrlNote: string,
) {
  if (!url) {
    await persistEmailRuntimeState("mock", missingUrlNote);
    return {
      ...buildMockResult(request, `${missingUrlNote} Saved to the local email outbox instead.`),
      status: EmailDeliveryStatus.FALLBACK,
    } satisfies EmailSendResult;
  }

  const payload = buildEmailProviderPayload(provider, request);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Email provider returned ${response.status}.`);
    }

    const body = await response.json().catch(() => ({}));
    const externalMessageId =
      typeof body?.id === "string"
        ? body.id
        : typeof body?.messageId === "string"
          ? body.messageId
          : `email-${provider}-${Date.now()}`;

    await persistEmailRuntimeState(provider, successNote);

    return {
      providerMode:
        provider === "gmail"
          ? EmailSendMode.GMAIL
          : provider === "outlook"
            ? EmailSendMode.OUTLOOK
            : EmailSendMode.WEBHOOK,
      status: EmailDeliveryStatus.SENT,
      externalMessageId,
      providerThreadId: typeof body?.threadId === "string" ? body.threadId : externalMessageId,
      payloadJson: JSON.stringify(payload),
      sendNote: successNote,
    } satisfies EmailSendResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email delivery failure.";
    await persistEmailRuntimeState("mock", `${successNote} Delivery failed and fell back to local outbox. ${message}`);

    return {
      ...buildMockResult(request, `${successNote} Delivery failed and was saved to the local email outbox instead. ${message}`),
      status: EmailDeliveryStatus.FALLBACK,
    } satisfies EmailSendResult;
  }
}

async function sendViaGmail(request: OutboundEmailRequest): Promise<EmailSendResult> {
  if (!request.recipientEmail?.trim()) {
    const note = "Gmail delivery was selected, but no recipient email was provided for this draft.";
    await persistEmailRuntimeState("mock", note);
    return buildMissingRecipientResult("gmail", request, note);
  }

  if (!hasGmailConfig()) {
    const note =
      "Gmail delivery mode was selected, but GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, or GMAIL_SENDER_EMAIL is missing.";
    await persistEmailRuntimeState("mock", note);
    return buildMissingRecipientResult("gmail", request, note);
  }

  const payload = buildEmailProviderPayload("gmail", request);

  try {
    const accessToken = await refreshOAuthAccessToken({
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: env.gmailOauthClientId,
      clientSecret: env.gmailOauthClientSecret,
      refreshToken: env.gmailOauthRefreshToken,
    });

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: buildGmailRawMessage(request),
      }),
    });

    if (!response.ok) {
      throw new Error(`Gmail delivery failed with status ${response.status}.`);
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string; threadId?: string };
    const externalMessageId = body.id ?? body.threadId ?? `gmail-${Date.now()}`;
    const successNote = "Outbound email sent through the native Gmail adapter.";
    await persistEmailRuntimeState("gmail", successNote);

    return {
      providerMode: EmailSendMode.GMAIL,
      status: EmailDeliveryStatus.SENT,
      externalMessageId,
      providerThreadId: body.threadId ?? externalMessageId,
      payloadJson: JSON.stringify(payload),
      sendNote: successNote,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Gmail delivery failure.";
    await persistEmailRuntimeState("mock", `Gmail delivery failed and fell back to local outbox. ${message}`);

    return {
      ...buildMockResult(request, `Gmail delivery failed and was saved to the local email outbox instead. ${message}`),
      status: EmailDeliveryStatus.FALLBACK,
      payloadJson: JSON.stringify(payload),
    };
  }
}

async function sendViaOutlook(request: OutboundEmailRequest): Promise<EmailSendResult> {
  if (!request.recipientEmail?.trim()) {
    const note = "Outlook delivery was selected, but no recipient email was provided for this draft.";
    await persistEmailRuntimeState("mock", note);
    return buildMissingRecipientResult("outlook", request, note);
  }

  if (!hasOutlookConfig()) {
    const note =
      "Outlook delivery mode was selected, but OUTLOOK_TENANT_ID, OUTLOOK_OAUTH_CLIENT_ID, OUTLOOK_OAUTH_CLIENT_SECRET, or OUTLOOK_OAUTH_REFRESH_TOKEN is missing.";
    await persistEmailRuntimeState("mock", note);
    return buildMissingRecipientResult("outlook", request, note);
  }

  const payload = buildEmailProviderPayload("outlook", request);

  try {
    const accessToken = await refreshOAuthAccessToken({
      tokenUrl: `https://login.microsoftonline.com/${env.outlookTenantId}/oauth2/v2.0/token`,
      clientId: env.outlookOauthClientId,
      clientSecret: env.outlookOauthClientSecret,
      refreshToken: env.outlookOauthRefreshToken,
      scope: "https://graph.microsoft.com/.default offline_access",
    });

    const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: request.subject,
          body: {
            contentType: "Text",
            content: request.body,
          },
          toRecipients: [
            {
              emailAddress: {
                address: request.recipientEmail.trim(),
                name: request.recipientLabel,
              },
            },
          ],
          from: env.outlookSenderEmail
            ? {
                emailAddress: {
                  address: env.outlookSenderEmail,
                },
              }
            : undefined,
        },
        saveToSentItems: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Outlook delivery failed with status ${response.status}.`);
    }

    const successNote = "Outbound email sent through the native Outlook adapter.";
    await persistEmailRuntimeState("outlook", successNote);

    return {
      providerMode: EmailSendMode.OUTLOOK,
      status: EmailDeliveryStatus.SENT,
      externalMessageId: `outlook-${Date.now()}`,
      providerThreadId: null,
      payloadJson: JSON.stringify(payload),
      sendNote: successNote,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Outlook delivery failure.";
    await persistEmailRuntimeState("mock", `Outlook delivery failed and fell back to local outbox. ${message}`);

    return {
      ...buildMockResult(request, `Outlook delivery failed and was saved to the local email outbox instead. ${message}`),
      status: EmailDeliveryStatus.FALLBACK,
      payloadJson: JSON.stringify(payload),
    };
  }
}

export async function sendOutboundEmail(request: OutboundEmailRequest): Promise<EmailSendResult> {
  const mode = await resolveEmailSendMode();

  if (mode === "webhook") {
    return postToWebhook(
      "webhook",
      env.emailSendWebhookUrl,
      request,
      "Outbound email sent through the configured webhook adapter.",
      "Webhook email mode was selected, but EMAIL_SEND_WEBHOOK_URL is missing.",
    );
  }

  if (mode === "gmail") {
    if (env.gmailSendWebhookUrl) {
      return postToWebhook(
        "gmail",
        env.gmailSendWebhookUrl,
        request,
        "Outbound email sent through the configured Gmail webhook adapter.",
        "Gmail delivery mode was selected, but GMAIL_SEND_WEBHOOK_URL is missing.",
      );
    }

    return sendViaGmail(request);
  }

  if (mode === "outlook") {
    if (env.outlookSendWebhookUrl) {
      return postToWebhook(
        "outlook",
        env.outlookSendWebhookUrl,
        request,
        "Outbound email sent through the configured Outlook webhook adapter.",
        "Outlook delivery mode was selected, but OUTLOOK_SEND_WEBHOOK_URL is missing.",
      );
    }

    return sendViaOutlook(request);
  }

  await persistEmailRuntimeState("mock", "Using local mock email delivery.");

  return buildMockResult(request, "Saved to the local outbound email outbox for operator review.");
}
