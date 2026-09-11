import { NextResponse } from "next/server";

import { formatDisagreementDirection, formatUnderwritingDecision } from "@/lib/audits/report";
import { getAuditExportData, searchValueToString } from "@/lib/db/queries";

function escapeCsv(value: string | number | null) {
  const normalized = value === null ? "" : String(value);

  if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }

  return normalized;
}

function buildAuditCsv(data: NonNullable<Awaited<ReturnType<typeof getAuditExportData>>>) {
  const header = [
    "candidate",
    "stage",
    "system_decision",
    "human_decision",
    "direction",
    "readiness_score",
    "artifact_count",
    "claim_count",
    "evidence_depth",
    "support_coverage",
    "review_state",
    "region",
    "human_decided_by",
    "human_decision_at",
    "human_decision_summary",
  ];
  const rows = data.candidateRows.map((row) =>
    [
      row.displayName,
      row.stage,
      row.systemDecision,
      row.humanDecision,
      row.disagreementDirection,
      row.readinessScore,
      row.artifactCount,
      row.claimCount,
      row.evidenceDepth,
      row.supportCoverage,
      row.reviewState,
      row.actualRegion,
      row.humanDecidedByName,
      row.humanDecisionAtLabel,
      row.humanDecisionSummary,
    ]
      .map((value) => escapeCsv(value))
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

export async function GET(request: Request) {
  const data = await getAuditExportData();

  if (!data) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchValueToString(searchParams.get("format") ?? undefined) || "json";

  if (format === "csv") {
    return new NextResponse(buildAuditCsv(data), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="decision-audits.csv"',
      },
    });
  }

  return NextResponse.json({
    workspace: data.workspace,
    summary: data.summary,
    caveats: data.caveats,
    patternBreakdowns: data.patternBreakdowns,
    candidateRows: data.candidateRows.map((row) => ({
      ...row,
      systemDecisionLabel: formatUnderwritingDecision(row.systemDecision),
      humanDecisionLabel: formatUnderwritingDecision(row.humanDecision),
      disagreementLabel: formatDisagreementDirection(row.disagreementDirection),
    })),
  });
}
