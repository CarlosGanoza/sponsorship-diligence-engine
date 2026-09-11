import { CrmSyncMode } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const CRM_FIELD_MAPPING_KEYS = {
  hubspot: "CRM_FIELD_MAPPING_HUBSPOT",
  salesforce: "CRM_FIELD_MAPPING_SALESFORCE",
  airtable: "CRM_FIELD_MAPPING_AIRTABLE",
} as const;

const HUBSPOT_ALLOWED_FIELDS = ["body"] as const;
const SALESFORCE_ALLOWED_FIELDS = ["subject", "description", "status", "priority"] as const;
const AIRTABLE_ALLOWED_FIELDS = [
  "candidate",
  "sponsor",
  "opportunity",
  "matchScore",
  "readinessScore",
  "nextStep",
] as const;

type MappingProvider = keyof typeof CRM_FIELD_MAPPING_KEYS;
type MappingEntry = {
  sourceField: string;
  destinationField: string;
};

const DEFAULT_FIELD_MAPPINGS: Record<MappingProvider, MappingEntry[]> = {
  hubspot: [{ sourceField: "body", destinationField: "hs_note_body" }],
  salesforce: [
    { sourceField: "subject", destinationField: "Subject" },
    { sourceField: "description", destinationField: "Description" },
    { sourceField: "status", destinationField: "Status" },
    { sourceField: "priority", destinationField: "Priority" },
  ],
  airtable: [
    { sourceField: "candidate", destinationField: "Candidate" },
    { sourceField: "sponsor", destinationField: "Sponsor" },
    { sourceField: "opportunity", destinationField: "Opportunity" },
    { sourceField: "matchScore", destinationField: "Match Score" },
    { sourceField: "readinessScore", destinationField: "Readiness Score" },
    { sourceField: "nextStep", destinationField: "Next Step" },
  ],
};

function getAllowedFields(provider: MappingProvider) {
  if (provider === "hubspot") {
    return HUBSPOT_ALLOWED_FIELDS;
  }

  if (provider === "salesforce") {
    return SALESFORCE_ALLOWED_FIELDS;
  }

  return AIRTABLE_ALLOWED_FIELDS;
}

export function getCrmFieldMappingSettingKey(provider: MappingProvider) {
  return CRM_FIELD_MAPPING_KEYS[provider];
}

export function getDefaultCrmFieldMappings(provider: MappingProvider) {
  return DEFAULT_FIELD_MAPPINGS[provider];
}

export function serializeCrmFieldMappings(entries: MappingEntry[]) {
  return JSON.stringify(entries, null, 2);
}

export function formatCrmFieldMappingsForEditor(provider: MappingProvider, serialized?: string | null) {
  const normalized = normalizeCrmFieldMappingInput(serialized ?? "", provider);

  if (!normalized.success) {
    return serializeCrmFieldMappings(getDefaultCrmFieldMappings(provider));
  }

  return normalized.serialized;
}

export function normalizeCrmFieldMappingInput(rawValue: string, explicitProvider?: MappingProvider) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    if (!explicitProvider) {
      return {
        success: false as const,
        error: "Add at least one CRM field mapping.",
      };
    }

    return {
      success: true as const,
      serialized: serializeCrmFieldMappings(getDefaultCrmFieldMappings(explicitProvider)),
      entries: getDefaultCrmFieldMappings(explicitProvider),
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      success: false as const,
      error: "CRM field mappings must be valid JSON.",
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      success: false as const,
      error: "CRM field mappings must be a JSON array.",
    };
  }

  const entries = parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const sourceField = typeof (item as { sourceField?: unknown }).sourceField === "string"
        ? (item as { sourceField: string }).sourceField.trim()
        : "";
      const destinationField = typeof (item as { destinationField?: unknown }).destinationField === "string"
        ? (item as { destinationField: string }).destinationField.trim()
        : "";

      if (!sourceField || !destinationField) {
        return null;
      }

      return { sourceField, destinationField };
    })
    .filter((entry): entry is MappingEntry => Boolean(entry));

  if (entries.length === 0) {
    return {
      success: false as const,
      error: "CRM field mappings must include at least one source and destination pair.",
    };
  }

  const provider = explicitProvider ?? inferProviderFromEntries(entries);

  if (!provider) {
    return {
      success: false as const,
      error: "CRM field mappings use unsupported source fields.",
    };
  }

  const allowedFields = new Set(getAllowedFields(provider));
  const unsupported = entries.find((entry) => !allowedFields.has(entry.sourceField as never));

  if (unsupported) {
    return {
      success: false as const,
      error: `Unsupported source field "${unsupported.sourceField}" for ${provider}.`,
    };
  }

  const uniqueEntries = entries.filter(
    (entry, index) =>
      entries.findIndex((candidate) => candidate.sourceField === entry.sourceField) === index,
  );

  return {
    success: true as const,
    serialized: serializeCrmFieldMappings(uniqueEntries),
    entries: uniqueEntries,
    provider,
  };
}

function inferProviderFromEntries(entries: MappingEntry[]): MappingProvider | null {
  const providers = (Object.keys(CRM_FIELD_MAPPING_KEYS) as MappingProvider[]).filter((provider) => {
    const allowedFields = new Set(getAllowedFields(provider));
    return entries.every((entry) => allowedFields.has(entry.sourceField as never));
  });

  return providers[0] ?? null;
}

export async function resolveCrmFieldMappings(providerMode: CrmSyncMode) {
  if (
    providerMode !== CrmSyncMode.HUBSPOT &&
    providerMode !== CrmSyncMode.SALESFORCE &&
    providerMode !== CrmSyncMode.AIRTABLE
  ) {
    return [] as MappingEntry[];
  }

  const provider = providerMode.toLowerCase() as MappingProvider;

  try {
    const setting = await prisma.appSetting.findUnique({
      where: {
        key: getCrmFieldMappingSettingKey(provider),
      },
    });

    const normalized = normalizeCrmFieldMappingInput(setting?.value ?? "", provider);

    if (!normalized.success) {
      return getDefaultCrmFieldMappings(provider);
    }

    return normalized.entries;
  } catch {
    return getDefaultCrmFieldMappings(provider);
  }
}

export function remapCrmFields(
  provider: MappingProvider,
  baseFields: Record<string, string | number>,
  mappings?: MappingEntry[],
) {
  const activeMappings = mappings?.length ? mappings : getDefaultCrmFieldMappings(provider);

  return activeMappings.reduce<Record<string, string | number>>((accumulator, entry) => {
    if (entry.sourceField in baseFields) {
      accumulator[entry.destinationField] = baseFields[entry.sourceField]!;
    }

    return accumulator;
  }, {});
}
