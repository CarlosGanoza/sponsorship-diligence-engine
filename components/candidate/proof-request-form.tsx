"use client";

import { useEffect, useState } from "react";
import { ProofRequestType } from "@prisma/client";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ProofRequestForm({
  candidateId,
  suggestions,
  teamMembers,
}: {
  candidateId: string;
  suggestions: Array<{
    requestType: ProofRequestType;
    title: string;
    detail: string;
  }>;
  teamMembers: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<ProofRequestType>(
    suggestions[0]?.requestType ?? ProofRequestType.MISSING_PROOF,
  );
  const [title, setTitle] = useState(suggestions[0]?.title ?? "");
  const [detail, setDetail] = useState(suggestions[0]?.detail ?? "");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    if (!title && suggestions[0]) {
      setRequestType(suggestions[0].requestType);
      setTitle(suggestions[0].title);
      setDetail(suggestions[0].detail);
    }
  }, [suggestions, title]);

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" data-testid="proof-request-form">
      <p className="text-sm font-medium text-ink-900">Open proof request</p>
      <p className="mt-1 text-sm text-ink-500">
        Turn missing proof or contradictory evidence into a tracked operator workflow item.
      </p>

      {suggestions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.slice(0, 4).map((suggestion) => (
            <Button
              disabled={!hydrated || pending}
              key={`${suggestion.requestType}-${suggestion.detail}`}
              onClick={() => {
                setSuccess(null);
                setRequestType(suggestion.requestType);
                setTitle(suggestion.title);
                setDetail(suggestion.detail);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {suggestion.title}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <select
          className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
          onChange={(event) => setRequestType(event.target.value as ProofRequestType)}
          value={requestType}
        >
          {Object.values(ProofRequestType).map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <Input onChange={(event) => setTitle(event.target.value)} placeholder="Short proof request title" value={title} />
        <Textarea
          onChange={(event) => setDetail(event.target.value)}
          placeholder="What proof is missing or contradictory, and what should the operator request next?"
          rows={4}
          value={detail}
        />
        <div className="grid gap-3 md:grid-cols-[1fr_0.8fr]">
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            onChange={(event) => setAssignedUserId(event.target.value)}
            value={assignedUserId}
          >
            <option value="">Unassigned</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {member.role}
              </option>
            ))}
          </select>
          <Input onChange={(event) => setDueAt(event.target.value)} type="date" value={dueAt} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-ink-500">
            Proof requests remain separate from memo language and create inspectable follow-through.
          </p>
          <Button
            disabled={pending || !hydrated}
            onClick={async () => {
              setPending(true);
              setError(null);
              setSuccess(null);

              const response = await fetch(`/api/candidates/${candidateId}/proof-requests`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  requestType,
                  title,
                  detail,
                  assignedUserId,
                  dueAt,
                }),
              }).catch(() => null);
              setPending(false);

              if (!response?.ok) {
                const payload = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
                setError(payload?.error ?? "Could not create proof request.");
                return;
              }

              if (suggestions[0]) {
                setRequestType(suggestions[0].requestType);
                setTitle(suggestions[0].title);
                setDetail(suggestions[0].detail);
              } else {
                setRequestType(ProofRequestType.MISSING_PROOF);
                setTitle("");
                setDetail("");
              }
              setAssignedUserId("");
              setDueAt("");
              setSuccess("Proof request opened. Refreshing workflow.");
              router.refresh();
            }}
            size="sm"
            variant="secondary"
          >
            {pending ? "Saving..." : "Open request"}
          </Button>
        </div>
      </div>
      {success ? <p className="mt-2 text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
