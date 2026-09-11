import { notFound } from "next/navigation";

import { completePasswordResetFormAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPasswordResetContext } from "@/lib/auth/password-reset";

export default async function ResetPasswordTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const context = await getPasswordResetContext(token);
  const resolvedSearchParams = (await searchParams) ?? {};

  if (!context) {
    notFound();
  }

  const action = completePasswordResetFormAction.bind(null, token);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f4ec_0%,#fbfaf7_100%)] px-6 py-10 text-ink-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.22em] text-ink-400">Workspace password reset</p>
          <h1 className="font-serif text-5xl leading-tight text-ink-900">Set a new password</h1>
          <p className="max-w-2xl text-sm leading-7 text-ink-600">
            Resetting the password revokes prior active sessions and keeps the workspace audit trail intact.
          </p>
        </div>

        <Card className="px-6 py-6">
          <p className="text-sm font-medium text-ink-900">{context.resetToken.user.name}</p>
          <p className="mt-2 text-sm text-ink-500">{context.resetToken.user.email}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
            Link expires {context.resetToken.expiresAt.toLocaleString()}
          </p>
        </Card>

        {context.isActive ? (
          <Card className="px-6 py-6">
            <form action={action} className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.18em] text-ink-400" htmlFor="reset-password">
                  New password
                </label>
                <input
                  className="mt-2 w-full rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm text-ink-900"
                  id="reset-password"
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
              <Button type="submit">Update password</Button>
            </form>
          </Card>
        ) : (
          <Card className="px-6 py-6">
            <p className="text-sm font-medium text-ink-900">This reset link is no longer active</p>
            <p className="mt-3 text-sm leading-7 text-ink-600">
              The link may have expired, already been used, or been revoked after another password reset request.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
