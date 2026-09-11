import type { AiProvider } from "@/lib/ai/types";
import { prisma } from "@/lib/db/prisma";

type RuntimeMode = "mock" | "live";

async function persistAiRuntimeState(mode: RuntimeMode, note: string) {
  const payload = note.trim().slice(0, 280);

  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    await prisma.appSetting.upsert({
      where: { key: "AI_RUNTIME_MODE" },
      update: { value: mode },
      create: { key: "AI_RUNTIME_MODE", value: mode },
    });

    await prisma.appSetting.upsert({
      where: { key: "AI_RUNTIME_NOTE" },
      update: { value: payload },
      create: { key: "AI_RUNTIME_NOTE", value: payload },
    });
  } catch {
    // Runtime status reporting should never block the AI workflow itself.
  }
}

export async function setAiRuntimeState(mode: RuntimeMode, note: string) {
  await persistAiRuntimeState(mode, note);
}

export function createResilientAiProvider({
  liveProvider,
  fallbackProvider,
  liveModel,
}: {
  liveProvider: AiProvider;
  fallbackProvider: AiProvider;
  liveModel: string;
}): AiProvider {
  return {
    async extractEvidenceClaims(input) {
      try {
        const result = await liveProvider.extractEvidenceClaims(input);
        await persistAiRuntimeState("live", `Using live OpenAI extraction via ${liveModel}.`);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown live AI extraction failure.";
        await persistAiRuntimeState("mock", `Live extraction failed. Fell back to mock mode. ${message}`);
        return fallbackProvider.extractEvidenceClaims(input);
      }
    },

    async generateSponsorMemo(input) {
      try {
        const result = await liveProvider.generateSponsorMemo(input);
        await persistAiRuntimeState("live", `Using live OpenAI memo generation via ${liveModel}.`);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown live AI memo failure.";
        await persistAiRuntimeState("mock", `Live memo generation failed. Fell back to mock mode. ${message}`);
        return fallbackProvider.generateSponsorMemo(input);
      }
    },

    async recommendNextAdvocacyAction(input) {
      try {
        const result = await liveProvider.recommendNextAdvocacyAction(input);
        await persistAiRuntimeState("live", `Using live OpenAI action recommendation via ${liveModel}.`);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown live AI recommendation failure.";
        await persistAiRuntimeState("mock", `Live next-action generation failed. Fell back to mock mode. ${message}`);
        return fallbackProvider.recommendNextAdvocacyAction(input);
      }
    },

    async explainSponsorMatch(input) {
      try {
        const result = await liveProvider.explainSponsorMatch(input);
        await persistAiRuntimeState("live", `Using live OpenAI sponsor-match explanation via ${liveModel}.`);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown live AI sponsor-match failure.";
        await persistAiRuntimeState("mock", `Live sponsor-match explanation failed. Fell back to mock mode. ${message}`);
        return fallbackProvider.explainSponsorMatch(input);
      }
    },
  };
}
