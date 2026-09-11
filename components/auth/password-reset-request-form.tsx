"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordResetRequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetPath, setResetPath] = useState<string | null>(null);

  return (
    <Card className="px-8 py-10">
      <p className="text-sm font-medium text-ink-900">Reset workspace password</p>
      <p className="mt-2 text-sm leading-6 text-ink-500">
        Submit a workspace email to issue a password-reset link. Until delivery adapters are configured, the local review link is shown inline instead of being emailed.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          setMessage(null);
          setResetPath(null);

          const formData = new FormData(event.currentTarget);

          const response = await fetch("/api/auth/password-reset", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: String(formData.get("email") ?? ""),
            }),
          }).catch(() => null);
          const result = (await response?.json().catch(() => null)) as
            | {
                success?: boolean;
                error?: string;
                message?: string | null;
                resetPath?: string | null;
              }
            | null;
          setPending(false);

          if (!response?.ok || !result?.success) {
            setError(result?.error ?? "Could not issue the password reset.");
            return;
          }

          setMessage(result.message ?? "Password reset requested.");
          setResetPath(result.resetPath ?? null);
          formRef.current?.reset();
        }}
        ref={formRef}
      >
        <div>
          <Label htmlFor="reset-email">Workspace email</Label>
          <Input id="reset-email" name="email" type="email" />
        </div>
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? "Issuing reset..." : "Issue password reset"}
        </Button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="text-sm text-ink-600">{message}</p> : null}
        {resetPath ? (
          <code className="block rounded-xl bg-ink-50 px-3 py-3 text-xs text-ink-600" data-testid="password-reset-path">
            {resetPath}
          </code>
        ) : null}
      </form>
    </Card>
  );
}
