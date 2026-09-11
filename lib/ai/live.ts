import { env } from "@/lib/db/env";
import {
  advocacyActionSchema,
  evidenceExtractionSchema,
  sponsorMatchExplanationSchema,
  sponsorMemoSchema,
} from "@/lib/ai/schemas";
import type { AiProvider } from "@/lib/ai/types";

async function requestJson<T>({
  system,
  user,
  schema,
}: {
  system: string;
  user: string;
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: unknown } };
}) {
  if (!env.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: env.openAiModel,
      temperature: 0.2,
      response_format: {
        type: "json_object",
      },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI response did not contain JSON content.");
  }

  const parsed = schema.safeParse(JSON.parse(content));

  if (!parsed.success) {
    throw new Error("OpenAI response did not match the expected schema.");
  }

  return parsed.data as T;
}

export const liveAiProvider: AiProvider = {
  async extractEvidenceClaims({ candidate, artifact }) {
    return requestJson({
      system:
        "You extract structured evidence claims from human potential artifacts. Only use explicit evidence. Do not infer demographic traits, prestige, or potential beyond the text. Return JSON only.",
      user: JSON.stringify({
        task: "Extract 2-4 evidence claims grounded in the artifact text.",
        candidate,
        artifact,
        categories:
          "initiative, follow_through, leadership, adaptability, communication, analytical_thinking, collaboration, resilience, mission_alignment",
      }),
      schema: evidenceExtractionSchema,
    });
  },

  async generateSponsorMemo({ candidate, artifacts, claims, readinessScore, readinessBreakdown }) {
    return requestJson({
      system:
        "You write cautious, sponsor-ready conviction memos grounded only in provided evidence. Do not flatter the candidate. Prefer explicit limits over speculation. Ignore demographic or identity inference. Cite the provided artifact titles inline where useful. Return JSON only.",
      user: JSON.stringify({
        task: "Generate a sponsor memo with executive summary, rationale, strongest signals, risks, opportunity types, next action, and markdown memo.",
        candidate,
        readinessScore,
        readinessBreakdown,
        artifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          title: artifact.title,
          artifactType: artifact.artifactType,
          sourceLabel: artifact.sourceLabel,
        })),
        claims,
      }),
      schema: sponsorMemoSchema,
    });
  },

  async recommendNextAdvocacyAction({ candidate, artifacts, claims, readinessScore }) {
    return requestJson({
      system:
        "You recommend the next advocacy action for a candidate based on inspectable evidence. Prefer hold or do_not_advance when proof is weak. Do not flatter the candidate. Ignore demographic or identity inference. Return JSON only.",
      user: JSON.stringify({
        task: "Recommend the best next advocacy action, choose a decision of advance|hold|do_not_advance, and list proof gaps or reasons not to move now.",
        candidate,
        readinessScore,
        artifacts: artifacts.map((artifact) => ({
          title: artifact.title,
          artifactType: artifact.artifactType,
        })),
        claims,
      }),
      schema: advocacyActionSchema,
    });
  },

  async explainSponsorMatch({ candidate, sponsor, claims, matchScore, matchBreakdown, connectionPath }) {
    return requestJson({
      system:
        "You explain sponsor-target matches in a transparent, non-hypey manner. If the fit is weak, say so plainly. Ignore demographic or identity inference. Return JSON only.",
      user: JSON.stringify({
        task: "Explain why this sponsor is or is not a fit, what signals matter, what the warm path is, and what proof is still missing.",
        candidate,
        sponsor,
        claims,
        matchScore,
        matchBreakdown,
        connectionPath,
      }),
      schema: sponsorMatchExplanationSchema,
    });
  },
};
