"use client";

import { NotificationChannel } from "@prisma/client";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import {
  resetDemoDataAction,
  runBackgroundJobsAction,
  saveAutomationPolicyAction,
  setAiModeAction,
  setAlertNotificationPreferenceAction,
  setBackgroundJobsModeAction,
  setBlindReviewModeAction,
  setBlockSponsorFacingPiiAction,
  setCrmFieldMappingAction,
  setCrmModeAction,
  setEmailSendModeAction,
  setGuidedDemoModeAction,
  setRequireOutboundApprovalAction,
  setStrictEvidenceModeAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPilotTemplates, type PilotTemplateKey } from "@/lib/pilot/templates";
import { Textarea } from "@/components/ui/textarea";

export function SettingsControls({
  aiMode,
  crmMode,
  emailSendMode,
  hasOpenAiKey,
  hasCrmWebhookUrl,
  hasHubspotAccessToken,
  hasSalesforceConfig,
  hasAirtableConfig,
  hasEmailWebhookUrl,
  hasGmailConfig,
  hasOutlookConfig,
  hasEmailDigestWebhook,
  hasSlackDigestWebhook,
  alertNotifyEmail,
  alertNotifySlack,
  alertNotifyOps,
  blindReviewMode,
  strictEvidenceMode,
  requireOutboundApproval,
  blockSponsorFacingPii,
  pilotTemplate,
  guidedDemoMode,
  backgroundJobsMode,
  hasJobRunnerToken,
  automationPolicy,
  crmFieldMappings,
}: {
  aiMode: "mock" | "live";
  crmMode: "mock" | "webhook" | "hubspot" | "salesforce" | "airtable";
  emailSendMode: "mock" | "webhook" | "gmail" | "outlook";
  hasOpenAiKey: boolean;
  hasCrmWebhookUrl: boolean;
  hasHubspotAccessToken: boolean;
  hasSalesforceConfig: boolean;
  hasAirtableConfig: boolean;
  hasEmailWebhookUrl: boolean;
  hasGmailConfig: boolean;
  hasOutlookConfig: boolean;
  hasEmailDigestWebhook: boolean;
  hasSlackDigestWebhook: boolean;
  alertNotifyEmail: boolean;
  alertNotifySlack: boolean;
  alertNotifyOps: boolean;
  blindReviewMode: boolean;
  strictEvidenceMode: boolean;
  requireOutboundApproval: boolean;
  blockSponsorFacingPii: boolean;
  pilotTemplate: PilotTemplateKey;
  guidedDemoMode: boolean;
  backgroundJobsMode: "inline" | "queue";
  hasJobRunnerToken: boolean;
  automationPolicy: {
    minArtifactsForReview: number;
    minClaimsForReview: number;
    intakeReadinessMax: number;
    memoReadinessMin: number;
    outreachReadinessMin: number;
    outreachMatchMin: number;
    holdReadinessMax: number;
    stalledDeltaMax: number;
    momentumSurgeDeltaMin: number;
  };
  crmFieldMappings: {
    hubspot: string;
    salesforce: string;
    airtable: string;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [policy, setPolicy] = useState(automationPolicy);
  const [fieldMappings, setFieldMappings] = useState(crmFieldMappings);
  const templates = listPilotTemplates();

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">AI mode</CardTitle>
            <CardDescription className="mt-2">
              Switch between deterministic mock outputs and live OpenAI calls. Live mode still falls back to mock if no API key exists.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setPending("mock");
              setError(null);
              startTransition(async () => {
                const result = await setAiModeAction("mock");
                setPending(null);
                if (!result.success) {
                  setError("Could not switch AI mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={aiMode === "mock" ? "primary" : "secondary"}
          >
            {pending === "mock" ? "Switching..." : "Use mock mode"}
          </Button>
          <Button
            onClick={() => {
              setPending("live");
              setError(null);
              startTransition(async () => {
                const result = await setAiModeAction("live");
                setPending(null);
                if (!result.success) {
                  setError("Could not switch AI mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={aiMode === "live" ? "primary" : "secondary"}
          >
            {pending === "live" ? "Switching..." : "Use live mode"}
          </Button>
        </div>
        {!hasOpenAiKey ? (
          <p className="mt-4 text-sm leading-6 text-ink-500">
            No `OPENAI_API_KEY` is configured, so live mode will transparently fall back to mock behavior until a key is added.
          </p>
        ) : null}
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">CRM sync mode</CardTitle>
            <CardDescription className="mt-2">
              Choose between the local outbox, a webhook adapter, or direct provider sync. Every mode still falls back safely when required credentials are missing.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setPending("crm-mock");
              setError(null);
              startTransition(async () => {
                const result = await setCrmModeAction("mock");
                setPending(null);
                if (!result.success) {
                  setError("Could not switch CRM sync mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={crmMode === "mock" ? "primary" : "secondary"}
          >
            {pending === "crm-mock" ? "Switching..." : "Use local outbox"}
          </Button>
          <Button
            onClick={() => {
              setPending("crm-webhook");
              setError(null);
              startTransition(async () => {
                const result = await setCrmModeAction("webhook");
                setPending(null);
                if (!result.success) {
                  setError("Could not switch CRM sync mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={crmMode === "webhook" ? "primary" : "secondary"}
          >
            {pending === "crm-webhook" ? "Switching..." : "Use webhook mode"}
          </Button>
          <Button
            onClick={() => {
              setPending("crm-hubspot");
              setError(null);
              startTransition(async () => {
                const result = await setCrmModeAction("hubspot");
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not switch CRM sync mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={crmMode === "hubspot" ? "primary" : "secondary"}
          >
            {pending === "crm-hubspot" ? "Switching..." : "Use HubSpot"}
          </Button>
          <Button
            onClick={() => {
              setPending("crm-salesforce");
              setError(null);
              startTransition(async () => {
                const result = await setCrmModeAction("salesforce");
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not switch CRM sync mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={crmMode === "salesforce" ? "primary" : "secondary"}
          >
            {pending === "crm-salesforce" ? "Switching..." : "Use Salesforce"}
          </Button>
          <Button
            onClick={() => {
              setPending("crm-airtable");
              setError(null);
              startTransition(async () => {
                const result = await setCrmModeAction("airtable");
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not switch CRM sync mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={crmMode === "airtable" ? "primary" : "secondary"}
          >
            {pending === "crm-airtable" ? "Switching..." : "Use Airtable"}
          </Button>
        </div>
        {!hasCrmWebhookUrl || !hasHubspotAccessToken || !hasSalesforceConfig || !hasAirtableConfig ? (
          <p className="mt-4 text-sm leading-6 text-ink-500">
            Webhook, HubSpot, Salesforce, and Airtable modes stay safe: if credentials are missing, sync falls back to the local CRM outbox instead of failing blind.
          </p>
        ) : null}
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">CRM field mappings</CardTitle>
            <CardDescription className="mt-2">
              Map internal handoff fields into native HubSpot, Salesforce, and Airtable payload keys. Stored as JSON so the downstream contract stays inspectable.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 space-y-4">
          {(["hubspot", "salesforce", "airtable"] as const).map((provider) => (
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={provider}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{provider}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-500">
                    Use an array of <code>{`{ "sourceField": "...", "destinationField": "..." }`}</code> entries.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setPending(`crm-map-${provider}`);
                    setError(null);
                    startTransition(async () => {
                      const result = await setCrmFieldMappingAction({
                        provider,
                        value: fieldMappings[provider],
                      });
                      setPending(null);
                      if (!result.success) {
                        setError(result.error ?? "Could not save CRM field mapping.");
                        return;
                      }
                      router.refresh();
                    });
                  }}
                  size="sm"
                  variant="secondary"
                >
                  {pending === `crm-map-${provider}` ? "Saving..." : "Save mapping"}
                </Button>
              </div>
              <Textarea
                className="mt-4 min-h-32 bg-white"
                onChange={(event) =>
                  setFieldMappings((current) => ({
                    ...current,
                    [provider]: event.target.value,
                  }))
                }
                value={fieldMappings[provider]}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">Outbound email mode</CardTitle>
            <CardDescription className="mt-2">
              Choose between the local outbox, a webhook adapter, or direct Gmail and Outlook delivery. Missing credentials degrade safely to stored outbound records.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setPending("email-mock");
              setError(null);
              startTransition(async () => {
                const result = await setEmailSendModeAction("mock");
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not switch email send mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={emailSendMode === "mock" ? "primary" : "secondary"}
          >
            {pending === "email-mock" ? "Switching..." : "Use local outbox"}
          </Button>
          <Button
            onClick={() => {
              setPending("email-webhook");
              setError(null);
              startTransition(async () => {
                const result = await setEmailSendModeAction("webhook");
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not switch email send mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={emailSendMode === "webhook" ? "primary" : "secondary"}
          >
            {pending === "email-webhook" ? "Switching..." : "Use webhook mode"}
          </Button>
          <Button
            onClick={() => {
              setPending("email-gmail");
              setError(null);
              startTransition(async () => {
                const result = await setEmailSendModeAction("gmail");
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not switch email send mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={emailSendMode === "gmail" ? "primary" : "secondary"}
          >
            {pending === "email-gmail" ? "Switching..." : "Use Gmail"}
          </Button>
          <Button
            onClick={() => {
              setPending("email-outlook");
              setError(null);
              startTransition(async () => {
                const result = await setEmailSendModeAction("outlook");
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not switch email send mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={emailSendMode === "outlook" ? "primary" : "secondary"}
          >
            {pending === "email-outlook" ? "Switching..." : "Use Outlook"}
          </Button>
        </div>
        {!hasEmailWebhookUrl || !hasGmailConfig || !hasOutlookConfig ? (
          <p className="mt-4 text-sm leading-6 text-ink-500">
            Webhook, Gmail, and Outlook modes all degrade safely. If a provider is selected without valid credentials, the send is captured in the local outbound outbox instead.
          </p>
        ) : null}
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">Review discipline</CardTitle>
            <CardDescription className="mt-2">
              Control whether identity cues are hidden during review and whether weak or unsupported outputs are automatically pushed into review.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Blind review mode</p>
              <p className="mt-1 text-sm text-ink-500">
                Mask candidate names, headlines, and regions on primary review surfaces.
              </p>
            </div>
            <Button
              onClick={() => {
                setPending("blind-review");
                setError(null);
                startTransition(async () => {
                  const result = await setBlindReviewModeAction(!blindReviewMode);
                  setPending(null);
                  if (!result.success) {
                    setError("Could not update blind review mode.");
                    return;
                  }
                  router.refresh();
                });
              }}
              size="sm"
              variant={blindReviewMode ? "primary" : "secondary"}
            >
              {pending === "blind-review" ? "Saving..." : blindReviewMode ? "Enabled" : "Enable"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Strict evidence mode</p>
              <p className="mt-1 text-sm text-ink-500">
                Push memo outputs into review when proof is weak, missing, or unsupported.
              </p>
            </div>
            <Button
              onClick={() => {
                setPending("strict-evidence");
                setError(null);
                startTransition(async () => {
                  const result = await setStrictEvidenceModeAction(!strictEvidenceMode);
                  setPending(null);
                  if (!result.success) {
                    setError("Could not update strict evidence mode.");
                    return;
                  }
                  router.refresh();
                });
              }}
              size="sm"
              variant={strictEvidenceMode ? "primary" : "secondary"}
            >
              {pending === "strict-evidence" ? "Saving..." : strictEvidenceMode ? "Enabled" : "Enable"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Outbound approval required</p>
              <p className="mt-1 text-sm text-ink-500">
                Require explicit release approval before sponsor-facing outreach or CRM handoff.
              </p>
            </div>
            <Button
              onClick={() => {
                setPending("outbound-approval");
                setError(null);
                startTransition(async () => {
                  const result = await setRequireOutboundApprovalAction(!requireOutboundApproval);
                  setPending(null);
                  if (!result.success) {
                    setError("Could not update outbound approval policy.");
                    return;
                  }
                  router.refresh();
                });
              }}
              size="sm"
              variant={requireOutboundApproval ? "primary" : "secondary"}
            >
              {pending === "outbound-approval" ? "Saving..." : requireOutboundApproval ? "Enabled" : "Enable"}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Block sponsor-facing contact details</p>
              <p className="mt-1 text-sm text-ink-500">
                Keep memo, brief, packet, and outreach exports blocked when sponsor-facing text still includes email addresses or phone numbers.
              </p>
            </div>
            <Button
              onClick={() => {
                setPending("pii-block");
                setError(null);
                startTransition(async () => {
                  const result = await setBlockSponsorFacingPiiAction(!blockSponsorFacingPii);
                  setPending(null);
                  if (!result.success) {
                    setError("Could not update sponsor-facing redaction policy.");
                    return;
                  }
                  router.refresh();
                });
              }}
              size="sm"
              variant={blockSponsorFacingPii ? "primary" : "secondary"}
            >
              {pending === "pii-block" ? "Saving..." : blockSponsorFacingPii ? "Enabled" : "Enable"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">Pilot posture</CardTitle>
            <CardDescription className="mt-2">
              Configure the product around the buyer you are trying to win and whether the workspace should surface a guided walkthrough.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-ink-900">Pilot template</p>
            <p className="mt-1 text-sm text-ink-500">
              This adjusts the pilot and ROI surfaces without changing the underlying evidence workflow.
            </p>
          </div>
          <div className="grid gap-3">
            {templates.map((template) => (
              <div
                className="flex items-start justify-between gap-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4"
                key={template.key}
              >
                <div>
                  <p className="text-sm font-medium text-ink-900">{template.label}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-500">{template.summary}</p>
                </div>
                <form
                  action="/settings/pilot-template"
                  method="post"
                  onSubmit={() => {
                    setPending(`pilot-${template.key}`);
                    setError(null);
                  }}
                >
                  <input name="template" type="hidden" value={template.key} />
                  <Button
                    aria-label={`Use ${template.label} pilot template`}
                    size="sm"
                    type="submit"
                    variant={pilotTemplate === template.key ? "primary" : "secondary"}
                  >
                    {pending === `pilot-${template.key}` ? "Saving..." : pilotTemplate === template.key ? "Active" : "Use"}
                  </Button>
                </form>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-ink-900">Guided demo mode</p>
              <p className="mt-1 text-sm text-ink-500">
                Prioritize a recommended executive walkthrough and buyer-facing pilot framing.
              </p>
            </div>
            <Button
              aria-label="Toggle guided demo mode"
              onClick={() => {
                setPending("guided-demo");
                setError(null);
                startTransition(async () => {
                  const result = await setGuidedDemoModeAction(!guidedDemoMode);
                  setPending(null);
                  if (!result.success) {
                    setError("Could not update guided demo mode.");
                    return;
                  }
                  window.location.reload();
                });
              }}
              size="sm"
              variant={guidedDemoMode ? "primary" : "secondary"}
            >
              {pending === "guided-demo" ? "Saving..." : guidedDemoMode ? "Enabled" : "Enable"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">Background jobs</CardTitle>
            <CardDescription className="mt-2">
              Choose whether long-running work runs inline during operator actions or is queued for a worker.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              setPending("jobs-inline");
              setError(null);
              startTransition(async () => {
                const result = await setBackgroundJobsModeAction("inline");
                setPending(null);
                if (!result.success) {
                  setError("Could not switch background job mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={backgroundJobsMode === "inline" ? "primary" : "secondary"}
          >
            {pending === "jobs-inline" ? "Saving..." : "Use inline mode"}
          </Button>
          <Button
            onClick={() => {
              setPending("jobs-queue");
              setError(null);
              startTransition(async () => {
                const result = await setBackgroundJobsModeAction("queue");
                setPending(null);
                if (!result.success) {
                  setError("Could not switch background job mode.");
                  return;
                }
                router.refresh();
              });
            }}
            variant={backgroundJobsMode === "queue" ? "primary" : "secondary"}
          >
            {pending === "jobs-queue" ? "Saving..." : "Use queue mode"}
          </Button>
          <Button
            onClick={() => {
              setPending("jobs-run");
              setError(null);
              startTransition(async () => {
                const result = await runBackgroundJobsAction(10);
                setPending(null);
                if (!result.success) {
                  setError("Could not run background jobs.");
                  return;
                }
                router.refresh();
              });
            }}
            variant="secondary"
          >
            {pending === "jobs-run" ? "Running..." : "Run queued jobs now"}
          </Button>
        </div>
        {!hasJobRunnerToken ? (
          <p className="mt-4 text-sm leading-6 text-ink-500">
            No `JOB_RUNNER_TOKEN` is configured yet, so hosted queue mode should be paired with the manual runner or the `npm run jobs:work` worker process.
          </p>
        ) : null}
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">Demo data</CardTitle>
            <CardDescription className="mt-2">
              Reset the local SQLite database to the curated fictional dataset used for the demo flow.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6">
          <Button
            onClick={() => {
              setPending("reset");
              setError(null);
              startTransition(async () => {
                const result = await resetDemoDataAction();
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not reset demo data.");
                  return;
                }
                router.refresh();
              });
            }}
            variant="secondary"
          >
            {pending === "reset" ? "Resetting..." : "Seed / reset demo data"}
          </Button>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </div>
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">Alert routing</CardTitle>
            <CardDescription className="mt-2">
              Control which digest channels are enabled for operator alerts. Live webhooks are used when configured; otherwise deliveries stay in the local outbox.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 space-y-4">
          {[
            {
              channel: NotificationChannel.EMAIL_DIGEST,
              label: "Email digest",
              enabled: alertNotifyEmail,
            },
            {
              channel: NotificationChannel.SLACK_DIGEST,
              label: "Slack digest",
              enabled: alertNotifySlack,
            },
            {
              channel: NotificationChannel.OPS_QUEUE,
              label: "Ops queue",
              enabled: alertNotifyOps,
            },
          ].map((item) => (
            <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.channel}>
              <div>
                <p className="text-sm font-medium text-ink-900">{item.label}</p>
                <p className="mt-1 text-sm text-ink-500">{item.enabled ? "Enabled" : "Disabled"}</p>
              </div>
              <Button
                onClick={() => {
                  setPending(item.channel);
                  setError(null);
                  startTransition(async () => {
                    const result = await setAlertNotificationPreferenceAction(item.channel, !item.enabled);
                    setPending(null);
                    if (!result.success) {
                      setError("Could not update alert routing.");
                      return;
                    }
                    router.refresh();
                  });
                }}
                size="sm"
                variant={item.enabled ? "secondary" : "ghost"}
              >
                {pending === item.channel ? "Saving..." : item.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-ink-500">
          Email webhook: {hasEmailDigestWebhook ? "configured" : "not configured"} · Slack webhook:{" "}
          {hasSlackDigestWebhook ? "configured" : "not configured"}
        </p>
      </Card>

      <Card className="px-6 py-6">
        <CardHeader className="border-b border-ink-100 pb-5">
          <div>
            <CardTitle className="text-2xl">Stage policy</CardTitle>
            <CardDescription className="mt-2">
              Tune the transparent thresholds that move candidates between intake, review, memo-ready, hold, and outreach stages.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {[
            ["minArtifactsForReview", "Min artifacts"],
            ["minClaimsForReview", "Min claims"],
            ["intakeReadinessMax", "Intake max"],
            ["memoReadinessMin", "Memo min"],
            ["outreachReadinessMin", "Outreach readiness"],
            ["outreachMatchMin", "Outreach match"],
            ["holdReadinessMax", "Hold max"],
            ["stalledDeltaMax", "Stalled delta"],
            ["momentumSurgeDeltaMin", "Surge delta"],
          ].map(([key, label]) => (
            <label className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={key}>
              <p className="text-sm font-medium text-ink-900">{label}</p>
              <input
                className="mt-3 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                onChange={(event) =>
                  setPolicy((current) => ({
                    ...current,
                    [key]: Number(event.target.value),
                  }))
                }
                type="number"
                value={policy[key as keyof typeof policy]}
              />
            </label>
          ))}
        </div>
        <div className="mt-5">
          <Button
            onClick={() => {
              setPending("policy");
              setError(null);
              startTransition(async () => {
                const result = await saveAutomationPolicyAction(policy);
                setPending(null);
                if (!result.success) {
                  setError(result.error ?? "Could not save automation policy.");
                  return;
                }
                router.refresh();
              });
            }}
            variant="secondary"
          >
            {pending === "policy" ? "Saving..." : "Save stage policy"}
          </Button>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </div>
      </Card>
    </div>
  );
}
