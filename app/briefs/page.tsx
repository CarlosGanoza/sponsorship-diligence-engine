import Link from "next/link";
import type { Route } from "next";

import { ArrowRight } from "lucide-react";

import { BriefStatusBadge } from "@/components/dashboard/brief-status-badge";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getOpportunityBriefsList, searchValueToString } from "@/lib/db/queries";

export default async function OpportunityBriefsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const filters = {
    query: searchValueToString(resolved.q),
    status: searchValueToString(resolved.status) || "all",
    type: searchValueToString(resolved.type) || "all",
  };
  const briefs = await getOpportunityBriefsList(filters);

  return (
    <AppShell
      title="Opportunity briefs"
      description="Move from sponsor fit into a concrete ask: target sponsor, why now, proof to bring, and success conditions in a printable internal brief."
    >
      <Card className="px-5 py-5">
        <form className="grid gap-4 lg:grid-cols-[1.3fr_repeat(2,0.8fr)]" method="get">
          <Input defaultValue={filters.query} name="q" placeholder="Search candidate, sponsor, or brief title" />
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.status}
            name="status"
          >
            <option value="all">All statuses</option>
            <option value="READY">Ready</option>
            <option value="DRAFT">Draft</option>
            <option value="HOLD">Hold</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.type}
            name="type"
          >
            <option value="all">All brief types</option>
            <option value="STRETCH_ROLE">Stretch role</option>
            <option value="REGIONAL_SCALE_INTRO">Regional scale intro</option>
            <option value="PILOT_PARTNERSHIP">Pilot partnership</option>
            <option value="PUBLIC_ADVOCACY">Public advocacy</option>
            <option value="BOARD_OBSERVER">Board observer</option>
            <option value="SYSTEMS_RESIDENCY">Systems residency</option>
            <option value="TRUSTED_INTRO">Trusted intro</option>
          </select>
        </form>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        {briefs.map((brief) => (
          <Card className="px-6 py-6" key={brief.id}>
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <BriefStatusBadge status={brief.status} />
                  <Badge variant="muted">{brief.opportunityType.replaceAll("_", " ")}</Badge>
                </div>
                <p className="mt-4 font-serif text-3xl text-ink-900">{brief.title}</p>
                <p className="mt-2 text-sm text-ink-500">
                  {brief.candidate.fullName} · {brief.sponsor.fullName} · {brief.sponsor.organization}
                </p>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{brief.updatedAtLabel}</p>
            </div>

            <p className="mt-5 text-sm leading-7 text-ink-600">{brief.summary}</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Talking points</p>
                <div className="mt-3 space-y-2">
                  {brief.talkingPointsList.slice(0, 3).map((item) => (
                    <p className="text-sm leading-7 text-ink-600" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-sm font-medium text-ink-900">Proof to bring</p>
                <div className="mt-3 space-y-2">
                  {brief.proofToBringList.slice(0, 3).map((item) => (
                    <p className="text-sm leading-7 text-ink-600" key={item}>
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700"
                href={`/briefs/${brief.candidateId}?sponsor=${brief.sponsorId}` as Route}
              >
                Open brief
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700"
                href={`/outreach/${brief.candidateId}?sponsor=${brief.sponsorId}` as Route}
              >
                Outreach plan
              </Link>
              <Link
                className="inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700"
                href={`/packets/${brief.candidateId}?sponsor=${brief.sponsorId}`}
              >
                Open packet
              </Link>
            </div>
          </Card>
        ))}
        {briefs.length === 0 ? (
          <Card className="px-6 py-8">
            <p className="font-medium text-ink-900">No briefs match the current filters</p>
            <p className="mt-3 text-sm leading-7 text-ink-500">
              Generate briefs from a candidate profile, or broaden the current query and status filters.
            </p>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
