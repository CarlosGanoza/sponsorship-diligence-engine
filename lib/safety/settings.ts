import { prisma } from "@/lib/db/prisma";

export type SafetySettings = {
  blindReviewMode: boolean;
  strictEvidenceMode: boolean;
  requireOutboundApproval: boolean;
  blockSponsorFacingPii: boolean;
};

const DEFAULT_SAFETY_SETTINGS: SafetySettings = {
  blindReviewMode: false,
  strictEvidenceMode: true,
  requireOutboundApproval: true,
  blockSponsorFacingPii: true,
};

function toBoolean(value: string | null | undefined, fallback: boolean) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

export async function getSafetySettings(): Promise<SafetySettings> {
  try {
    const settings = await prisma.appSetting.findMany({
      where: {
        key: {
          in: [
            "BLIND_REVIEW_MODE",
            "STRICT_EVIDENCE_MODE",
            "REQUIRE_OUTBOUND_APPROVAL",
            "BLOCK_SPONSOR_FACING_PII",
          ],
        },
      },
    });

    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));

    return {
      blindReviewMode: toBoolean(
        settingMap.get("BLIND_REVIEW_MODE"),
        DEFAULT_SAFETY_SETTINGS.blindReviewMode,
      ),
      strictEvidenceMode: toBoolean(
        settingMap.get("STRICT_EVIDENCE_MODE"),
        DEFAULT_SAFETY_SETTINGS.strictEvidenceMode,
      ),
      requireOutboundApproval: toBoolean(
        settingMap.get("REQUIRE_OUTBOUND_APPROVAL"),
        DEFAULT_SAFETY_SETTINGS.requireOutboundApproval,
      ),
      blockSponsorFacingPii: toBoolean(
        settingMap.get("BLOCK_SPONSOR_FACING_PII"),
        DEFAULT_SAFETY_SETTINGS.blockSponsorFacingPii,
      ),
    };
  } catch {
    return DEFAULT_SAFETY_SETTINGS;
  }
}

export async function setBlindReviewMode(enabled: boolean) {
  await prisma.appSetting.upsert({
    where: { key: "BLIND_REVIEW_MODE" },
    update: { value: enabled ? "true" : "false" },
    create: { key: "BLIND_REVIEW_MODE", value: enabled ? "true" : "false" },
  });
}

export async function setStrictEvidenceMode(enabled: boolean) {
  await prisma.appSetting.upsert({
    where: { key: "STRICT_EVIDENCE_MODE" },
    update: { value: enabled ? "true" : "false" },
    create: { key: "STRICT_EVIDENCE_MODE", value: enabled ? "true" : "false" },
  });
}

export async function setRequireOutboundApproval(enabled: boolean) {
  await prisma.appSetting.upsert({
    where: { key: "REQUIRE_OUTBOUND_APPROVAL" },
    update: { value: enabled ? "true" : "false" },
    create: { key: "REQUIRE_OUTBOUND_APPROVAL", value: enabled ? "true" : "false" },
  });
}

export async function setBlockSponsorFacingPii(enabled: boolean) {
  await prisma.appSetting.upsert({
    where: { key: "BLOCK_SPONSOR_FACING_PII" },
    update: { value: enabled ? "true" : "false" },
    create: { key: "BLOCK_SPONSOR_FACING_PII", value: enabled ? "true" : "false" },
  });
}
