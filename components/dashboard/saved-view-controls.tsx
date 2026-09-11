"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createSavedViewAction, deleteSavedViewAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeSavedViewQueryString } from "@/lib/saved-views";
import { SavedViewPage } from "@prisma/client";

type SavedViewRecord = {
  id: string;
  title: string;
  description: string | null;
  queryString: string;
  createdBy: {
    id: string;
    name: string;
  } | null;
};

export function SavedViewControls({
  page,
  pagePath,
  currentQueryString,
  savedViews,
}: {
  page: SavedViewPage;
  pagePath: string;
  currentQueryString: string;
  savedViews: SavedViewRecord[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locationQueryString, setLocationQueryString] = useState("");
  const normalizedCurrent = useMemo(
    () => normalizeSavedViewQueryString(currentQueryString || searchParams.toString()),
    [currentQueryString, searchParams],
  );
  const effectiveCurrent = normalizedCurrent || locationQueryString;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<"save" | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocationQueryString(normalizeSavedViewQueryString(window.location.search.replace(/^\?/, "")));
  }, [searchParams]);

  const runSave = async () => {
    setPending("save");
    setError(null);

    const queryStringToSave =
      effectiveCurrent ||
      (typeof window === "undefined"
        ? ""
        : normalizeSavedViewQueryString(window.location.search.replace(/^\?/, "")));

    if (!queryStringToSave) {
      setPending(null);
      setError("Apply at least one filter before saving a queue.");
      return;
    }

    try {
      const result = await createSavedViewAction({
        page,
        title,
        description,
        queryString: queryStringToSave,
      });

      if (!result.success) {
        setError(result.error ?? "Could not save queue.");
        return;
      }

      setTitle("");
      setDescription("");
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  const runDelete = async (savedViewId: string) => {
    setPending(savedViewId);
    setError(null);

    try {
      const result = await deleteSavedViewAction(savedViewId);

      if (!result.success) {
        setError(result.error ?? "Could not delete queue.");
        return;
      }

      router.refresh();
    } finally {
      setPending(null);
    }
  };

  return (
    <div aria-label="Named queues" className="rounded-[1.75rem] border border-ink-100 bg-white px-5 py-5" role="region">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 pb-4">
        <div>
          <p className="text-sm font-medium text-ink-900">Named queues</p>
          <p className="mt-1 text-sm text-ink-500">
            Save the current filter state as a repeatable review queue for the operator team.
          </p>
        </div>
        {effectiveCurrent ? <Badge variant="sage">Current filters ready to save</Badge> : <Badge variant="muted">No active filters</Badge>}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr_auto]">
        <Input
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Queue name"
          value={title}
        />
        <Input
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional note on what this queue is for"
          value={description}
        />
        <Button disabled={!title.trim() || pending !== null} onClick={runSave} type="button">
          {pending === "save" ? "Saving..." : "Save queue"}
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {savedViews.map((savedView) => {
          const isActive = normalizeSavedViewQueryString(savedView.queryString) === effectiveCurrent;

          return (
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={savedView.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a className="text-sm font-medium text-ink-900 hover:text-sage-700" href={`${pagePath}?${savedView.queryString}`}>
                      {savedView.title}
                    </a>
                    {isActive ? <Badge variant="sage">Active</Badge> : null}
                  </div>
                  {savedView.description ? <p className="mt-2 text-sm leading-6 text-ink-600">{savedView.description}</p> : null}
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
                    {savedView.createdBy?.name ?? "Workspace"} · {savedView.queryString.replaceAll("&", " · ")}
                  </p>
                </div>
                <Button
                  disabled={pending !== null}
                  onClick={() => runDelete(savedView.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {pending === savedView.id ? "Removing..." : "Delete"}
                </Button>
              </div>
            </div>
          );
        })}
        {savedViews.length === 0 ? (
          <p className="text-sm leading-7 text-ink-500">No saved queues yet. Save one from the current filter state to create a repeatable review view.</p>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
