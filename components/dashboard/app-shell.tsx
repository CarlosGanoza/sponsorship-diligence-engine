import Link from "next/link";
import type { Route } from "next";

import {
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  Compass,
  CircleDollarSign,
  FileText,
  LineChart,
  ListTodo,
  LogOut,
  Presentation,
  Scale,
  ShieldCheck,
  Settings2,
  Users,
  Workflow,
} from "lucide-react";

import { logoutAction } from "@/app/actions";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NavLink } from "@/components/dashboard/nav-link";
import { requirePageSession } from "@/lib/auth/session";
import { getGlobalCommandIndex } from "@/lib/db/queries";
import { env } from "@/lib/db/env";

const navItems: { href: Route; label: string; icon: typeof BarChart3 }[] = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/pilot" as Route, label: "Pilot", icon: Compass },
  { href: "/demo" as Route, label: "Demo", icon: Presentation },
  { href: "/roi" as Route, label: "ROI", icon: CircleDollarSign },
  { href: "/analytics" as Route, label: "Analytics", icon: LineChart },
  { href: "/calibration" as Route, label: "Calibration", icon: ShieldCheck },
  { href: "/audits" as Route, label: "Audits", icon: Scale },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/sponsors", label: "Sponsors", icon: BriefcaseBusiness },
  { href: "/briefs" as Route, label: "Briefs", icon: FileText },
  { href: "/pipeline" as Route, label: "Pipeline", icon: Workflow },
  { href: "/tasks" as Route, label: "Tasks", icon: ListTodo },
  { href: "/alerts" as Route, label: "Alerts", icon: BellRing },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export async function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const session = await requirePageSession();
  const commandItems = await getGlobalCommandIndex(session.organizationId);

  return (
    <div className="min-h-screen px-4 py-4 md:px-6">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="print-hidden">
          <Card className="sticky top-4 flex min-h-[calc(100vh-2rem)] flex-col justify-between px-5 py-6">
            <div>
              <div className="flex items-center justify-between">
                <Link className="font-serif text-3xl text-ink-900" href="/">
                  {env.appName}
                </Link>
                <Badge variant="sage">Demo</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-500">
                Underwriting for human potential, built from inspectable evidence and warm-path context.
              </p>
              <div className="mt-8 space-y-2 rounded-[2rem] bg-ink-50 p-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div className="flex items-center gap-2" key={item.href}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-500 shadow-soft">
                        <Icon className="h-4 w-4" />
                      </div>
                      <NavLink href={item.href} label={item.label} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[2rem] border border-ink-100 bg-ink-50 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-100 text-sage-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-800">Memo-first review</p>
                    <p className="text-xs text-ink-500">Every recommendation stays tied to evidence.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-ink-100 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Signed in</p>
                <p className="mt-2 text-sm font-medium text-ink-900">{session.user.name}</p>
                <p className="mt-1 text-sm text-ink-500">{session.user.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="muted">{session.user.role}</Badge>
                  <Badge variant="muted">{session.membership.membershipRole}</Badge>
                  <Badge variant="sage">{session.organization.name}</Badge>
                </div>
                <form action={logoutAction} className="mt-4">
                  <Button size="sm" type="submit" variant="ghost">
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </aside>

        <main className="space-y-6">
          <Card className="px-6 py-5">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Signal review workspace</p>
                <h1 className="mt-3 font-serif text-4xl leading-tight text-ink-900">{title}</h1>
                {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-500">{description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <CommandPalette items={commandItems} />
                {actions}
              </div>
            </div>
          </Card>

          {children}
        </main>
      </div>
    </div>
  );
}
