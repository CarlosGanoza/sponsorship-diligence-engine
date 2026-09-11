"use client";

import { NotificationChannel } from "@prisma/client";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  setAlertNotificationPreferenceAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

export function DigestControls({
  preferences,
}: {
  preferences: {
    email: boolean;
    slack: boolean;
    ops: boolean;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const toggle = (channel: NotificationChannel, enabled: boolean) => {
    setPending(channel);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await setAlertNotificationPreferenceAction(channel, enabled);
      setPending(null);

      if (!result.success) {
        setError("Channel preference update failed.");
        return;
      }

      router.refresh();
    });
  };

  const send = (target: NotificationChannel | "all") => {
    setPending(`send-${target}`);
    setError(null);
    setSuccess(null);

    void (async () => {
      const response = await fetch("/api/alerts/digest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target }),
      }).catch(() => null);
      setPending(null);

      if (!response?.ok) {
        setError("Digest send failed.");
        return;
      }

      setSuccess(target === "all" ? "Digest sent. Refreshing deliveries." : "Digest sent to the selected channel.");
      router.refresh();
    })();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            channel: NotificationChannel.EMAIL_DIGEST,
            label: "Email digest",
            enabled: preferences.email,
          },
          {
            channel: NotificationChannel.SLACK_DIGEST,
            label: "Slack digest",
            enabled: preferences.slack,
          },
          {
            channel: NotificationChannel.OPS_QUEUE,
            label: "Ops queue",
            enabled: preferences.ops,
          },
        ].map((item) => (
          <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item.channel}>
            <p className="text-sm font-medium text-ink-900">{item.label}</p>
            <p className="mt-2 text-sm text-ink-500">{item.enabled ? "Enabled" : "Disabled"}</p>
            <div className="mt-4">
              <Button
                disabled={pending !== null || !hydrated}
                onClick={() => toggle(item.channel, !item.enabled)}
                size="sm"
                variant={item.enabled ? "secondary" : "ghost"}
              >
                {pending === item.channel ? "Saving..." : item.enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending !== null || !hydrated}
          onClick={() => send("all")}
          size="sm"
          variant="secondary"
        >
          {pending === "send-all" ? "Sending..." : "Send digest to configured channels"}
        </Button>
        <Button
          disabled={pending !== null || !hydrated}
          onClick={() => send(NotificationChannel.OPS_QUEUE)}
          size="sm"
          variant="ghost"
        >
          {pending === "send-OPS_QUEUE" ? "Sending..." : "Send to ops queue only"}
        </Button>
      </div>

      {success ? <p className="text-sm text-sage-700">{success}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
