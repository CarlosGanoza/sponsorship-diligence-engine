"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Check, Copy } from "lucide-react";

import { sendOutboundEmailAction } from "@/app/actions";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { EmailDraft } from "@/lib/outreach/email";

export function EmailDraftWorkbench({
  drafts,
  candidateId,
  sponsorId,
  opportunityBriefId,
  blockedReason,
}: {
  drafts: EmailDraft[];
  candidateId: string;
  sponsorId: string;
  opportunityBriefId?: string | null;
  blockedReason?: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState(
    Object.fromEntries(
      drafts.map((draft) => [draft.id, { subject: draft.subject, body: draft.body, recipientEmail: "" }]),
    ),
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pendingSendId, setPendingSendId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copyDraft(id: string, label: string) {
    const value = values[id];

    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(`Subject: ${value.subject}\n\n${value.body}`);
    setCopiedKey(`${id}:${label}`);
    window.setTimeout(() => setCopiedKey(null), 1500);
  }

  return (
    <Tabs defaultValue={drafts[0]?.id}>
      <TabsList>
        {drafts.map((draft) => (
          <TabsTrigger key={draft.id} value={draft.id}>
            {draft.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {drafts.map((draft) => {
        const value = values[draft.id];

        return (
          <TabsContent key={draft.id} value={draft.id}>
            <Card className="px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
                <div>
                  <p className="text-sm font-medium text-ink-900">{draft.label}</p>
                  <p className="mt-1 text-sm text-ink-500">{draft.purpose}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">
                    Recipient · {draft.recipientLabel}
                  </p>
                </div>
                <Button onClick={() => copyDraft(draft.id, "draft")} size="sm" variant="secondary">
                  {copiedKey === `${draft.id}:draft` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedKey === `${draft.id}:draft` ? "Copied" : "Copy draft"}
                </Button>
                <Button
                  disabled={Boolean(blockedReason) || pendingSendId !== null}
                  onClick={() => {
                    setPendingSendId(draft.id);
                    setError(null);
                    startTransition(async () => {
                      const result = await sendOutboundEmailAction(candidateId, {
                        sponsorId,
                        opportunityBriefId: opportunityBriefId ?? undefined,
                        draftId: draft.id,
                        draftLabel: draft.label,
                        recipientLabel: draft.recipientLabel,
                        recipientEmail: values[draft.id]?.recipientEmail ?? "",
                        subject: values[draft.id]?.subject ?? draft.subject,
                        body: values[draft.id]?.body ?? draft.body,
                      });
                      setPendingSendId(null);
                      if (!result.success) {
                        setError(result.error ?? "Could not send outbound email.");
                        return;
                      }
                      router.refresh();
                    });
                  }}
                  size="sm"
                >
                  {pendingSendId === draft.id ? "Sending..." : "Send draft"}
                </Button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`${draft.id}-recipient-email`}>
                    Recipient email
                  </label>
                  <input
                    className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                    id={`${draft.id}-recipient-email`}
                    placeholder="name@organization.org"
                    type="email"
                    value={value.recipientEmail}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [draft.id]: {
                          ...current[draft.id],
                          recipientEmail: event.target.value,
                        },
                      }))
                    }
                  />
                  <p className="mt-2 text-xs leading-5 text-ink-500">
                    Required for live Gmail or Outlook delivery. If left blank, the draft can still be copied or stored in the local outbox.
                  </p>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`${draft.id}-subject`}>
                    Subject
                  </label>
                  <input
                    className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                    id={`${draft.id}-subject`}
                    value={value.subject}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [draft.id]: {
                          ...current[draft.id],
                          subject: event.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.18em] text-ink-400" htmlFor={`${draft.id}-body`}>
                    Body
                  </label>
                  <textarea
                    className="mt-2 min-h-[360px] w-full rounded-[1.5rem] border border-ink-200 bg-white px-4 py-4 text-sm leading-7 text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                    id={`${draft.id}-body`}
                    value={value.body}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [draft.id]: {
                          ...current[draft.id],
                          body: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              {blockedReason ? <p className="mt-4 text-sm text-rose-600">{blockedReason}</p> : null}
            </Card>
          </TabsContent>
        );
      })}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </Tabs>
  );
}
