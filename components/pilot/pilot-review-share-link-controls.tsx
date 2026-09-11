"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createPilotReviewShareLinkAction,
  revokePilotReviewShareLinkAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildPilotReviewSharePath,
  getPilotReviewShareArtifactLabel,
  type PilotReviewShareType,
} from "@/lib/pilot/share";

export function PilotReviewShareLinkControls({
  linkType,
  existingLink,
}: {
  linkType: PilotReviewShareType;
  existingLink?: {
    id: string;
    token: string;
    expiresAtLabel: string;
    lastUsedAtLabel: string | null;
  } | null;
}) {
  const router = useRouter();
  const [daysValid, setDaysValid] = useState("7");
  const [pending, setPending] = useState<"create" | "copy" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const path = useMemo(() => (existingLink ? buildPilotReviewSharePath(existingLink.token) : ""), [existingLink]);
  const fullUrl = origin && path ? `${origin}${path}` : path;
  const artifactLabel = getPilotReviewShareArtifactLabel(linkType);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    setHydrated(true);
  }, []);

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
      <p className="text-sm font-medium text-ink-900">Share-safe pilot review link</p>
      <p className="mt-1 text-sm leading-6 text-ink-500">
        Create a time-bounded read-only link for this {artifactLabel} without exposing the wider workspace.
      </p>

      {existingLink ? (
        <div className="mt-4 space-y-3">
          <Input readOnly value={fullUrl} />
          <p className="text-sm text-ink-500">
            Expires {existingLink.expiresAtLabel}
            {existingLink.lastUsedAtLabel ? ` · last opened ${existingLink.lastUsedAtLabel}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending !== null || !hydrated}
              onClick={() => {
                setPending("copy");
                setError(null);

                startTransition(async () => {
                  try {
                    if (typeof navigator !== "undefined" && fullUrl) {
                      await navigator.clipboard.writeText(fullUrl);
                    }
                  } catch {
                    setError("Could not copy the pilot review link.");
                  } finally {
                    setPending(null);
                  }
                });
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              {pending === "copy" ? "Copying..." : "Copy link"}
            </Button>
            <Button
              disabled={pending !== null || !hydrated}
              onClick={() => {
                setPending("create");
                setError(null);

                startTransition(async () => {
                  const result = await createPilotReviewShareLinkAction({
                    daysValid: Number(daysValid),
                    linkType,
                  });
                  setPending(null);

                  if (!result.success) {
                    setError(result.error ?? "Could not rotate the pilot review link.");
                    return;
                  }

                  router.refresh();
                });
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {pending === "create" ? "Rotating..." : "Rotate link"}
            </Button>
            <Button
              disabled={pending !== null || !hydrated}
              onClick={() => {
                setPending("revoke");
                setError(null);

                startTransition(async () => {
                  const result = await revokePilotReviewShareLinkAction(existingLink.id);
                  setPending(null);

                  if (!result.success) {
                    setError(result.error ?? "Could not revoke the pilot review link.");
                    return;
                  }

                  router.refresh();
                });
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {pending === "revoke" ? "Revoking..." : "Revoke link"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input
            className="max-w-28"
            min="1"
            onChange={(event) => setDaysValid(event.target.value)}
            type="number"
            value={daysValid}
          />
          <Button
            disabled={pending !== null || !hydrated}
            onClick={() => {
              setPending("create");
              setError(null);

              startTransition(async () => {
                const result = await createPilotReviewShareLinkAction({
                  daysValid: Number(daysValid),
                  linkType,
                });
                setPending(null);

                if (!result.success) {
                  setError(result.error ?? "Could not create the pilot review link.");
                  return;
                }

                router.refresh();
              });
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {pending === "create" ? "Creating..." : "Create link"}
          </Button>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
