"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NoteType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CandidateNoteForm({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>(NoteType.GENERAL);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
      <p className="text-sm font-medium text-ink-900">Add operator note</p>
      <p className="mt-1 text-sm text-ink-500">
        Keep human judgment separate from AI output. Notes are timestamped and attributed.
      </p>
      <div className="mt-4 grid gap-3">
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setNoteType(event.target.value as NoteType)}
          value={noteType}
        >
          {Object.values(NoteType).map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <Input
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Optional note title"
          value={title}
        />
        <Textarea
          onChange={(event) => setContent(event.target.value)}
          placeholder="What changed, what you trust, what still needs proof, or what to watch next."
          rows={4}
          value={content}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-ink-500">Notes appear in the candidate workflow log and dashboard context.</p>
          <Button
            disabled={pending || !hydrated}
            onClick={async () => {
              setPending(true);
              setError(null);
              setSuccess(null);

              const response = await fetch(`/api/candidates/${candidateId}/notes`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  noteType,
                  title,
                  content,
                }),
              }).catch(() => null);
              setPending(false);

              if (!response?.ok) {
                setError("Note save failed.");
                return;
              }

              setTitle("");
              setContent("");
              setNoteType(NoteType.GENERAL);
              setSuccess("Note saved. Refreshing workflow.");
              router.refresh();
            }}
            size="sm"
          >
            {pending ? "Saving..." : "Save note"}
          </Button>
        </div>
      </div>
      {success ? <p className="mt-2 text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
