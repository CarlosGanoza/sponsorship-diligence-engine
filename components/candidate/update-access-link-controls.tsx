"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildCandidateUpdateAccessPath } from "@/lib/candidate-updates/access-links";

export function UpdateAccessLinkControls({
  proofRequestId,
  existingLink,
}: {
  proofRequestId: string;
  existingLink?: {
    id: string;
    token: string;
    status: string;
    expiresAtLabel: string;
    lastUsedAtLabel: string | null;
  } | null;
}) {
  const router = useRouter();
  const [daysValid, setDaysValid] = useState("7");
  const [pending, setPending] = useState<"create" | "copy" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [currentLink, setCurrentLink] = useState(existingLink ?? null);
  const path = useMemo(
    () => (currentLink ? buildCandidateUpdateAccessPath(currentLink.token) : ""),
    [currentLink],
  );
  const fullUrl = origin && path ? `${origin}${path}` : path;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    setCurrentLink(existingLink ?? null);
  }, [existingLink]);

  return (
    <div className="mt-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
      <p className="text-sm font-medium text-ink-900">Secure candidate intake</p>
      <p className="mt-1 text-sm leading-6 text-ink-500">
        Generate a time-bounded link the candidate can open without a workspace login to submit new evidence for this request.
      </p>

      {currentLink ? (
        <div className="mt-4 space-y-3">
          <Input readOnly value={fullUrl} />
          <p className="text-sm text-ink-500">
            Expires {currentLink.expiresAtLabel}
            {currentLink.lastUsedAtLabel ? ` · last used ${currentLink.lastUsedAtLabel}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending !== null}
              onClick={() => {
                setPending("copy");
                setError(null);

                void (async () => {
                  try {
                    if (typeof navigator !== "undefined" && fullUrl) {
                      await navigator.clipboard.writeText(fullUrl);
                    }
                  } catch {
                    setError("Could not copy the secure link.");
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
              disabled={pending !== null}
              onClick={() => {
                setPending("create");
                setError(null);

                void (async () => {
                  const response = await fetch(`/api/proof-requests/${proofRequestId}/access-link`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      daysValid: Number(daysValid),
                    }),
                  }).catch(() => null);
                  setPending(null);

                  const payload = (await response?.json().catch(() => null)) as
                    | {
                        error?: string;
                        link?: {
                          id: string;
                          token: string;
                          status: string;
                          expiresAtLabel: string;
                          lastUsedAtLabel: string | null;
                        };
                      }
                    | null;

                  if (!response?.ok || !payload?.link) {
                    setError(payload?.error ?? "Could not rotate secure link.");
                    return;
                  }

                  setCurrentLink(payload.link);
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
              disabled={pending !== null}
              onClick={() => {
                setPending("revoke");
                setError(null);

                void (async () => {
                  const response = await fetch(`/api/candidate-update-access-links/${currentLink.id}/revoke`, {
                    method: "POST",
                  }).catch(() => null);
                  setPending(null);

                  const payload = (await response?.json().catch(() => null)) as { error?: string } | null;

                  if (!response?.ok) {
                    setError(payload?.error ?? "Could not revoke secure link.");
                    return;
                  }

                  setCurrentLink(null);
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
            disabled={pending !== null}
            onClick={() => {
              setPending("create");
              setError(null);

              void (async () => {
                const response = await fetch(`/api/proof-requests/${proofRequestId}/access-link`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    daysValid: Number(daysValid),
                  }),
                }).catch(() => null);
                setPending(null);

                const payload = (await response?.json().catch(() => null)) as
                  | {
                      error?: string;
                      link?: {
                        id: string;
                        token: string;
                        status: string;
                        expiresAtLabel: string;
                        lastUsedAtLabel: string | null;
                      };
                    }
                  | null;

                if (!response?.ok || !payload?.link) {
                  setError(payload?.error ?? "Could not create secure link.");
                  return;
                }

                setCurrentLink(payload.link);
                router.refresh();
              });
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {pending === "create" ? "Creating..." : "Create secure link"}
          </Button>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
