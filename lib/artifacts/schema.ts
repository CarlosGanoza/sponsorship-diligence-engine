import { z } from "zod";

export const supportedArtifactUploadKinds = ["txt", "md", "pdf", "docx"] as const;

export const artifactUploadKindSchema = z.enum(supportedArtifactUploadKinds);

export const parsedArtifactSchema = z.object({
  uploadKind: artifactUploadKindSchema,
  title: z.string().min(1),
  rawText: z.string().min(1),
  sourceLabel: z.string().min(1),
  fileName: z.string().min(1),
  storedFileId: z.string().min(1).optional(),
  processingNote: z.string().min(1).optional(),
});

export type ParsedArtifact = z.infer<typeof parsedArtifactSchema>;
