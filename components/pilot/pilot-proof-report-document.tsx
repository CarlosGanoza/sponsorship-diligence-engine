import { AlertTriangle, BadgeCheck, FileBarChart2, ShieldCheck } from "lucide-react";

import type { PilotProofReport } from "@/lib/pilot/report";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

function criterionBadgeVariant(status: "ready" | "watch" | "blocked") {
  if (status === "ready") {
    return "sage" as const;
  }

  if (status === "watch") {
    return "gold" as const;
  }

  return "danger" as const;
}

export function PilotProofReportDocument(input: {
  report: PilotProofReport;
  template: {
    label: string;
  };
  pilotProfile: {
    designPartnerName: string;
    programName: string;
    primaryContactName: string;
    primaryContactEmail: string;
  };
  healthStatus: "healthy" | "degraded" | "down" | "unhealthy";
}) {
  const { report, template, pilotProfile, healthStatus } = input;

  return (
    <div className="space-y-6 print:space-y-5" data-testid="pilot-proof-report">
      <Card className="overflow-hidden px-0 py-0">
        <div className="border-b border-ink-100 bg-[radial-gradient(circle_at_top_left,_rgba(154,165,139,0.18),_transparent_55%),linear-gradient(135deg,#f8f7f2_0%,#ffffff_100%)] px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-400">Measured Pilot Proof Report</p>
              <h2 className="mt-3 font-serif text-3xl text-ink-950">{report.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-600">{report.summary}</p>
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
              <p className="mt-2 text-sm text-ink-500">{pilotProfile.programName}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Primary contact</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{pilotProfile.primaryContactName}</p>
              <p className="mt-2 text-sm text-ink-500">{pilotProfile.primaryContactEmail}</p>
            </div>
            <div className="rounded-[1.5rem] border border-ink-100 bg-white/80 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Generated</p>
              <p className="mt-2 text-sm font-medium text-ink-900">{report.generatedAtLabel}</p>
              <p className="mt-2 text-sm text-ink-500">{report.stageLabel}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="px-6 py-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink-900">Current recommendation</p>
            <p className="mt-2 text-xl font-medium text-ink-950">{report.recommendationLabel}</p>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-600">{report.recommendationDetail}</p>
          </div>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-4">
        {report.currentSnapshot.map((item) => (
          <KpiCard key={item.label} detail={item.detail} label={item.label} value={item.value} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
              <FileBarChart2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">What is observed now</p>
              <p className="mt-1 text-sm text-ink-500">These are current workspace facts, not modeled claims.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {report.observedProof.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">What is still modeled</p>
              <p className="mt-1 text-sm text-ink-500">Keep these in planning language until observed data catches up.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {report.modeledAssumptions.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Go / hold criteria</p>
            <p className="mt-1 text-sm text-ink-500">Use explicit criteria so the pilot motion stays disciplined.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {report.goNoGoCriteria.map((criterion) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={criterion.label}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{criterion.label}</p>
                  <Badge variant={criterionBadgeVariant(criterion.status)}>{criterion.status}</Badge>
                </div>
                <p className="mt-3 text-sm leading-7 text-ink-600">{criterion.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-900">Open risks and blockers</p>
              <p className="mt-1 text-sm text-ink-500">These are the main reasons not to overstate commercial proof yet.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {report.risks.length > 0 ? (
              report.risks.map((risk) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={risk}>
                  <p className="text-sm leading-7 text-ink-600">{risk}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm leading-7 text-ink-600">No material blockers are currently surfaced in the proof report.</p>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Measured pilot movement</p>
            <p className="mt-1 text-sm text-ink-500">{report.measuredPilot.note}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant={report.measuredPilot.hasBaseline ? "sage" : "gold"}>
              Baseline {report.measuredPilot.hasBaseline ? "on file" : "missing"}
            </Badge>
            {report.measuredPilot.baselineLabel ? <Badge variant="muted">Baseline {report.measuredPilot.baselineLabel}</Badge> : null}
            {report.measuredPilot.latestCheckpointLabel ? (
              <Badge variant="muted">Latest checkpoint {report.measuredPilot.latestCheckpointLabel}</Badge>
            ) : null}
            <Badge variant="muted">{report.measuredPilot.checkpointCount} checkpoints</Badge>
          </div>
          <div className="mt-5 space-y-4">
            {report.measuredPilot.deltaRows.length > 0 ? (
              report.measuredPilot.deltaRows.map((row) => (
                <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={row.label}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-ink-200 bg-ink-50 px-4 py-5">
                <p className="text-sm leading-7 text-ink-600">
                  No measured movement can be shown yet because the pilot does not have a baseline and checkpoint pair on record.
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Calibration and decision discipline</p>
            <p className="mt-1 text-sm text-ink-500">A buyer should see how reviewer consistency is managed, not only a headline score.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="sage">{report.calibration.statusLabel}</Badge>
            <Badge variant="muted">{report.calibration.readyCount} ready</Badge>
            <Badge variant="gold">{report.calibration.openCount} open</Badge>
            {report.calibration.escalatedCount > 0 ? (
              <Badge variant="danger">{report.calibration.escalatedCount} escalated</Badge>
            ) : null}
          </div>
          <div className="mt-5 space-y-4">
            {report.calibration.highRiskReviewers.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item.reviewerName}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900">{item.reviewerName}</p>
                  <Badge variant={item.calibrationStatus === "watch" ? "danger" : item.calibrationStatus === "mixed" ? "gold" : "sage"}>
                    {item.calibrationStatus.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-ink-500">
                  Disagreement {item.disagreementRate}% · Known outcomes {item.knownOutcomeCount}
                </p>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.recommendation}</p>
              </div>
            ))}
            {report.calibration.blockers.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Buyer pressure test</p>
            <p className="mt-1 text-sm text-ink-500">Use these objections to keep the conversation disciplined.</p>
          </div>
          <div className="mt-5 space-y-4">
            {report.buyerPressureTest.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4" key={item.objection}>
                <p className="text-sm font-medium text-ink-900">{item.objection}</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">{item.response}</p>
                <p className="mt-3 text-sm text-ink-500">Proof to show: {item.proofPoint}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="px-6 py-6">
          <div className="border-b border-ink-100 pb-4">
            <p className="text-sm font-medium text-ink-900">Next moves and success criteria</p>
            <p className="mt-1 text-sm text-ink-500">Focus the next buyer motion on evidence that can be earned, not feature sprawl.</p>
          </div>
          <div className="mt-5 space-y-4">
            {report.nextMoves.map((item) => (
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4" key={item}>
                <p className="text-sm leading-7 text-ink-600">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
            <p className="text-sm font-medium text-ink-900">Success criteria for this template</p>
            <div className="mt-3 space-y-3">
              {report.successMetrics.map((item) => (
                <p className="text-sm leading-7 text-ink-600" key={item}>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
