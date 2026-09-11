"use client";

import { ArtifactType } from "@prisma/client";
import { useRef, useState } from "react";
import { FileUp } from "lucide-react";

import type { ParsedArtifact } from "@/lib/artifacts/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const artifactOptions = [
  ArtifactType.PROJECT_SUMMARY,
  ArtifactType.REFLECTION,
  ArtifactType.RECOMMENDATION,
  ArtifactType.MENTOR_NOTE,
  ArtifactType.RESUME,
  ArtifactType.PORTFOLIO_LINK,
  ArtifactType.OTHER,
];

export function PublicUpdateIntakeForm({
  token,
  requestTitle,
  suggestedArtifactType,
  guidanceChecklist,
  guidanceExample,
  replaceableArtifacts,
}: {
  token: string;
  requestTitle: string;
  suggestedArtifactType: ArtifactType;
  guidanceChecklist: string[];
  guidanceExample: string;
  replaceableArtifacts: Array<{
    id: string;
    title: string;
    artifactType: ArtifactType;
    versionNumber: number;
  }>;
}) {
  const [title, setTitle] = useState(requestTitle);
  const [summary, setSummary] = useState("");
  const [submittedByLabel, setSubmittedByLabel] = useState("Candidate");
  const [artifactType, setArtifactType] = useState<ArtifactType>(suggestedArtifactType);
  const [fileName, setFileName] = useState("");
  const [storedFileId, setStoredFileId] = useState("");
  const [replacesArtifactId, setReplacesArtifactId] = useState("");
  const [rawText, setRawText] = useState("");
  const [ownershipScope, setOwnershipScope] = useState("");
  const [quantifiedOutcome, setQuantifiedOutcome] = useState("");
  const [thirdPartyContext, setThirdPartyContext] = useState("");
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [processingNote, setProcessingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseUploadedFile = async (file: File): Promise<ParsedArtifact> => {
    const payload = new FormData();
    payload.append("file", file);

    const response = await fetch(`/api/updates/${token}/parse`, {
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
      setStoredFileId(parsed.storedFileId ?? "");
      setRawText(parsed.rawText);
      setProcessingNote(parsed.processingNote ?? null);
      setArtifactType(suggestedArtifactType);

      if (!title) {
        setTitle(parsed.title);
      }
    } catch (uploadError) {
      setProcessingNote(null);
      setError(uploadError instanceof Error ? uploadError.message : "Could not parse upload.");
    }
  };

  if (submitted) {
    return (
      <div className="rounded-[2rem] border border-sage-200 bg-sage-50 px-6 py-6">
        <p className="text-sm font-medium text-sage-900">Update submitted</p>
        <p className="mt-3 text-sm leading-7 text-sage-800">
          Your evidence update has been recorded for operator review. The team can now inspect the submitted proof inside the underwriting file.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[2rem] border border-ink-100 bg-white px-6 py-6 shadow-soft">
        <div className="grid gap-4">
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <p className="text-sm font-medium text-ink-900">Submission guidance</p>
          <div className="mt-3 space-y-2">
            {guidanceChecklist.map((item) => (
              <p className="text-sm leading-6 text-ink-600" key={item}>
                {item}
              </p>
            ))}
          </div>
          <p className="mt-4 rounded-2xl bg-white px-3 py-3 text-sm italic leading-7 text-ink-500">{guidanceExample}</p>
        </div>
        <div className="rounded-[1.5rem] border border-dashed border-ink-200 bg-ink-50 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink-900">Attach an original file</p>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                Upload a `.txt`, `.md`, `.pdf`, or `.docx` file if the proof already exists as a document. The team stores the original for inspection and extracts only readable text into the underwriting file.
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
          <Label htmlFor="public-update-title">Update title</Label>
          <Input id="public-update-title" onChange={(event) => setTitle(event.target.value)} value={title} />
        </div>
        <div>
          <Label htmlFor="public-update-summary">What changed</Label>
          <Textarea
            className="mt-2 min-h-24 bg-ink-50"
            id="public-update-summary"
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Describe the new evidence, clarification, or result you are adding."
            value={summary}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="public-update-submitted-by">Submitted by</Label>
            <Input
              id="public-update-submitted-by"
              onChange={(event) => setSubmittedByLabel(event.target.value)}
              value={submittedByLabel}
            />
          </div>
          <div>
            <Label htmlFor="public-update-artifact-type">Evidence type</Label>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
              id="public-update-artifact-type"
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
        </div>
        <div>
          <Label htmlFor="public-update-replaces-artifact">Replace an earlier artifact</Label>
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            id="public-update-replaces-artifact"
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
            Choose this only if the new file corrects or supersedes an earlier artifact rather than adding new evidence.
          </p>
        </div>
        <div>
          <Label htmlFor="public-update-raw-text">Evidence text</Label>
          <Textarea
            className="mt-2 min-h-48 bg-ink-50"
            id="public-update-raw-text"
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Paste the evidence exactly as you want it reviewed, using concrete and inspectable language."
            value={rawText}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="public-update-ownership">Ownership scope</Label>
            <Textarea
              className="mt-2 min-h-28 bg-ink-50"
              id="public-update-ownership"
              onChange={(event) => setOwnershipScope(event.target.value)}
              placeholder="What you directly owned, decided, or drove."
              value={ownershipScope}
            />
          </div>
          <div>
            <Label htmlFor="public-update-outcome">Quantified outcome</Label>
            <Textarea
              className="mt-2 min-h-28 bg-ink-50"
              id="public-update-outcome"
              onChange={(event) => setQuantifiedOutcome(event.target.value)}
              placeholder="Any measurable result, timeframe, or scope."
              value={quantifiedOutcome}
            />
          </div>
          <div>
            <Label htmlFor="public-update-third-party">Third-party context</Label>
            <Textarea
              className="mt-2 min-h-28 bg-ink-50"
              id="public-update-third-party"
              onChange={(event) => setThirdPartyContext(event.target.value)}
              placeholder="Manager, mentor, partner, or public corroboration if relevant."
              value={thirdPartyContext}
            />
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
          <div className="flex items-start gap-3 text-sm leading-6 text-ink-600">
            <input
              aria-label="I confirm this submission is accurate and may be reviewed internally."
              checked={consentAcknowledged}
              className="mt-1 h-4 w-4 rounded border border-ink-300 text-sage-700 focus:ring-sage-200"
              id="public-update-consent"
              onChange={(event) => setConsentAcknowledged(event.target.checked)}
              type="checkbox"
            />
            <label className="cursor-pointer" htmlFor="public-update-consent">
              I confirm this submission is accurate to the best of my knowledge and may be reviewed by the operator team as part of an internal sponsorship decision.
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            disabled={pending || !consentAcknowledged}
            onClick={async () => {
              setPending(true);
              setError(null);
              const response = await fetch(`/api/updates/${token}/submit`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  title,
                  summary,
                  submittedByLabel,
                  artifactType,
                  fileName,
                  storedFileId,
                  replacesArtifactId,
                  rawText,
                  ownershipScope,
                  quantifiedOutcome,
                  thirdPartyContext,
                  consentAcknowledged: true,
                }),
              });
              const data = (await response.json().catch(() => null)) as { error?: string } | null;
              setPending(false);

              if (!response.ok) {
                setError(data?.error ?? "Could not submit update.");
                return;
              }

              setSubmitted(true);
            }}
            type="button"
          >
            {pending ? "Submitting..." : "Submit update"}
          </Button>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </div>
  );
}
