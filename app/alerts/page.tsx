import Link from "next/link";

import { DigestControls } from "@/components/alerts/digest-controls";
import { OperatorAlertControls } from "@/components/alerts/operator-alert-controls";
import { AlertSeverityBadge } from "@/components/dashboard/alert-severity-badge";
import { AppShell } from "@/components/dashboard/app-shell";
import { DeliveryStatusBadge } from "@/components/dashboard/delivery-status-badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAlertsCenterData, getSettingsSnapshot } from "@/lib/db/queries";

export default async function AlertsPage() {
  const [data, settings] = await Promise.all([getAlertsCenterData(), getSettingsSnapshot()]);

  return (
    <AppShell
      title="Alerts and digests"
      description="Review automation alerts, resolve operator queue items, and route digest summaries into the mock notification outbox."
    >
      <section className="grid gap-5 xl:grid-cols-5">
        <KpiCard detail="Open queue items" label="Open alerts" value={data.stats.total} />
        <KpiCard detail="Need immediate action" label="Action" value={data.stats.action} />
        <KpiCard detail="Caution queue" label="Caution" value={data.stats.caution} />
        <KpiCard detail="Informational notices" label="Info" value={data.stats.info} />
        <KpiCard detail="Manual automation holds" label="Manual overrides" value={data.stats.manualOverrides} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-5 py-5">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Open operator alerts</p>
            <p className="mt-1 text-sm text-ink-500">These alerts come from trajectory, review blockers, stage automation, and manual overrides.</p>
          </div>
          <div className="mt-5 space-y-4">
            {data.alerts.map((alert) => (
              <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={alert.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link className="font-medium text-ink-900 hover:text-sage-700" href={`/candidates/${alert.candidateId}`}>
                      {alert.candidate.fullName}
                    </Link>
                    <p className="mt-1 text-sm text-ink-700">{alert.title}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="muted">{alert.alertType.replaceAll("_", " ")}</Badge>
                      <Badge variant="muted">{alert.createdAtLabel}</Badge>
                      {alert.assignedUser ? <Badge variant="sage">Assigned to {alert.assignedUser.name}</Badge> : null}
                      {alert.dueAtLabel ? <Badge variant="muted">Due {alert.dueAtLabel}</Badge> : null}
                    </div>
                  </div>
                  <AlertSeverityBadge severity={alert.severity} />
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-500">{alert.detail}</p>
                <OperatorAlertControls
                  alertId={alert.id}
                  assignedUserId={alert.assignedUserId}
                  dueAt={alert.dueAt ? alert.dueAt.toISOString().slice(0, 10) : null}
                  hasTask={Boolean(alert.operatorTask)}
                  teamMembers={data.teamMembers.map((member) => ({
                    id: member.id,
                    name: member.name,
                    role: member.role,
                  }))}
                />
              </div>
            ))}
            {data.alerts.length === 0 ? <p className="text-sm text-ink-500">No open alerts right now.</p> : null}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Digest routing</p>
              <p className="mt-1 text-sm text-ink-500">Email and Slack can post to live webhooks when configured. Every send still leaves an inspectable delivery record in the outbox.</p>
            </div>
            <div className="mt-5">
              <DigestControls
                preferences={{
                  email: settings.alertNotifyEmail,
                  slack: settings.alertNotifySlack,
                  ops: settings.alertNotifyOps,
                }}
              />
            </div>
          </Card>

          <Card className="px-5 py-5">
            <div className="border-b border-ink-100 pb-4">
              <p className="text-sm font-medium text-ink-900">Recent digest deliveries</p>
              <p className="mt-1 text-sm text-ink-500">Latest mock deliveries to email, Slack, and internal ops queue channels.</p>
            </div>
            <div className="mt-5 space-y-4">
              {data.deliveries.map((delivery) => (
                <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4" key={delivery.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">{delivery.channel.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-sm text-ink-500">{delivery.createdAtLabel}</p>
                    </div>
                    <DeliveryStatusBadge status={delivery.status} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-ink-600">{delivery.summary}</p>
                  <p className="mt-2 text-sm text-ink-500">{delivery.alertCount} alerts included</p>
                </div>
              ))}
              {data.deliveries.length === 0 ? (
                <p className="text-sm text-ink-500">No digest deliveries have been recorded yet.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
