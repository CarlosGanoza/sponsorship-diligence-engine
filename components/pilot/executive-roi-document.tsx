import { CircleDollarSign, ShieldCheck } from "lucide-react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function ExecutiveRoiDocument(input: {
  template: {
    label: string;
    summary: string;
  };
  pilotProfile: {
    pilotName: string;
    designPartnerName: string;
  };
  healthStatus: "healthy" | "degraded" | "down" | "unhealthy";
  modeled: {
    monthlyHoursRecovered: number;
    operatorDaysRecovered: number;
    monthlyLaborValue: number;
    controlCoverage: number;
    memoCoverage: number;
    sponsorReadyCoverage: number;
    knownOutcomeCoverage: number;
    workflowPressure: number;
    disagreementRate: number;
    positiveOutcomeRate: number;
  };
  launchPosture: {
    blindReviewMode: boolean;
    strictEvidenceMode: boolean;
    requireOutboundApproval: boolean;
  };
  baseline: {
    capturedAtLabel: string;
    authorLabel: string;
    note: string | null;
    averageReviewMinutes: number | null;
    sampledReviewCount: number | null;
  } | null;
  observedDeltas: Array<{
    label: string;
    deltaLabel: string;
    currentValueLabel: string;
    baselineValueLabel: string;
    detail: string;
    direction: "improved" | "declined" | "flat";
  }>;
  recentSnapshots: Array<{
    id: string;
    title: string;
    snapshotType: "BASELINE" | "CHECKPOINT";
    capturedAtLabel: string;
    authorLabel: string;
    note: string | null;
    averageReviewMinutes: number | null;
    sampledReviewCount: number | null;
    memoCoverage: number;
    sponsorReadyCoverage: number;
    workflowPressure: number;
  }>;
  assumptions: string[];
  health: {
    checkedAtLabel: string;
    checks: Array<{
      key: string;
      label: string;
      status: "healthy" | "degraded" | "down";
      detail: string;
    }>;
  };
}) {
  const { template, pilotProfile, healthStatus, modeled, launchPosture, baseline, observedDeltas, recentSnapshots, assumptions, health } =
    input;

  return (
    <div className="space-y-6 print:space-y-5" data-testid="executive-roi-document">
      <Card className="overflow-hidden px-0 py-0">
        <div className="border-b border-ink-100 bg-[radial-gradient(circle_at_top_left,_rgba(185,164,101,0.16),_transparent_52%),linear-gradient(135deg,#f8f7f2_0%,#ffffff_100%)] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-400">Executive ROI</p>
              <h2 className="mt-3 font-serif text-3xl text-ink-950">{pilotProfile.pilotName}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-600">
                This view combines observed workspace metrics with explicitly labeled planning assumptions. It is for sober buyer framing, not exaggerated savings claims.
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="sage">{template.label}</Badge>
              <Badge variant={healthStatus === "healthy" ? "sage" : healthStatus === "degraded" ? "gold" : "danger"}>
                Runtime {healthStatus}
              </Badge>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Design partner</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{pilotProfile.designPartnerName}</p>
              <p className="mt-2 text-sm text-ink-500">{template.label}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Measured baseline</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{baseline ? "On file" : "Missing"}</p>
              <p className="mt-2 text-sm text-ink-500">{baseline ? baseline.capturedAtLabel : "Capture before claiming observed movement."}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Health checked</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{health.checkedAtLabel}</p>
              <p className="mt-2 text-sm text-ink-500">Runtime posture matters as much as workflow quality.</p>
            </div>
          </div>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-4">
        <KpiCard detail="Modeled from the active slate and template assumptions" label="Hours recovered / month" value={modeled.monthlyHoursRecovered} />
        <KpiCard detail="Equivalent operator days regained each month" label="Operator days recovered" value={modeled.operatorDaysRecovered} />
        <KpiCard detail="Modeled labor value at the configured template rate" label="Modeled labor value" value={`$${modeled.monthlyLaborValue.toLocaleString()}`} />
        <KpiCard detail="Governance controls currently active" label="Control coverage" value={`${modeled.controlCoverage}%`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Measured pilot movement</p>
              <p className="mt-1 text-sm text-ink-500">Baseline-to-current movement recorded inside this workspace. This is observed operating change, not modeled ROI.</p>
            </div>
          </div>
          {baseline ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="sage">Baseline</Badge>
                  <Badge variant="muted">{baseline.capturedAtLabel}</Badge>
                  <Badge variant="muted">{baseline.authorLabel}</Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{baseline.note ?? "Measured baseline captured for this pilot."}</p>
                {baseline.averageReviewMinutes ? (
                  <p className="mt-3 text-sm text-ink-500">
                    Measured review time {baseline.averageReviewMinutes} min across {baseline.sampledReviewCount ?? 0} files
                  </p>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {observedDeltas.map((row) => (
                  <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={row.label}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink-900">{row.label}</p>
                      <Badge variant={row.direction === "improved" ? "sage" : row.direction === "declined" ? "danger" : "muted"}>
                        {row.deltaLabel}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-ink-500">
                      Now {row.currentValueLabel} · Baseline {row.baselineValueLabel}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-ink-600">{row.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-ink-200 bg-ink-50 px-4 py-5">
              <p className="text-sm font-medium text-ink-900">No measured baseline yet</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">
                Capture a baseline before the pilot starts so modeled economics can later be compared against observed operating movement.
              </p>
            </div>
          )}
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Observed operating proof</p>
              <p className="mt-1 text-sm text-ink-500">What the current workspace can already demonstrate without modeling.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Ready memo coverage</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{modeled.memoCoverage}%</p>
              <p className="mt-2 text-sm text-ink-500">Files with a usable memo already in the system</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Sponsor-ready coverage</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{modeled.sponsorReadyCoverage}%</p>
              <p className="mt-2 text-sm text-ink-500">Files currently strong enough to sit in the sponsor-ready queue</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Known outcome coverage</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{modeled.knownOutcomeCoverage}%</p>
              <p className="mt-2 text-sm text-ink-500">Files with positive or negative sponsor outcomes recorded</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Workflow pressure</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{modeled.workflowPressure}</p>
              <p className="mt-2 text-sm text-ink-500">Open alerts plus open tasks still requiring operator time</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Governance proof</p>
            <p className="mt-1 text-sm text-ink-500">These controls matter more than headline efficiency claims in an early pilot.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant={launchPosture.blindReviewMode ? "sage" : "muted"}>Blind review {launchPosture.blindReviewMode ? "enabled" : "off"}</Badge>
            <Badge variant={launchPosture.strictEvidenceMode ? "sage" : "gold"}>Strict evidence {launchPosture.strictEvidenceMode ? "enabled" : "off"}</Badge>
            <Badge variant={launchPosture.requireOutboundApproval ? "sage" : "gold"}>
              Outbound approval {launchPosture.requireOutboundApproval ? "required" : "optional"}
            </Badge>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Disagreement rate</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{modeled.disagreementRate}%</p>
              <p className="mt-2 text-sm text-ink-500">High disagreement is governance work that should be reviewed, not hidden.</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm text-ink-500">Positive outcome rate</p>
              <p className="mt-2 font-serif text-3xl text-ink-900">{modeled.positiveOutcomeRate}%</p>
              <p className="mt-2 text-sm text-ink-500">Among cases where a sponsor outcome is already known</p>
            </div>
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Modeled pilot economics</p>
            <p className="mt-1 text-sm text-ink-500">Use these only as assumptions-backed planning numbers for the current template.</p>
          </div>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.5rem] border border-gold-200 bg-gold-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">Explicit modeling note</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">
                These economics are planning assumptions, not observed financial results.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
              <p className="text-sm font-medium text-ink-900">{template.label}</p>
              <p className="mt-2 text-sm leading-7 text-ink-600">{template.summary}</p>
            </div>
            {assumptions.map((assumption) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={assumption}>
                <p className="text-sm leading-7 text-ink-600">{assumption}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Recent measured checkpoints</p>
            <p className="mt-1 text-sm text-ink-500">Use checkpoints to preserve what the pilot actually looked like at each review moment.</p>
          </div>
          <div className="mt-5 space-y-4">
            {recentSnapshots.length > 0 ? (
              recentSnapshots.map((snapshot) => (
                <div
                  className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4"
                  data-testid={`pilot-snapshot-${snapshot.id}`}
                  key={snapshot.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={snapshot.snapshotType === "BASELINE" ? "sage" : "muted"}>
                      {snapshot.snapshotType === "BASELINE" ? "Baseline" : "Checkpoint"}
                    </Badge>
                    <Badge variant="muted">{snapshot.capturedAtLabel}</Badge>
                    <Badge variant="muted">{snapshot.authorLabel}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink-900">{snapshot.title}</p>
                  <p className="mt-2 text-sm leading-7 text-ink-600">{snapshot.note ?? "No note recorded."}</p>
                  <p className="mt-3 text-sm text-ink-500">
                    Memo coverage {snapshot.memoCoverage}% · Sponsor-ready {snapshot.sponsorReadyCoverage}% · Workflow pressure {snapshot.workflowPressure}
                  </p>
                  {snapshot.averageReviewMinutes ? (
                    <p className="mt-2 text-sm text-ink-500">
                      Measured review time {snapshot.averageReviewMinutes} min across {snapshot.sampledReviewCount ?? 0} files
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-500">No measured pilot snapshots have been recorded yet.</p>
            )}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Deployment health</p>
            <p className="mt-1 text-sm text-ink-500">Hosted pilot confidence depends on environment health, not only product workflow quality.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {health.checks.map((check) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={check.key}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{check.label}</p>
                  <Badge variant={check.status === "healthy" ? "sage" : check.status === "degraded" ? "gold" : "danger"}>
                    {check.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{check.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3 rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
            <p className="text-sm font-medium text-ink-900">How to use this in a buyer conversation</p>
            <p className="text-sm leading-7 text-ink-600">
              Start with the trust problem: sponsorship decisions are high-trust decisions, so the value is a more defensible way to decide who is ready to back.
            </p>
            <p className="text-sm leading-7 text-ink-600">
              Separate observed proof from assumptions: use the observed metrics as current evidence, and the modeled economics only as a planning frame for what a live pilot should test.
            </p>
            <p className="text-sm leading-7 text-ink-600">
              End on governance, not hype: buyers trust the product more when they see blind review, strict evidence mode, approval gates, and disagreement auditing built into the workflow.
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
