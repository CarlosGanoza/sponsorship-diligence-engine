"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PilotProfile } from "@/lib/pilot/workspace";

export function PilotProfileControls({
  profile,
}: {
  profile: PilotProfile;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(profile);

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" data-testid="pilot-profile-controls">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">Pilot profile</p>
          <p className="mt-1 text-sm text-ink-500">
            This identity layer is reused across onboarding, guided demo, pilot brief, and commercial proof.
          </p>
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);
            setSuccess(null);
            startTransition(async () => {
              const response = await fetch("/api/pilot/profile", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(form),
              }).catch(() => null);

              setPending(false);

              if (!response?.ok) {
                const payload = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
                setError(payload?.error ?? "Could not save the pilot profile.");
                return;
              }

              setSuccess("Pilot profile saved. Refreshing buyer-facing surfaces.");
              router.refresh();
            });
          }}
          size="sm"
          variant="secondary"
        >
          {pending ? "Saving..." : "Save profile"}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input
          onChange={(event) => setForm((current) => ({ ...current, pilotName: event.target.value }))}
          placeholder="Pilot name"
          value={form.pilotName}
        />
        <Input
          onChange={(event) => setForm((current) => ({ ...current, designPartnerName: event.target.value }))}
          placeholder="Design partner"
          value={form.designPartnerName}
        />
        <Input
          onChange={(event) => setForm((current) => ({ ...current, programName: event.target.value }))}
          placeholder="Program name"
          value={form.programName}
        />
        <Input
          onChange={(event) => setForm((current) => ({ ...current, targetLaunchDate: event.target.value }))}
          type="date"
          value={form.targetLaunchDate}
        />
        <Input
          onChange={(event) => setForm((current) => ({ ...current, primaryContactName: event.target.value }))}
          placeholder="Primary contact"
          value={form.primaryContactName}
        />
        <Input
          onChange={(event) => setForm((current) => ({ ...current, primaryContactEmail: event.target.value }))}
          placeholder="Primary contact email"
          type="email"
          value={form.primaryContactEmail}
        />
      </div>
      <div className="mt-3">
        <Textarea
          onChange={(event) => setForm((current) => ({ ...current, packSummary: event.target.value }))}
          placeholder="Short customer-facing pilot summary"
          rows={4}
          value={form.packSummary}
        />
      </div>
      {success ? <p className="mt-3 text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
