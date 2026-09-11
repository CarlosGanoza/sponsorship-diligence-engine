import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSponsorsList, searchValueToString } from "@/lib/db/queries";

export default async function SponsorsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const filters = {
    query: searchValueToString(resolved.q),
    domain: searchValueToString(resolved.domain) || "all",
    seniority: searchValueToString(resolved.seniority) || "all",
    style: searchValueToString(resolved.style) || "all",
    geography: searchValueToString(resolved.geography) || "all",
  };
  const sponsors = await getSponsorsList(filters);

  return (
    <AppShell
      title="Sponsors"
      description="Browse the curated internal sponsor directory and review current fit signals from the seeded recommendation graph."
    >
      <Card className="px-5 py-5">
        <form className="grid gap-4 lg:grid-cols-[1.3fr_repeat(4,0.8fr)]" method="get">
          <Input defaultValue={filters.query} name="q" placeholder="Search sponsor or organization" />
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.domain}
            name="domain"
          >
            <option value="all">All domains</option>
            <option value="climate">Climate</option>
            <option value="health">Health</option>
            <option value="education">Education</option>
            <option value="civic">Civic</option>
            <option value="workforce">Workforce</option>
            <option value="housing">Housing</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.seniority}
            name="seniority"
          >
            <option value="all">All seniority</option>
            <option value="DIRECTOR">Director</option>
            <option value="VP">VP</option>
            <option value="C_SUITE">C-Suite</option>
            <option value="FOUNDER">Founder</option>
            <option value="PARTNER">Partner</option>
            <option value="EXECUTIVE">Executive</option>
          </select>
          <select
            className="h-11 rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
            defaultValue={filters.style}
            name="style"
          >
            <option value="all">All sponsor styles</option>
            <option value="HANDS_ON">Hands-on</option>
            <option value="SELECTIVE_DOOR_OPENER">Selective door opener</option>
            <option value="SYSTEMS_BUILDER">Systems builder</option>
            <option value="PUBLIC_ADVOCATE">Public advocate</option>
            <option value="QUIET_CONNECTOR">Quiet connector</option>
          </select>
          <Input defaultValue={filters.geography === "all" ? "" : filters.geography} name="geography" placeholder="Geography" />
        </form>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        {sponsors.map((sponsor) => (
          <Card className="px-6 py-6" key={sponsor.id}>
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-5">
              <div>
                <p className="font-serif text-3xl text-ink-900">{sponsor.fullName}</p>
                <p className="mt-2 text-sm text-ink-500">
                  {sponsor.title} · {sponsor.organization}
                </p>
              </div>
              <Badge variant={sponsor.warmIntroAvailable ? "sage" : "gold"}>
                {sponsor.warmIntroAvailable ? "Warm intro available" : "Warm intro limited"}
              </Badge>
            </div>

            <p className="mt-5 text-sm leading-7 text-ink-600">{sponsor.bio}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {sponsor.expertiseList.map((item) => (
                <Badge key={item} variant="muted">
                  {item}
                </Badge>
              ))}
              {sponsor.interestList.map((item) => (
                <Badge key={item} variant="sage">
                  {item}
                </Badge>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Geography</p>
                <p className="mt-2 text-sm text-ink-700">{sponsor.geography}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Style</p>
                <p className="mt-2 text-sm text-ink-700">{sponsor.sponsorStyle.replaceAll("_", " ")}</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Availability</p>
                <p className="mt-2 text-sm text-ink-700">{sponsor.availabilityStatus.replaceAll("_", " ")}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Active sponsor load</p>
                <p className="mt-2 text-sm text-ink-700">
                  {sponsor.operatingProfile.activePipelineCount} / {sponsor.operatingProfile.maxConcurrentPaths}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Capacity score</p>
                <p className="mt-2 text-sm text-ink-700">{sponsor.operatingProfile.capacityScore}/8</p>
              </div>
              <div className="rounded-[1.5rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Responsiveness</p>
                <p className="mt-2 text-sm text-ink-700">{sponsor.operatingProfile.responsivenessScore}/8</p>
              </div>
            </div>

            <Link className="mt-6 inline-flex items-center gap-2 font-medium text-ink-900 hover:text-sage-700" href={`/sponsors/${sponsor.id}`}>
              Open sponsor detail
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        ))}
      </section>
    </AppShell>
  );
}
