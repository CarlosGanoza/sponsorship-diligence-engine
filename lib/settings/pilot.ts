import type { PilotTemplateKey } from "@/lib/pilot/templates";
import type { PilotLaunchItemMutationInput, PilotProfile } from "@/lib/pilot/workspace";
import { serializePilotProfile, serializeUpdatedPilotLaunchState } from "@/lib/pilot/workspace";
import { prisma } from "@/lib/db/prisma";

export async function persistPilotTemplate(template: PilotTemplateKey) {
  await prisma.appSetting.upsert({
    where: { key: "PILOT_TEMPLATE" },
    update: { value: template },
    create: { key: "PILOT_TEMPLATE", value: template },
  });

  await prisma.appSetting.upsert({
    where: { key: "PILOT_RUNTIME_NOTE" },
    update: {
      value: `Pilot positioning is now configured for ${template.replaceAll("_", " ").toLowerCase()}.`,
    },
    create: {
      key: "PILOT_RUNTIME_NOTE",
      value: `Pilot positioning is now configured for ${template.replaceAll("_", " ").toLowerCase()}.`,
    },
  });
}

export async function persistPilotProfile(profile: PilotProfile) {
  await prisma.appSetting.upsert({
    where: { key: "PILOT_PROFILE" },
    update: { value: serializePilotProfile(profile) },
    create: { key: "PILOT_PROFILE", value: serializePilotProfile(profile) },
  });
}

export async function persistPilotLaunchItemState(input: {
  template: PilotTemplateKey;
  slug: string;
  update: PilotLaunchItemMutationInput;
}) {
  const currentValue = (await prisma.appSetting.findUnique({
    where: { key: "PILOT_LAUNCH_WORKSTREAM" },
    select: { value: true },
  }))?.value;

  const nextValue = serializeUpdatedPilotLaunchState({
    currentValue,
    templateKey: input.template,
    slug: input.slug,
    update: input.update,
  });

  await prisma.appSetting.upsert({
    where: { key: "PILOT_LAUNCH_WORKSTREAM" },
    update: { value: nextValue },
    create: { key: "PILOT_LAUNCH_WORKSTREAM", value: nextValue },
  });
}
