import {
  AlertSeverity,
  AlertStatus,
  DeliveryStatus,
  NotificationChannel,
} from "@prisma/client";

import { env } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";

const preferenceKeyByChannel: Record<NotificationChannel, string> = {
  EMAIL_DIGEST: "ALERT_NOTIFY_EMAIL",
  SLACK_DIGEST: "ALERT_NOTIFY_SLACK",
  OPS_QUEUE: "ALERT_NOTIFY_OPS",
};

export type AlertDigestPreferences = Record<NotificationChannel, boolean>;

function formatChannel(channel: NotificationChannel) {
  return channel.replaceAll("_", " ").toLowerCase();
}

function resolveDigestWebhook(channel: NotificationChannel) {
  if (channel === NotificationChannel.EMAIL_DIGEST) {
    return env.emailDigestWebhookUrl;
  }

  if (channel === NotificationChannel.SLACK_DIGEST) {
    return env.slackDigestWebhookUrl;
  }

  return "";
}

export async function getAlertNotificationPreferences() {
  const settings = await prisma.appSetting.findMany({
    where: {
      key: {
        in: Object.values(preferenceKeyByChannel),
      },
    },
  });
  const map = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    EMAIL_DIGEST: map.get(preferenceKeyByChannel.EMAIL_DIGEST) === "true",
    SLACK_DIGEST: map.get(preferenceKeyByChannel.SLACK_DIGEST) === "true",
    OPS_QUEUE: (map.get(preferenceKeyByChannel.OPS_QUEUE) ?? "true") === "true",
  } as const;
}

export function resolveAlertDigestTargets(
  preferences: AlertDigestPreferences,
  target: NotificationChannel | "all" = "all",
) {
  const enabledChannels = (Object.keys(preferences) as NotificationChannel[]).filter(
    (channel) => preferences[channel],
  );
  const disabledChannels = (Object.keys(preferences) as NotificationChannel[]).filter(
    (channel) => !preferences[channel],
  );

  return {
    channels: target === "all" ? enabledChannels : [target],
    skipped: target === "all" ? disabledChannels : [],
  };
}

export function summarizeOperatorAlerts(
  alerts: Array<{
    severity: AlertSeverity;
  }>,
) {
  const severityCounts = {
    action: alerts.filter((alert) => alert.severity === AlertSeverity.ACTION).length,
    caution: alerts.filter((alert) => alert.severity === AlertSeverity.CAUTION).length,
    info: alerts.filter((alert) => alert.severity === AlertSeverity.INFO).length,
  };

  return {
    severityCounts,
    summary: `Open alerts: ${alerts.length}. Action ${severityCounts.action}, caution ${severityCounts.caution}, info ${severityCounts.info}.`,
  };
}

export async function setAlertNotificationPreference(channel: NotificationChannel, enabled: boolean) {
  const key = preferenceKeyByChannel[channel];

  await prisma.appSetting.upsert({
    where: { key },
    update: { value: enabled ? "true" : "false" },
    create: { key, value: enabled ? "true" : "false" },
  });
}

export async function sendOperatorAlertDigest(target: NotificationChannel | "all" = "all") {
  const [preferences, alerts] = await Promise.all([
    getAlertNotificationPreferences(),
    prisma.operatorAlert.findMany({
      where: {
        status: AlertStatus.OPEN,
      },
      include: {
        candidate: true,
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (alerts.length === 0) {
    return {
      deliveries: [],
      skipped: [],
      summary: "No open alerts were available for digest delivery.",
    };
  }

  const { summary } = summarizeOperatorAlerts(alerts);
  const payload = {
    generatedAt: new Date().toISOString(),
    summary,
    alerts: alerts.map((alert) => ({
      candidate: alert.candidate.fullName,
      title: alert.title,
      severity: alert.severity,
      detail: alert.detail,
    })),
  };

  const { channels, skipped } = resolveAlertDigestTargets(preferences, target);

  const deliveries = [];

  for (const channel of channels) {
    const webhookUrl = resolveDigestWebhook(channel);

    if (channel === NotificationChannel.OPS_QUEUE || !webhookUrl) {
      const delivery = await prisma.alertDigestDelivery.create({
        data: {
          channel,
          status: DeliveryStatus.SENT,
          title: "Operator alert digest",
          summary,
          alertCount: alerts.length,
          payloadJson: JSON.stringify(payload),
          sourceLabel:
            channel === NotificationChannel.OPS_QUEUE
              ? "Internal ops queue outbox"
              : `Local ${formatChannel(channel)} outbox (webhook unavailable)`,
          deliveredAt: new Date(),
        },
      });

      deliveries.push(delivery);
      continue;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          channel === NotificationChannel.SLACK_DIGEST
            ? {
                text: summary,
                digest: payload,
              }
            : payload,
        ),
      });

      if (!response.ok) {
        throw new Error(`Digest webhook failed with status ${response.status}.`);
      }

      const delivery = await prisma.alertDigestDelivery.create({
        data: {
          channel,
          status: DeliveryStatus.SENT,
          title: "Operator alert digest",
          summary,
          alertCount: alerts.length,
          payloadJson: JSON.stringify(payload),
          sourceLabel: `Live ${formatChannel(channel)} webhook delivery`,
          deliveredAt: new Date(),
        },
      });

      deliveries.push(delivery);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown digest delivery failure.";
      const delivery = await prisma.alertDigestDelivery.create({
        data: {
          channel,
          status: DeliveryStatus.FAILED,
          title: "Operator alert digest",
          summary: `Digest delivery failed. ${message}`,
          alertCount: alerts.length,
          payloadJson: JSON.stringify(payload),
          sourceLabel: `Failed ${formatChannel(channel)} webhook delivery`,
          deliveredAt: new Date(),
        },
      });

      deliveries.push(delivery);
    }
  }

  for (const channel of skipped) {
    await prisma.alertDigestDelivery.create({
      data: {
        channel,
        status: DeliveryStatus.SKIPPED,
        title: "Operator alert digest",
        summary: "Digest delivery was skipped because the channel is currently disabled.",
        alertCount: alerts.length,
        payloadJson: JSON.stringify(payload),
        sourceLabel: `Disabled ${formatChannel(channel)} delivery`,
        deliveredAt: new Date(),
      },
    });
  }

  return {
    deliveries,
    skipped,
    summary,
  };
}
