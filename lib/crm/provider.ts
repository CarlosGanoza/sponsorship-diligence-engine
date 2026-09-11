import { CrmSyncMode, CrmSyncStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/db/env";
import { buildCrmProviderPayload } from "@/lib/crm/adapters";
import { resolveCrmFieldMappings } from "@/lib/crm/mappings";
import type { CrmHandoffRecord } from "@/lib/outreach/handoff";

type RuntimeMode = "mock" | "webhook" | "hubspot" | "salesforce" | "airtable";

async function persistCrmRuntimeState(mode: RuntimeMode, note: string) {
  const payload = note.trim().slice(0, 280);

  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await prisma.appSetting.upsert({
      where: { key: "CRM_RUNTIME_MODE" },
      update: { value: mode },
      create: { key: "CRM_RUNTIME_MODE", value: mode },
    });

    await prisma.appSetting.upsert({
      where: { key: "CRM_RUNTIME_NOTE" },
      update: { value: payload },
      create: { key: "CRM_RUNTIME_NOTE", value: payload },
    });
  } catch {
    // CRM runtime state should not block the sync itself.
  }
}

export async function resolveCrmMode() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "CRM_SYNC_MODE" },
    });

    if (
      setting?.value === "webhook" ||
      setting?.value === "mock" ||
      setting?.value === "hubspot" ||
      setting?.value === "salesforce" ||
      setting?.value === "airtable"
    ) {
      return setting.value;
    }
  } catch {
    return env.crmSyncMode;
  }

  return env.crmSyncMode;
}

type CrmSyncResult = {
  providerMode: CrmSyncMode;
  status: CrmSyncStatus;
  externalRecordId: string | null;
  syncNote: string;
};

function buildMockResult(note: string): CrmSyncResult {
  return {
    providerMode: CrmSyncMode.MOCK,
    status: CrmSyncStatus.SYNCED,
    externalRecordId: `local-${Date.now()}`,
    syncNote: note,
  };
}

async function syncProviderWebhook(
  providerMode: CrmSyncMode,
  runtimeMode: Exclude<RuntimeMode, "mock" | "webhook">,
  url: string,
  record: CrmHandoffRecord,
) {
  const payload = buildCrmProviderPayload(providerMode, record, {
    fieldMappings: await resolveCrmFieldMappings(providerMode),
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`${runtimeMode} webhook sync failed with status ${response.status}.`);
    }

    const body = await response.json().catch(() => ({}));
    const externalRecordId =
      typeof body?.id === "string"
        ? body.id
        : typeof body?.recordId === "string"
          ? body.recordId
          : `${runtimeMode}-${Date.now()}`;
    const successNote = `CRM handoff synced through the configured ${runtimeMode} webhook adapter.`;
    await persistCrmRuntimeState(runtimeMode, successNote);

    return {
      providerMode,
      status: CrmSyncStatus.SYNCED,
      externalRecordId,
      syncNote: successNote,
    } satisfies CrmSyncResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CRM webhook sync failure.";
    await persistCrmRuntimeState("mock", `${runtimeMode} webhook sync failed. Fell back to local outbox. ${message}`);

    return {
      ...buildMockResult(`${runtimeMode} webhook sync failed. Saved to local CRM outbox instead. ${message}`),
      status: CrmSyncStatus.FALLBACK,
    } satisfies CrmSyncResult;
  }
}

async function syncViaWebhook(record: CrmHandoffRecord): Promise<CrmSyncResult> {
  if (!env.crmWebhookUrl) {
    await persistCrmRuntimeState(
      "mock",
      "Webhook CRM mode was selected, but CRM_WEBHOOK_URL is missing. Fell back to local mock sync.",
    );
    return {
      ...buildMockResult("Webhook CRM mode was selected, but CRM_WEBHOOK_URL is missing. Saved to local CRM outbox instead."),
      status: CrmSyncStatus.FALLBACK,
    };
  }

  try {
    const response = await fetch(env.crmWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      throw new Error(`Webhook sync failed with status ${response.status}.`);
    }

    const payload = await response.json().catch(() => ({}));
    const externalRecordId =
      typeof payload?.id === "string"
        ? payload.id
        : typeof payload?.recordId === "string"
          ? payload.recordId
          : `webhook-${Date.now()}`;

    await persistCrmRuntimeState("webhook", "Using live webhook CRM sync.");

    return {
      providerMode: CrmSyncMode.WEBHOOK,
      status: CrmSyncStatus.SYNCED,
      externalRecordId,
      syncNote: "CRM handoff synced through the configured webhook endpoint.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook sync failure.";
    await persistCrmRuntimeState("mock", `Webhook CRM sync failed. Fell back to local mock sync. ${message}`);

    return {
      ...buildMockResult(`Webhook CRM sync failed. Saved to local CRM outbox instead. ${message}`),
      status: CrmSyncStatus.FALLBACK,
    };
  }
}

async function syncViaHubSpot(record: CrmHandoffRecord): Promise<CrmSyncResult> {
  const payload = buildCrmProviderPayload(CrmSyncMode.HUBSPOT, record, {
    fieldMappings: await resolveCrmFieldMappings(CrmSyncMode.HUBSPOT),
  }) as {
    hubspotObject: {
      objectType: string;
      properties: Record<string, string>;
    };
  };

  if (!env.hubspotAccessToken) {
    const note = "HubSpot CRM mode was selected, but HUBSPOT_ACCESS_TOKEN is missing.";
    await persistCrmRuntimeState("mock", note);
    return {
      ...buildMockResult(`${note} Saved to local CRM outbox instead.`),
      status: CrmSyncStatus.FALLBACK,
    };
  }

  try {
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.hubspotAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload.hubspotObject),
    });

    if (!response.ok) {
      throw new Error(`HubSpot sync failed with status ${response.status}.`);
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    const successNote = "CRM handoff synced through the native HubSpot adapter.";
    await persistCrmRuntimeState("hubspot", successNote);

    return {
      providerMode: CrmSyncMode.HUBSPOT,
      status: CrmSyncStatus.SYNCED,
      externalRecordId: body.id ?? `hubspot-${Date.now()}`,
      syncNote: successNote,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown HubSpot sync failure.";
    await persistCrmRuntimeState("mock", `HubSpot CRM sync failed. Fell back to local outbox. ${message}`);

    return {
      ...buildMockResult(`HubSpot CRM sync failed. Saved to local CRM outbox instead. ${message}`),
      status: CrmSyncStatus.FALLBACK,
    };
  }
}

async function syncViaSalesforce(record: CrmHandoffRecord): Promise<CrmSyncResult> {
  const payload = buildCrmProviderPayload(CrmSyncMode.SALESFORCE, record, {
    fieldMappings: await resolveCrmFieldMappings(CrmSyncMode.SALESFORCE),
  }) as {
    salesforceRecord: {
      object: string;
      fields: Record<string, string>;
    };
  };

  if (!env.salesforceInstanceUrl || !env.salesforceAccessToken) {
    const note = "Salesforce CRM mode was selected, but SALESFORCE_INSTANCE_URL or SALESFORCE_ACCESS_TOKEN is missing.";
    await persistCrmRuntimeState("mock", note);
    return {
      ...buildMockResult(`${note} Saved to local CRM outbox instead.`),
      status: CrmSyncStatus.FALLBACK,
    };
  }

  try {
    const instanceUrl = env.salesforceInstanceUrl.replace(/\/+$/u, "");
    const response = await fetch(`${instanceUrl}/services/data/v61.0/sobjects/Task`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.salesforceAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload.salesforceRecord.fields),
    });

    if (!response.ok) {
      throw new Error(`Salesforce sync failed with status ${response.status}.`);
    }

    const body = (await response.json().catch(() => ({}))) as { id?: string };
    const successNote = "CRM handoff synced through the native Salesforce adapter.";
    await persistCrmRuntimeState("salesforce", successNote);

    return {
      providerMode: CrmSyncMode.SALESFORCE,
      status: CrmSyncStatus.SYNCED,
      externalRecordId: body.id ?? `salesforce-${Date.now()}`,
      syncNote: successNote,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Salesforce sync failure.";
    await persistCrmRuntimeState("mock", `Salesforce CRM sync failed. Fell back to local outbox. ${message}`);

    return {
      ...buildMockResult(`Salesforce CRM sync failed. Saved to local CRM outbox instead. ${message}`),
      status: CrmSyncStatus.FALLBACK,
    };
  }
}

async function syncViaAirtable(record: CrmHandoffRecord): Promise<CrmSyncResult> {
  const payload = buildCrmProviderPayload(CrmSyncMode.AIRTABLE, record, {
    fieldMappings: await resolveCrmFieldMappings(CrmSyncMode.AIRTABLE),
  }) as {
    airtableRecord: {
      table: string;
      fields: Record<string, string | number>;
    };
  };

  if (!env.airtableAccessToken || !env.airtableBaseId) {
    const note = "Airtable CRM mode was selected, but AIRTABLE_ACCESS_TOKEN or AIRTABLE_BASE_ID is missing.";
    await persistCrmRuntimeState("mock", note);
    return {
      ...buildMockResult(`${note} Saved to local CRM outbox instead.`),
      status: CrmSyncStatus.FALLBACK,
    };
  }

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${encodeURIComponent(env.airtableBaseId)}/${encodeURIComponent(env.airtableTableName)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.airtableAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [
            {
              fields: payload.airtableRecord.fields,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Airtable sync failed with status ${response.status}.`);
    }

    const body = (await response.json().catch(() => ({}))) as {
      records?: Array<{ id?: string }>;
    };
    const successNote = "CRM handoff synced through the native Airtable adapter.";
    await persistCrmRuntimeState("airtable", successNote);

    return {
      providerMode: CrmSyncMode.AIRTABLE,
      status: CrmSyncStatus.SYNCED,
      externalRecordId: body.records?.[0]?.id ?? `airtable-${Date.now()}`,
      syncNote: successNote,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Airtable sync failure.";
    await persistCrmRuntimeState("mock", `Airtable CRM sync failed. Fell back to local outbox. ${message}`);

    return {
      ...buildMockResult(`Airtable CRM sync failed. Saved to local CRM outbox instead. ${message}`),
      status: CrmSyncStatus.FALLBACK,
    };
  }
}

export async function syncCrmHandoff(record: CrmHandoffRecord): Promise<CrmSyncResult> {
  const mode = await resolveCrmMode();

  if (mode === "webhook") {
    return syncViaWebhook(record);
  }

  if (mode === "hubspot") {
    if (env.hubspotCrmWebhookUrl) {
      return syncProviderWebhook(CrmSyncMode.HUBSPOT, "hubspot", env.hubspotCrmWebhookUrl, record);
    }

    return syncViaHubSpot(record);
  }

  if (mode === "salesforce") {
    if (env.salesforceCrmWebhookUrl) {
      return syncProviderWebhook(CrmSyncMode.SALESFORCE, "salesforce", env.salesforceCrmWebhookUrl, record);
    }

    return syncViaSalesforce(record);
  }

  if (mode === "airtable") {
    if (env.airtableCrmWebhookUrl) {
      return syncProviderWebhook(CrmSyncMode.AIRTABLE, "airtable", env.airtableCrmWebhookUrl, record);
    }

    return syncViaAirtable(record);
  }

  await persistCrmRuntimeState("mock", "Using local mock CRM sync.");

  return buildMockResult("Saved to the local CRM outbox for demo and operator review.");
}
