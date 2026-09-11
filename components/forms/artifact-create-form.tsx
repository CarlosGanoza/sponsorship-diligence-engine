"use client";

import { useRef, useState, type DragEvent } from "react";
import { ArtifactType } from "@prisma/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, Upload } from "lucide-react";

import type { ParsedArtifact } from "@/lib/artifacts/schema";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  artifactType: z.nativeEnum(ArtifactType),
  title: z.string().min(3),
  sourceLabel: z.string().min(2),
  fileName: z.string().optional(),
  storedFileId: z.string().optional(),
  replacesArtifactId: z.string().optional(),
  rawText: z.string().min(30),
});

type FormValues = z.infer<typeof schema>;

const artifactOptions = [
  ArtifactType.RESUME,
  ArtifactType.PROJECT_SUMMARY,
  ArtifactType.MENTOR_NOTE,
  ArtifactType.RECOMMENDATION,
  ArtifactType.REFLECTION,
  ArtifactType.PORTFOLIO_LINK,
  ArtifactType.OTHER,
];

function inferUploadSourceLabel(fileName: string) {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith(".pdf") && (lowerFileName.includes("scan") || lowerFileName.includes("ocr"))) {
    return "Scanned PDF OCR";
  }

  if (lowerFileName.endsWith(".docx")) {
    return "Parsed DOCX upload";
  }

  if (lowerFileName.endsWith(".pdf")) {
    return "Parsed PDF upload";
  }

  return "Parsed text upload";
}

export function ArtifactCreateForm({
  candidateId,
  replaceableArtifacts,
}: {
  candidateId: string;
  replaceableArtifacts: Array<{
    id: string;
    title: string;
    artifactType: ArtifactType;
    versionNumber: number;
  }>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingNote, setProcessingNote] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      artifactType: ArtifactType.PROJECT_SUMMARY,
      title: "",
      sourceLabel: "Candidate upload",
      fileName: "",
      storedFileId: "",
      replacesArtifactId: "",
      rawText: "",
    },
  });

  const rawText = form.watch("rawText");

  const applyParsedArtifact = ({
    rawText,
    fileName,
    sourceLabel,
    title,
    processingNote,
    storedFileId,
  }: {
    rawText: string;
    fileName?: string;
    sourceLabel?: string;
    title?: string;
    processingNote?: string;
    storedFileId?: string;
  }) => {
    const trimmed = rawText.trim();

    if (!trimmed) {
      setError("The dropped artifact did not contain readable text.");
      return;
    }

    form.setValue("rawText", trimmed, { shouldDirty: true, shouldValidate: true });

    if (fileName) {
      form.setValue("fileName", fileName, { shouldDirty: true, shouldValidate: true });
      if (!form.getValues("title")) {
        form.setValue(
          "title",
          title ?? fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
          { shouldDirty: true, shouldValidate: true },
        );
      }
    } else if (title && !form.getValues("title")) {
      form.setValue("title", title, { shouldDirty: true, shouldValidate: true });
    }

    if (sourceLabel) {
      form.setValue("sourceLabel", sourceLabel, { shouldDirty: true, shouldValidate: true });
    }

    form.setValue("storedFileId", storedFileId ?? "", { shouldDirty: true, shouldValidate: false });

    setProcessingNote(processingNote ?? null);
    setError(null);
  };

  const parseUploadedFile = async (file: File): Promise<ParsedArtifact> => {
    const payload = new FormData();
    payload.append("file", file);
    payload.append("candidateId", candidateId);
    payload.append("purpose", "ARTIFACT_UPLOAD");

    const response = await fetch("/api/artifacts/parse", {
      method: "POST",
      body: payload,
    });

    const data = (await response.json()) as ParsedArtifact | { error?: string };

    if (!response.ok) {
      throw new Error("error" in data ? data.error || "Could not parse upload." : "Could not parse upload.");
    }

    return data as ParsedArtifact;
  };

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];

    if (!file) {
      return;
    }

    setIsParsingUpload(true);
    setError(null);
    form.setValue("fileName", file.name, { shouldDirty: true, shouldValidate: true });
    form.setValue("title", file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("sourceLabel", inferUploadSourceLabel(file.name), {
      shouldDirty: true,
      shouldValidate: true,
    });

    try {
      const parsed = await parseUploadedFile(file);

      applyParsedArtifact({
        rawText: parsed.rawText,
        fileName: parsed.fileName,
        sourceLabel: parsed.sourceLabel,
        title: parsed.title,
        storedFileId: parsed.storedFileId,
        processingNote: parsed.processingNote,
      });
    } catch (uploadError) {
      setProcessingNote(null);
      setError(uploadError instanceof Error ? uploadError.message : "Could not parse upload.");
    } finally {
      setIsParsingUpload(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files?.length) {
      await handleFiles(event.dataTransfer.files);
      return;
    }

    const draggedText = event.dataTransfer.getData("text/plain");

    if (draggedText) {
      applyParsedArtifact({
        rawText: draggedText,
        sourceLabel: "Dragged text",
        processingNote: "Stored as inspectable plain text from a direct drag-and-drop input.",
      });
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(`/api/candidates/${candidateId}/artifacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        artifactId?: string;
      };

      if (!response.ok || !result.success) {
        setIsPending(false);
        setError(result.error ?? "Could not save artifact.");
        return;
      }

      const hash = result.artifactId ? `#artifact-${result.artifactId}` : "";
      window.location.assign(`/candidates/${candidateId}?tab=evidence&refresh=${Date.now()}${hash}`);
    } catch (submitError) {
      setIsPending(false);
      setError(submitError instanceof Error ? submitError.message : "Could not save artifact.");
    }
  });

  return (
    <Card className="px-5 py-5" data-testid="artifact-create-form">
      <CardHeader className="border-b border-ink-100 pb-5">
        <div>
          <CardTitle className="text-2xl">Add evidence artifact</CardTitle>
          <CardDescription className="mt-2">
            Paste text first. The extraction pipeline is optimized for typed evidence in this MVP.
          </CardDescription>
        </div>
      </CardHeader>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div
          className={`rounded-[2rem] border border-dashed px-5 py-5 transition ${
            isDragging
              ? "border-sage-500 bg-sage-50"
              : "border-ink-200 bg-ink-50 hover:border-sage-300 hover:bg-white"
          }`}
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sage-700 shadow-soft">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink-900">Drag and drop an artifact</p>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  Drop a `.txt`, `.md`, `.pdf`, or `.docx` file, or drag plain text directly into the intake zone. The parser extracts text server-side and keeps the stored artifact inspectable.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <input
                accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                data-testid="artifact-file-input"
                onChange={async (event) => {
                  await handleFiles(event.target.files);
                  event.target.value = "";
                }}
                ref={fileInputRef}
                type="file"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                type="button"
                variant="secondary"
              >
                <FileUp className="h-4 w-4" />
                {isParsingUpload ? "Parsing file..." : "Choose file"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="artifactType">Artifact type</Label>
            <select
              className="h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              id="artifactType"
              {...form.register("artifactType")}
            >
              {artifactOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sourceLabel">Source label</Label>
            <Input id="sourceLabel" {...form.register("sourceLabel")} placeholder="Mentor note" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} placeholder="Project Summary - Community Health Ops" />
          </div>
          <div>
            <Label htmlFor="fileName">Optional file name</Label>
            <Input id="fileName" {...form.register("fileName")} placeholder="summary.pdf" />
          </div>
        </div>

        <div>
          <Label htmlFor="replacesArtifactId">Replace earlier artifact version</Label>
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            id="replacesArtifactId"
            {...form.register("replacesArtifactId")}
          >
            <option value="">No replacement</option>
            {replaceableArtifacts.map((artifact) => (
              <option key={artifact.id} value={artifact.id}>
                {artifact.title} · {artifact.artifactType.replaceAll("_", " ")} · v{artifact.versionNumber}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-ink-500">
            Use this when a new upload corrects or supersedes an earlier artifact without counting both as active proof.
          </p>
        </div>

        <div>
          <Label htmlFor="rawText">Raw text</Label>
          <Textarea
            id="rawText"
            {...form.register("rawText")}
            placeholder="Paste the evidence as plain text. The AI layer will only use what is present here."
          />
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
            {rawText.trim().length} characters loaded
          </p>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {isParsingUpload ? (
          <p className="text-sm text-ink-500">Parsing upload and extracting readable text...</p>
        ) : null}
        {!isParsingUpload && processingNote ? (
          <p className="text-sm leading-6 text-ink-500">{processingNote}</p>
        ) : null}

        <Button disabled={isPending || isParsingUpload} type="submit" variant="secondary">
          {isPending ? "Saving artifact..." : "Save artifact"}
        </Button>
      </form>
    </Card>
  );
}
