import { prisma } from "@/lib/db/prisma";

export type AutomationPolicy = {
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

export const DEFAULT_AUTOMATION_POLICY: AutomationPolicy = {
  minArtifactsForReview: 2,
  minClaimsForReview: 3,
  intakeReadinessMax: 35,
  memoReadinessMin: 68,
  outreachReadinessMin: 70,
  outreachMatchMin: 60,
  holdReadinessMax: 60,
  stalledDeltaMax: 1,
  momentumSurgeDeltaMin: 8,
};

const settingKeyByPolicyField: Record<keyof AutomationPolicy, string> = {
  minArtifactsForReview: "AUTOMATION_MIN_ARTIFACTS_FOR_REVIEW",
  minClaimsForReview: "AUTOMATION_MIN_CLAIMS_FOR_REVIEW",
  intakeReadinessMax: "AUTOMATION_INTAKE_READINESS_MAX",
  memoReadinessMin: "AUTOMATION_MEMO_READINESS_MIN",
  outreachReadinessMin: "AUTOMATION_OUTREACH_READINESS_MIN",
  outreachMatchMin: "AUTOMATION_OUTREACH_MATCH_MIN",
  holdReadinessMax: "AUTOMATION_HOLD_READINESS_MAX",
  stalledDeltaMax: "AUTOMATION_STALLED_DELTA_MAX",
  momentumSurgeDeltaMin: "AUTOMATION_MOMENTUM_SURGE_DELTA_MIN",
};

function parsePolicyValue(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getAutomationPolicy(): Promise<AutomationPolicy> {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: Object.values(settingKeyByPolicyField),
      },
    },
  });

  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    minArtifactsForReview: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.minArtifactsForReview),
      DEFAULT_AUTOMATION_POLICY.minArtifactsForReview,
    ),
    minClaimsForReview: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.minClaimsForReview),
      DEFAULT_AUTOMATION_POLICY.minClaimsForReview,
    ),
    intakeReadinessMax: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.intakeReadinessMax),
      DEFAULT_AUTOMATION_POLICY.intakeReadinessMax,
    ),
    memoReadinessMin: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.memoReadinessMin),
      DEFAULT_AUTOMATION_POLICY.memoReadinessMin,
    ),
    outreachReadinessMin: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.outreachReadinessMin),
      DEFAULT_AUTOMATION_POLICY.outreachReadinessMin,
    ),
    outreachMatchMin: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.outreachMatchMin),
      DEFAULT_AUTOMATION_POLICY.outreachMatchMin,
    ),
    holdReadinessMax: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.holdReadinessMax),
      DEFAULT_AUTOMATION_POLICY.holdReadinessMax,
    ),
    stalledDeltaMax: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.stalledDeltaMax),
      DEFAULT_AUTOMATION_POLICY.stalledDeltaMax,
    ),
    momentumSurgeDeltaMin: parsePolicyValue(
      settingMap.get(settingKeyByPolicyField.momentumSurgeDeltaMin),
      DEFAULT_AUTOMATION_POLICY.momentumSurgeDeltaMin,
    ),
  };
}

export async function saveAutomationPolicy(policy: AutomationPolicy) {
  await prisma.$transaction(
    (Object.keys(settingKeyByPolicyField) as Array<keyof AutomationPolicy>).map((field) =>
      prisma.appSetting.upsert({
        where: {
          key: settingKeyByPolicyField[field],
        },
        update: {
          value: String(policy[field]),
        },
        create: {
          key: settingKeyByPolicyField[field],
          value: String(policy[field]),
        },
      }),
    ),
  );
}
