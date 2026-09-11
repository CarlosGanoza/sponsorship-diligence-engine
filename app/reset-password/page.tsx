import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { PasswordResetRequestForm } from "@/components/auth/password-reset-request-form";
import { Card } from "@/components/ui/card";
import { getAppSession } from "@/lib/auth/session";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ reset?: string }>;
}) {
  const session = await getAppSession();

  if (session) {
    redirect("/dashboard" as Route);
  }

  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,164,143,0.16),_transparent_34%),linear-gradient(180deg,_#f7f5ef_0%,_#f5f2eb_100%)] px-4 py-10 md:px-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="px-8 py-10">
          <p className="text-sm uppercase tracking-[0.24em] text-sage-600">Credential recovery</p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-ink-900">Recover workspace access without breaking the audit trail.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-ink-600">
            Password resets revoke prior active sessions and preserve workspace audit history. Until delivery adapters are configured, the local reset path is shown directly after request.
          </p>
          {resolvedSearchParams.reset === "success" ? (
            <p className="mt-6 rounded-[1.5rem] border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
              Password updated. Sign in with the new credential.
            </p>
          ) : null}
          <div className="mt-8">
            <Link className="text-sm text-sage-700 transition hover:text-sage-900" href={"/login" as Route}>
              Back to sign in
            </Link>
          </div>
        </Card>

        <PasswordResetRequestForm />
      </div>
    </div>
  );
}
