import { notFound } from "next/navigation";

import { acceptWorkspaceInviteFormAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getWorkspaceInviteContext } from "@/lib/auth/invites";

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const context = await getWorkspaceInviteContext(token);
  const resolvedSearchParams = (await searchParams) ?? {};

  if (!context) {
    notFound();
  }

  const action = acceptWorkspaceInviteFormAction.bind(null, token);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f4ec_0%,#fbfaf7_100%)] px-6 py-10 text-ink-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.22em] text-ink-400">Workspace invite</p>
          <h1 className="font-serif text-5xl leading-tight text-ink-900">Join the sponsorship review workspace</h1>
          <p className="max-w-2xl text-sm leading-7 text-ink-600">
            This invite grants internal workspace access. Sponsor-facing routes, exports, and sensitive review actions remain session-protected after you join.
          </p>
        </div>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">{context.invite.organization.name}</p>
          <p className="mt-2 text-sm text-ink-500">{context.invite.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-500">
              {context.invite.membershipRole}
            </span>
            {context.invite.title ? (
              <span className="inline-flex items-center rounded-full bg-ink-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-500">
                {context.invite.title}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-400">
            Invite expires {context.invite.expiresAt.toLocaleString()}
          </p>
        </Card>

        {context.isActive ? (
          <Card className="px-6 py-6">
            <form action={action} className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] text-ink-400" htmlFor="invite-name">
                  Full name
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-900"
                  defaultValue={context.invite.inviteeName}
                  id="invite-name"
                  name="name"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] text-ink-400" htmlFor="invite-password">
                  Password
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-900"
                  id="invite-password"
                  name="password"
                  placeholder="Use at least 10 characters with letters and numbers"
                  type="password"
                />
              </div>
              {resolvedSearchParams.error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {resolvedSearchParams.error}
                </p>
              ) : null}
              <Button type="submit">Accept invite</Button>
            </form>
          </Card>
        ) : (
          <Card className="px-6 py-6">
            <p className="text-sm font-medium text-ink-900">This invite is no longer active</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">
              The invite may have expired, already been accepted, or been revoked by an admin.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
