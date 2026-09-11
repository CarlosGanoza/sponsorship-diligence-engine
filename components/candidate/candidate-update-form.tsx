"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArtifactType } from "@prisma/client";
import { FileUp } from "lucide-react";

import type { ParsedArtifact } from "@/lib/artifacts/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const artifactOptions = [
  ArtifactType.PROJECT_SUMMARY,
  ArtifactType.RECOMMENDATION,
  ArtifactType.MENTOR_NOTE,
  ArtifactType.REFLECTION,
  ArtifactType.RESUME,
  ArtifactType.PORTFOLIO_LINK,
  ArtifactType.OTHER,
];

export function CandidateUpdateForm({
  candidateId,
  proofRequests,
  replaceableArtifacts,
}: {
  candidateId: string;
  proofRequests: {
    id: string;
    title: string;
    status: string;
  }[];
  replaceableArtifacts: Array<{
    id: string;
    title: string;
    artifactType: ArtifactType;
    versionNumber: number;
  }>;
}) {
  const router = useRouter();
  const [sourceProofRequestId, setSourceProofRequestId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [submittedByLabel, setSubmittedByLabel] = useState("Candidate follow-up");
  const [artifactType, setArtifactType] = useState<ArtifactType>(ArtifactType.PROJECT_SUMMARY);
  const [sourceLabel, setSourceLabel] = useState("Candidate update");
  const [fileName, setFileName] = useState("");
  const [storedFileId, setStoredFileId] = useState("");
  const [replacesArtifactId, setReplacesArtifactId] = useState("");
  const [rawText, setRawText] = useState("");
  const [resolveLinkedProofRequest, setResolveLinkedProofRequest] = useState(true);
  const [pending, setPending] = useState(false);
  const [processingNote, setProcessingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseUploadedFile = async (file: File): Promise<ParsedArtifact> => {
    const payload = new FormData();
    payload.append("file", file);
    payload.append("candidateId", candidateId);
    payload.append("purpose", "CANDIDATE_UPDATE_UPLOAD");

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

    setError(null);

    try {
      const parsed = await parseUploadedFile(file);
      setFileName(parsed.fileName);
      setSourceLabel(parsed.sourceLabel);
      setRawText(parsed.rawText);
      setStoredFileId(parsed.storedFileId ?? "");
      setProcessingNote(parsed.processingNote ?? null);

      if (!title) {
        setTitle(parsed.title);
      }
    } catch (uploadError) {
      setProcessingNote(null);
      setError(uploadError instanceof Error ? uploadError.message : "Could not parse upload.");
    }
  };

  const handleSubmit = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/candidates/${candidateId}/updates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceProofRequestId: sourceProofRequestId || undefined,
          title,
          summary,
        submittedByLabel,
        artifactType,
        sourceLabel,
        fileName,
          storedFileId,
          replacesArtifactId,
          rawText,
          resolveLinkedProofRequest,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
          }
        | null;

      setPending(false);

      if (!response.ok || !result?.success) {
        setError(result?.error ?? "Could not submit candidate update.");
        return;
      }

      setSourceProofRequestId("");
      setTitle("");
      setSummary("");
      setSubmittedByLabel("Candidate follow-up");
      setArtifactType(ArtifactType.PROJECT_SUMMARY);
      setSourceLabel("Candidate update");
      setFileName("");
      setStoredFileId("");
      setReplacesArtifactId("");
      setRawText("");
      setResolveLinkedProofRequest(true);
      setProcessingNote(null);
      router.refresh();
    } catch {
      setPending(false);
      setError("Could not submit candidate update.");
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="candidate-update-proof-request">Linked proof request</Label>
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            id="candidate-update-proof-request"
            onChange={(event) => setSourceProofRequestId(event.target.value)}
            value={sourceProofRequestId}
          >
            <option value="">No linked proof request</option>
            {proofRequests.map((proofRequest) => (
              <option key={proofRequest.id} value={proofRequest.id}>
                {proofRequest.title} · {proofRequest.status.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="candidate-update-title">Update title</Label>
            <Input id="candidate-update-title" onChange={(event) => setTitle(event.target.value)} value={title} />
          </div>
          <div>
            <Label htmlFor="candidate-update-submitted-by">Submitted by</Label>
            <Input
              id="candidate-update-submitted-by"
              onChange={(event) => setSubmittedByLabel(event.target.value)}
              value={submittedByLabel}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="candidate-update-summary">What changed</Label>
          <Textarea
            className="mt-2 min-h-24 bg-ink-50"
            id="candidate-update-summary"
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Describe what new proof arrived, what contradiction was clarified, or what outcome was quantified."
            value={summary}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="candidate-update-artifact-type">Artifact type</Label>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              id="candidate-update-artifact-type"
              onChange={(event) => setArtifactType(event.target.value as ArtifactType)}
              value={artifactType}
            >
              {artifactOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="candidate-update-source-label">Source label</Label>
            <Input id="candidate-update-source-label" onChange={(event) => setSourceLabel(event.target.value)} value={sourceLabel} />
          </div>
          <div>
            <Label htmlFor="candidate-update-file-name">File name</Label>
            <Input id="candidate-update-file-name" onChange={(event) => setFileName(event.target.value)} value={fileName} />
          </div>
        </div>

        <div>
          <Label htmlFor="candidate-update-replaces-artifact">Replace earlier artifact version</Label>
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            id="candidate-update-replaces-artifact"
            onChange={(event) => setReplacesArtifactId(event.target.value)}
            value={replacesArtifactId}
          >
            <option value="">No replacement</option>
            {replaceableArtifacts.map((artifact) => (
              <option key={artifact.id} value={artifact.id}>
                {artifact.title} · {artifact.artifactType.replaceAll("_", " ")} · v{artifact.versionNumber}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-ink-500">
            Use this when the update corrects or supersedes an earlier artifact instead of adding separate active proof.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-dashed border-ink-200 bg-ink-50 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink-900">Attach an original file</p>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                Upload a `.txt`, `.md`, `.pdf`, or `.docx` file. The original is stored for operator inspection while the extracted text remains the canonical evidence record.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={async (event) => {
                  await handleFiles(event.target.files);
                  event.target.value = "";
                }}
                ref={fileInputRef}
                type="file"
              />
              <Button onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">
                <FileUp className="h-4 w-4" />
                Upload file
              </Button>
            </div>
          </div>
          {processingNote ? <p className="mt-3 text-sm leading-6 text-ink-500">{processingNote}</p> : null}
        </div>

        <div>
          <Label htmlFor="candidate-update-raw-text">Update artifact text</Label>
          <Textarea
            className="mt-2 min-h-40 bg-ink-50"
            id="candidate-update-raw-text"
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Paste the new evidence exactly as it should be stored and cited."
            value={rawText}
          />
        </div>

        {sourceProofRequestId ? (
          <label className="flex items-center gap-3 text-sm text-ink-600">
            <input
              checked={resolveLinkedProofRequest}
              className="h-4 w-4 rounded border-ink-300 text-sage-700"
              onChange={(event) => setResolveLinkedProofRequest(event.target.checked)}
              type="checkbox"
            />
            Resolve the linked proof request after this update is submitted.
          </label>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={pending} onClick={handleSubmit} type="button">
            {pending ? "Submitting..." : "Submit update"}
          </Button>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
