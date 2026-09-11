import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAppSession } from "@/lib/auth/session";
import { env } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; reset?: string; next?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextRoute =
    resolvedSearchParams.next && resolvedSearchParams.next.startsWith("/") && !resolvedSearchParams.next.startsWith("//")
      ? (resolvedSearchParams.next as Route)
      : ("/dashboard" as Route);
  const session = await getAppSession();

  if (session) {
    redirect(nextRoute);
  }

  const showError = resolvedSearchParams.error === "invalid";
  const showThrottledError = resolvedSearchParams.error === "throttled";
  const showResetSuccess = resolvedSearchParams.reset === "success";

  const memberships = await prisma.organizationMembership.findMany({
    include: {
      user: true,
      organization: true,
    },
    orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,164,143,0.16),_transparent_34%),linear-gradient(180deg,_#f7f5ef_0%,_#f5f2eb_100%)] px-4 py-10 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="px-8 py-10">
            <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Operator workspace</p>
            <h1 className="mt-4 font-serif text-5xl leading-tight text-ink-900">Sign in to the sponsorship review console.</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-ink-600">
              Phase 2 adds team accounts and workspace sessions so alerts, stage overrides, and operating queues can be assigned to real operators instead of an implicit demo user.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-ink-100 bg-ink-50 px-5 py-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Workspace</p>
                <p className="mt-2 text-lg font-medium text-ink-900">SignalSponsor Demo Workspace</p>
                <p className="mt-2 text-sm leading-6 text-ink-500">A seeded operating environment for sponsorship diligence, alerts, and outbound advocacy workflows.</p>
              </div>
              <div className="rounded-[1.75rem] border border-ink-100 bg-ink-50 px-5 py-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">What is protected</p>
                <p className="mt-2 text-sm leading-7 text-ink-600">
                  Dashboard, candidates, sponsors, briefs, alerts, settings, exports, and CRM handoff routes all require a workspace session.
                </p>
              </div>
            </div>
          </Card>

          <Card className="px-8 py-10">
            <div className="border-b border-ink-100 pb-5">
              <p className="text-sm font-medium text-ink-900">
                {env.authMode === "password" ? "Workspace sign-in" : "Demo accounts"}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                {env.authMode === "password"
                  ? "Use a seeded workspace account and the configured demo password. This keeps local review environments closer to real operator access control."
                  : "Use one of the seeded team accounts below. Demo mode keeps local onboarding friction low while the rest of the workspace stays session-protected."}
              </p>
            </div>
            {env.authMode === "password" ? (
              <div className="mt-6 space-y-5">
                <form action={loginAction} className="rounded-[1.75rem] border border-ink-100 bg-ink-50 px-5 py-5">
                  <input name="next" type="hidden" value={resolvedSearchParams.next ?? ""} />
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-ink-400" htmlFor="login-email">
                        Workspace account
                      </label>
                      <select
                        className="mt-2 w-full rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-900"
                        defaultValue={memberships[0]?.user.email ?? ""}
                        id="login-email"
                        name="email"
                      >
                        {memberships.map((membership) => (
                          <option key={membership.id} value={membership.user.email}>
                            {membership.user.name} · {membership.user.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-ink-400" htmlFor="login-password">
                        Password
                      </label>
                      <input
                        className="mt-2 w-full rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-900"
                        id="login-password"
                        name="password"
                        placeholder="Enter workspace password"
                        type="password"
                      />
                    </div>
                    {showError ? (
                      <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        The email or password was not accepted.
                      </p>
                    ) : null}
                    {showThrottledError ? (
                      <p className="rounded-2xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-800">
                        Too many sign-in attempts were recorded for this account and browser context. Wait a few minutes before trying again.
                      </p>
                    ) : null}
                    {showResetSuccess ? (
                      <p className="rounded-2xl border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
                        Password updated. Sign in with the new credential.
                      </p>
                    ) : null}
                    <Button className="w-full" type="submit">
                      Sign in
                    </Button>
                    <Link className="text-sm text-sage-700 transition hover:text-sage-900" href={"/reset-password" as Route}>
                      Forgot password?
                    </Link>
                  </div>
                </form>

                <div className="rounded-[1.75rem] border border-ink-100 bg-white px-5 py-5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Seeded demo password</p>
                  <p className="mt-2 text-sm leading-6 text-ink-600">
                    Default local password: <code>{env.demoUserPassword}</code>. Rotate <code>DEMO_USER_PASSWORD</code> in
                    your environment before sharing a workspace beyond local demo use.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {memberships.map((membership) => (
                  <form action={loginAction} className="rounded-[1.75rem] border border-ink-100 bg-ink-50 px-5 py-5" key={membership.id}>
                    <input name="email" type="hidden" value={membership.user.email} />
                    <input name="next" type="hidden" value={resolvedSearchParams.next ?? ""} />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-medium text-ink-900">{membership.user.name}</p>
                        <p className="mt-1 text-sm text-ink-500">{membership.user.email}</p>
                        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-ink-400">
                          {membership.membershipRole} · {membership.user.role}
                        </p>
                      </div>
                      <Button size="sm" type="submit">
                        Enter workspace
                      </Button>
                    </div>
                  </form>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-[1.75rem] border border-ink-100 bg-white px-5 py-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">Seeded workspace accounts</p>
              <div className="mt-4 space-y-3">
                {memberships.map((membership) => (
                  <div className="flex items-start justify-between gap-3 text-sm" key={`${membership.id}-summary`}>
                    <div>
                      <p className="font-medium text-ink-900">{membership.user.name}</p>
                      <p className="mt-1 text-ink-500">{membership.user.email}</p>
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-400">
                      {membership.membershipRole} · {membership.user.role}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
