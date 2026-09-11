"use client";

import { OutboundEmailEventType } from "@prisma/client";
import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { logOutboundEmailEventAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const EVENT_TEMPLATES: Record<OutboundEmailEventType, { title: string; detail: string }> = {
  SENT: {
    title: "Outbound email sent",
    detail: "Sent the sponsor-facing note and logged the delivery attempt.",
  },
  DELIVERY_CONFIRMED: {
    title: "Delivery confirmed",
    detail: "The provider confirmed delivery of the outbound note.",
  },
  REPLY_RECEIVED: {
    title: "Reply received",
    detail: "The sponsor or connector replied and gave a clear next step.",
  },
  FOLLOW_UP_SCHEDULED: {
    title: "Follow-up scheduled",
    detail: "Scheduled a follow-up touchpoint if the thread remains quiet.",
  },
  FOLLOW_UP_SENT: {
    title: "Follow-up sent",
    detail: "Sent the promised follow-up with the exact proof or scheduling ask.",
  },
  MANUAL_NOTE: {
    title: "Thread note added",
    detail: "Added operator context to the thread timeline.",
  },
};

const EVENT_OPTIONS = [
  OutboundEmailEventType.REPLY_RECEIVED,
  OutboundEmailEventType.FOLLOW_UP_SCHEDULED,
  OutboundEmailEventType.FOLLOW_UP_SENT,
  OutboundEmailEventType.DELIVERY_CONFIRMED,
  OutboundEmailEventType.MANUAL_NOTE,
] as const;

export function EmailThreadControls({
  outboundEmailId,
}: {
  outboundEmailId: string;
}) {
  const router = useRouter();
  const [eventType, setEventType] = useState<OutboundEmailEventType>(OutboundEmailEventType.REPLY_RECEIVED);
  const [title, setTitle] = useState(EVENT_TEMPLATES[OutboundEmailEventType.REPLY_RECEIVED].title);
  const [detail, setDetail] = useState(EVENT_TEMPLATES[OutboundEmailEventType.REPLY_RECEIVED].detail);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const helperText = useMemo(() => {
    if (eventType === OutboundEmailEventType.REPLY_RECEIVED) {
      return "Use this when the sponsor, connector, or operations counterpart replies with signal, diligence questions, or a clear next step.";
    }

    if (eventType === OutboundEmailEventType.FOLLOW_UP_SCHEDULED) {
      return "Use this to keep the follow-up sequence explicit even before the next touchpoint goes out.";
    }

    if (eventType === OutboundEmailEventType.FOLLOW_UP_SENT) {
      return "Use this after a real follow-up touch. It also updates the sponsor-path activity timeline.";
    }

    return "Keep the note factual and tied to what actually happened on the thread.";
  }, [eventType]);

  function applyTemplate(nextType: OutboundEmailEventType) {
    setEventType(nextType);
    setTitle(EVENT_TEMPLATES[nextType].title);
    setDetail(EVENT_TEMPLATES[nextType].detail);
  }

  return (
    <div className="mt-4 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-900">Thread updates</p>
          <p className="mt-1 text-sm text-ink-500">{helperText}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <Label htmlFor={`email-thread-event-${outboundEmailId}`}>Event type</Label>
          <select
            className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            id={`email-thread-event-${outboundEmailId}`}
            onChange={(event) => applyTemplate(event.target.value as OutboundEmailEventType)}
            value={eventType}
          >
            {EVENT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ").toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor={`email-thread-title-${outboundEmailId}`}>Title</Label>
          <Input
            id={`email-thread-title-${outboundEmailId}`}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </div>
      </div>
      <div className="mt-4">
        <Label htmlFor={`email-thread-detail-${outboundEmailId}`}>Detail</Label>
        <Textarea
          id={`email-thread-detail-${outboundEmailId}`}
          onChange={(event) => setDetail(event.target.value)}
          value={detail}
        />
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <Button
          disabled={pending}
          onClick={() => {
            setPending(true);
            setError(null);
            startTransition(async () => {
              const result = await logOutboundEmailEventAction({
                outboundEmailId,
                eventType,
                title,
                detail,
              });
              setPending(false);
              if (!result.success) {
                setError(result.error ?? "Could not update the outbound thread.");
                return;
              }
              router.refresh();
            });
          }}
          size="sm"
          variant="secondary"
        >
          {pending ? "Saving..." : "Log thread update"}
        </Button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
