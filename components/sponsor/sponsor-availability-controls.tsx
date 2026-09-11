"use client";

import { SponsorAvailabilityStatus } from "@prisma/client";
import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SPONSOR_AVAILABILITY_LABELS: Record<SponsorAvailabilityStatus, string> = {
  OPEN: "Open",
  LIMITED: "Limited",
  PAUSED: "Paused",
};

export function SponsorAvailabilityControls({
  sponsorId,
  initialAvailabilityStatus,
  initialMaxConcurrentPaths,
  initialWarmIntroAvailable,
  initialAvailabilityNote,
  initialBlackoutUntil,
  initialBlackoutReason,
}: {
  sponsorId: string;
  initialAvailabilityStatus: SponsorAvailabilityStatus;
  initialMaxConcurrentPaths: number;
  initialWarmIntroAvailable: boolean;
  initialAvailabilityNote?: string | null;
  initialBlackoutUntil?: string | null;
  initialBlackoutReason?: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-6 rounded-[2rem] border border-ink-100 bg-white px-4 py-4"
      onSubmit={(event) => event.preventDefault()}
      ref={formRef}
    >
      <div className="border-b border-ink-100 pb-4">
        <p className="text-sm font-medium text-ink-900">Availability controls</p>
        <p className="mt-1 text-sm text-ink-500">
          Keep sponsor match scoring grounded in actual availability, not only fit.
        </p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="sponsor-availability-status">Availability</Label>
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={initialAvailabilityStatus}
            id="sponsor-availability-status"
            name="availabilityStatus"
          >
            {Object.values(SponsorAvailabilityStatus).map((status) => (
              <option key={status} value={status}>
                {SPONSOR_AVAILABILITY_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="sponsor-max-paths">Max concurrent paths</Label>
          <Input
            defaultValue={String(initialMaxConcurrentPaths)}
            id="sponsor-max-paths"
            min={1}
            name="maxConcurrentPaths"
            type="number"
          />
        </div>
        <label className="flex items-end gap-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-3 text-sm text-ink-700">
          <input
            className="mt-1 h-4 w-4 rounded border-ink-300 text-sage-700 focus:ring-sage-500"
            defaultChecked={initialWarmIntroAvailable}
            name="warmIntroAvailable"
            type="checkbox"
          />
          Warm intro currently available
        </label>
      </div>
      <div className="mt-4">
        <Label htmlFor="sponsor-availability-note">Availability note</Label>
        <Input
          defaultValue={initialAvailabilityNote ?? ""}
          id="sponsor-availability-note"
          name="availabilityNote"
          placeholder="Optional note about timing, scope, or current sponsor load"
        />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="sponsor-blackout-until">Blackout until</Label>
          <Input
            defaultValue={initialBlackoutUntil ?? ""}
            id="sponsor-blackout-until"
            name="blackoutUntil"
            type="date"
          />
        </div>
        <div>
          <Label htmlFor="sponsor-blackout-reason">Blackout reason</Label>
          <Input
            defaultValue={initialBlackoutReason ?? ""}
            id="sponsor-blackout-reason"
            name="blackoutReason"
            placeholder="Optional timing constraint or temporary do-not-approach note"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-ink-500">
          A paused or blacked-out sponsor stays visible for context, but live matching and sponsor-facing release should step away until timing is workable again.
        </p>
        <Button
          disabled={pending}
          onClick={() => {
            const form = formRef.current;

            if (!form) {
              setError("Could not read the sponsor availability form.");
              return;
            }

            const formData = new FormData(form);
            const currentAvailabilityStatus = formData.get("availabilityStatus");
            const currentMaxConcurrentPaths = formData.get("maxConcurrentPaths");

            setPending(true);
            setError(null);
            startTransition(async () => {
              const response = await fetch(`/api/sponsors/${sponsorId}/availability`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  availabilityStatus:
                    typeof currentAvailabilityStatus === "string" &&
                    Object.values(SponsorAvailabilityStatus).includes(currentAvailabilityStatus as SponsorAvailabilityStatus)
                      ? currentAvailabilityStatus
                      : initialAvailabilityStatus,
                  maxConcurrentPaths: Number(currentMaxConcurrentPaths ?? initialMaxConcurrentPaths),
                  warmIntroAvailable: formData.get("warmIntroAvailable") === "on",
                  availabilityNote: String(formData.get("availabilityNote") ?? initialAvailabilityNote ?? ""),
                  blackoutUntil: String(formData.get("blackoutUntil") ?? initialBlackoutUntil ?? ""),
                  blackoutReason: String(formData.get("blackoutReason") ?? initialBlackoutReason ?? ""),
                }),
              });
              const result = (await response.json()) as {
                success?: boolean;
                error?: string;
              };

              setPending(false);

              if (!response.ok || !result.success) {
                setError(result.error ?? "Could not update sponsor availability.");
                return;
              }

              router.refresh();
            });
          }}
          size="sm"
          type="button"
        >
          {pending ? "Saving..." : "Save availability"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </form>
  );
}
