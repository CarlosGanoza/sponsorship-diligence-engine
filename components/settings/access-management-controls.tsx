"use client";

import { MembershipRole } from "@prisma/client";
import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  revokeOtherSessionsAction,
  revokeSessionAction,
  revokeWorkspaceInviteAction,
} from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccessManagementControls({
  currentUserEmail,
  currentSessionId,
  sessions,
  invites,
}: {
  currentUserEmail: string;
  currentSessionId: string;
  sessions: Array<{
    id: string;
    createdAtLabel: string;
    expiresAtLabel: string;
    isCurrent: boolean;
  }>;
  invites: Array<{
    id: string;
    email: string;
    inviteeName: string;
    membershipRole: MembershipRole;
    title: string | null;
    expiresAtLabel: string;
    status: string;
    createdByName: string | null;
    path: string;
  }>;
}) {
  const router = useRouter();
  const inviteFormRef = useRef<HTMLFormElement>(null);
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInviteCreation = async () => {
    if (!inviteFormRef.current) {
      return;
    }

    setPending("invite");
    setError(null);

    const formData = new FormData(inviteFormRef.current);
    const response = await fetch("/api/auth/workspace-invites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        inviteeName: String(formData.get("inviteeName") ?? ""),
        membershipRole: String(formData.get("membershipRole") ?? MembershipRole.MEMBER),
        title: String(formData.get("title") ?? ""),
      }),
    }).catch(() => null);

    const payload = (await response?.json().catch(() => null)) as
      | {
          error?: string;
          invitePath?: string;
        }
      | null;

    setPending(null);

    if (!response?.ok) {
      setError(payload?.error ?? "Could not create the workspace invite.");
      return;
    }

    setInvitePath(payload?.invitePath ?? null);
    inviteFormRef.current.reset();
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
        <p className="text-sm font-medium text-ink-900">Invite teammate</p>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          Issue a time-bounded invite link. Until email delivery is configured, the link stays visible here for operator handoff.
        </p>
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
          }}
          ref={inviteFormRef}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="invite-name">Name</Label>
              <Input id="invite-name" name="inviteeName" />
            </div>
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" />
            </div>
            <div>
              <Label htmlFor="invite-role">Workspace role</Label>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-ink-200 bg-white px-4 text-sm text-ink-900 outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-100"
                defaultValue={MembershipRole.MEMBER}
                id="invite-role"
                name="membershipRole"
              >
                {Object.values(MembershipRole).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="invite-title">Title</Label>
              <Input id="invite-title" name="title" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              disabled={pending !== null}
              onClick={() => {
                void handleInviteCreation();
              }}
              size="sm"
              type="button"
            >
              {pending === "invite" ? "Creating invite..." : "Create invite"}
            </Button>
            {invitePath ? (
              <code className="rounded-xl bg-white px-3 py-2 text-xs text-ink-600" data-testid="workspace-invite-path">
                {invitePath}
              </code>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </div>

      <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink-900">Active sessions</p>
            <p className="mt-2 text-sm leading-6 text-ink-500">
              Manage current workspace sessions for {currentUserEmail}.
            </p>
          </div>
          <Button
            disabled={pending !== null || sessions.length <= 1}
            onClick={() => {
              setPending("revoke-others");
              setError(null);

              startTransition(async () => {
                const result = await revokeOtherSessionsAction();
                setPending(null);

                if (!result.success) {
                  setError(result.error ?? "Could not revoke the other sessions.");
                  return;
                }

                router.refresh();
              });
            }}
            size="sm"
            variant="secondary"
          >
            {pending === "revoke-others" ? "Revoking..." : "Revoke other sessions"}
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {sessions.map((session) => (
            <div
              className="rounded-[1.25rem] border border-ink-100 bg-white px-4 py-4"
              data-testid={`workspace-session-${session.id}`}
              key={session.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={session.isCurrent ? "sage" : "muted"}>
                      {session.isCurrent ? "Current session" : "Active session"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-ink-600">Created {session.createdAtLabel}</p>
                  <p className="mt-1 text-sm text-ink-500">Expires {session.expiresAtLabel}</p>
                </div>
                {!session.isCurrent ? (
                  <Button
                    disabled={pending !== null}
                    onClick={() => {
                      setPending(`session:${session.id}`);
                      setError(null);

                      startTransition(async () => {
                        const result = await revokeSessionAction(session.id);
                        setPending(null);

                        if (!result.success) {
                          setError(result.error ?? "Could not revoke the session.");
                          return;
                        }

                        router.refresh();
                      });
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    {pending === `session:${session.id}` ? "Revoking..." : "Revoke"}
                  </Button>
                ) : (
                  <Badge variant="muted">{currentSessionId === session.id ? "Signed in here" : "Current"}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-ink-100 bg-ink-50 px-4 py-4">
        <p className="text-sm font-medium text-ink-900">Open invites</p>
        <div className="mt-4 space-y-3">
          {invites.map((invite) => (
            <div
              className="rounded-[1.25rem] border border-ink-100 bg-white px-4 py-4"
              data-testid={`workspace-invite-${invite.id}`}
              key={invite.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="muted">{invite.membershipRole}</Badge>
                    <Badge variant={invite.status === "ACTIVE" ? "sage" : "muted"}>{invite.status}</Badge>
                    {invite.title ? <Badge variant="gold">{invite.title}</Badge> : null}
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink-900">{invite.inviteeName}</p>
                  <p className="mt-1 text-sm text-ink-500">{invite.email}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
                    Expires {invite.expiresAtLabel}
                    {invite.createdByName ? ` · issued by ${invite.createdByName}` : ""}
                  </p>
                  <code className="mt-3 block rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">{invite.path}</code>
                </div>
                {invite.status === "ACTIVE" ? (
                  <Button
                    disabled={pending !== null}
                    onClick={() => {
                      setPending(`invite:${invite.id}`);
                      setError(null);

                      startTransition(async () => {
                        const result = await revokeWorkspaceInviteAction(invite.id);
                        setPending(null);

                        if (!result.success) {
                          setError(result.error ?? "Could not revoke the invite.");
                          return;
                        }

                        router.refresh();
                      });
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    {pending === `invite:${invite.id}` ? "Revoking..." : "Revoke"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {invites.length === 0 ? (
            <p className="text-sm text-ink-500">No open workspace invites are active right now.</p>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
