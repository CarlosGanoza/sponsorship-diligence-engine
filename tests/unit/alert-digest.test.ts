import { AlertSeverity, NotificationChannel } from "@prisma/client";

import {
  resolveAlertDigestTargets,
  summarizeOperatorAlerts,
  type AlertDigestPreferences,
} from "@/lib/alerts/digest";

describe("alert digests", () => {
  const preferences: AlertDigestPreferences = {
    EMAIL_DIGEST: false,
    SLACK_DIGEST: true,
    OPS_QUEUE: true,
  };

  it("routes all-target digests only to enabled channels and marks disabled ones as skipped", () => {
    const result = resolveAlertDigestTargets(preferences, "all");

    expect(result.channels).toEqual([NotificationChannel.SLACK_DIGEST, NotificationChannel.OPS_QUEUE]);
    expect(result.skipped).toEqual([NotificationChannel.EMAIL_DIGEST]);
  });

  it("allows an explicit single-channel send even when the channel is disabled", () => {
    const result = resolveAlertDigestTargets(preferences, NotificationChannel.EMAIL_DIGEST);

    expect(result.channels).toEqual([NotificationChannel.EMAIL_DIGEST]);
    expect(result.skipped).toEqual([]);
  });

  it("builds a transparent severity summary for the digest header", () => {
    const result = summarizeOperatorAlerts([
      { severity: AlertSeverity.ACTION },
      { severity: AlertSeverity.CAUTION },
      { severity: AlertSeverity.CAUTION },
      { severity: AlertSeverity.INFO },
    ]);

    expect(result.severityCounts).toEqual({
      action: 1,
      caution: 2,
      info: 1,
    });
    expect(result.summary).toBe("Open alerts: 4. Action 1, caution 2, info 1.");
  });
});
