"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createReviewShareLinkAction,
  revokeReviewShareLinkAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildReviewSharePath } from "@/lib/review/share";

export function ReviewShareLinkControls({
  candidateId,
  linkType,
  sponsorId,
  existingLink,
}: {
  candidateId: string;
  linkType: "MEMO" | "PACKET";
  sponsorId?: string | null;
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
  const path = useMemo(() => (existingLink ? buildReviewSharePath(existingLink.token) : ""), [existingLink]);
  const fullUrl = origin && path ? `${origin}${path}` : path;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    setHydrated(true);
  }, []);

  return (
    <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
      <p className="text-sm font-medium text-ink-900">Share-safe review link</p>
      <p className="mt-1 text-sm leading-6 text-ink-500">
        Create a time-bounded read-only link for this {linkType === "MEMO" ? "memo" : "packet"} snapshot without exposing the rest of the workspace.
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
                    setError("Could not copy the review link.");
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
                  const result = await createReviewShareLinkAction(candidateId, {
                    daysValid: Number(daysValid),
                    linkType,
                    sponsorId: sponsorId ?? undefined,
                  });
                  setPending(null);

                  if (!result.success) {
                    setError(result.error ?? "Could not rotate the review link.");
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
                  const result = await revokeReviewShareLinkAction(existingLink.id);
                  setPending(null);

                  if (!result.success) {
                    setError(result.error ?? "Could not revoke the review link.");
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
                const result = await createReviewShareLinkAction(candidateId, {
                  daysValid: Number(daysValid),
                  linkType,
                  sponsorId: sponsorId ?? undefined,
                });
                setPending(null);

                if (!result.success) {
                  setError(result.error ?? "Could not create the review link.");
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
