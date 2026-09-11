"use server";

import { AuditLogTargetType, MembershipRole, PasswordResetTokenStatus, WorkspaceInviteStatus } from "@prisma/client";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAuditLog } from "@/lib/audit/log";
import { mapMembershipRoleToUserRole, buildWorkspaceInviteExpiry, buildWorkspaceInvitePath, getWorkspaceInviteContext } from "@/lib/auth/invites";
import { validatePasswordStrength, hashPassword } from "@/lib/auth/passwords";
import { buildPasswordResetExpiry, buildPasswordResetPath, getPasswordResetContext } from "@/lib/auth/password-reset";
import { createAppSession, getAppSession, requireActionSession, revokeOtherSessions, revokeSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const createInviteSchema = z.object({
  email: z.string().email(),
  inviteeName: z.string().min(2).max(120),
  membershipRole: z.nativeEnum(MembershipRole),
  title: z.string().max(120).optional().or(z.literal("")),
});

const acceptInviteSchema = z.object({
  name: z.string().min(2).max(120),
  password: z.string().min(10).max(200),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const completePasswordResetSchema = z.object({
  password: z.string().min(10).max(200),
});

export async function createWorkspaceInviteAction(input: z.infer<typeof createInviteSchema>) {
  const session = await requireActionSession(MembershipRole.ADMIN);
  const parsed = createInviteSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Invite details are invalid." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: {
          organizationId: session.organizationId,
        },
      },
    },
  });

  if (existingUser?.memberships.length) {
    return { success: false, error: "That email already has workspace access." };
  }

  const activeInvite = await prisma.workspaceInvite.findFirst({
    where: {
      organizationId: session.organizationId,
      email,
      status: WorkspaceInviteStatus.ACTIVE,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (activeInvite) {
    return {
      success: true,
      invitePath: buildWorkspaceInvitePath(activeInvite.token),
      inviteId: activeInvite.id,
      reused: true,
    };
  }

  const invite = await prisma.workspaceInvite.create({
    data: {
      organizationId: session.organizationId,
      email,
      inviteeName: parsed.data.inviteeName.trim(),
      membershipRole: parsed.data.membershipRole,
      title: parsed.data.title?.trim() || null,
      token: crypto.randomUUID(),
      expiresAt: buildWorkspaceInviteExpiry(),
      createdById: session.user.id,
    },
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    targetType: AuditLogTargetType.SETTINGS,
    action: "auth.invite_created",
    title: "Workspace invite created",
    detail: `${invite.email} · ${invite.membershipRole}${invite.title ? ` · ${invite.title}` : ""}`,
    payload: {
      inviteId: invite.id,
    },
  });

  return {
    success: true,
    invitePath: buildWorkspaceInvitePath(invite.token),
    inviteId: invite.id,
    reused: false,
  };
}

export async function revokeWorkspaceInviteAction(inviteId: string) {
  const session = await requireActionSession(MembershipRole.ADMIN);
  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      id: inviteId,
      organizationId: session.organizationId,
    },
  });

  if (!invite) {
    return { success: false, error: "Invite not found." };
  }

  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: {
      status: WorkspaceInviteStatus.REVOKED,
    },
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    targetType: AuditLogTargetType.SETTINGS,
    action: "auth.invite_revoked",
    title: "Workspace invite revoked",
    detail: invite.email,
    payload: {
      inviteId: invite.id,
    },
  });

  return { success: true };
}

export async function acceptWorkspaceInviteAction(token: string, input: z.infer<typeof acceptInviteSchema>) {
  const parsed = acceptInviteSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Invite acceptance details are invalid." };
  }

  const passwordCheck = validatePasswordStrength(parsed.data.password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.error ?? "Password is too weak." };
  }

  const context = await getWorkspaceInviteContext(token);

  if (!context || !context.isActive) {
    return { success: false, error: "This invite is no longer active." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: context.invite.email },
  });

  if (existingUser) {
    return { success: false, error: "That email already exists. Ask an admin to issue a different invite." };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email: context.invite.email,
      role: mapMembershipRoleToUserRole(context.invite.membershipRole),
      passwordCredential: {
        create: {
          passwordHash: hashPassword(parsed.data.password.trim()),
        },
      },
      memberships: {
        create: {
          organizationId: context.invite.organizationId,
          membershipRole: context.invite.membershipRole,
          title: context.invite.title,
        },
      },
    },
  });

  await prisma.workspaceInvite.update({
    where: { id: context.invite.id },
    data: {
      status: WorkspaceInviteStatus.ACCEPTED,
      acceptedAt: new Date(),
      acceptedUserId: user.id,
    },
  });

  await recordAuditLog({
    organizationId: context.invite.organizationId,
    actorUserId: user.id,
    targetType: AuditLogTargetType.SETTINGS,
    action: "auth.invite_accepted",
    title: "Workspace invite accepted",
    detail: `${context.invite.email} joined ${context.invite.organization.name}.`,
    payload: {
      inviteId: context.invite.id,
      membershipRole: context.invite.membershipRole,
    },
  });

  await createAppSession(user.id, context.invite.organizationId);

  return { success: true, redirectTo: "/dashboard" as Route };
}

export async function requestPasswordResetAction(input: z.infer<typeof requestPasswordResetSchema>) {
  const parsed = requestPasswordResetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Reset details are invalid." };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: {
          organization: true,
        },
        orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
      },
      passwordCredential: true,
    },
  });

  if (!user?.passwordCredential || user.memberships.length === 0) {
    return {
      success: true,
      resetPath: null,
      message: "If that account exists, a password-reset path is now ready for internal delivery.",
    };
  }

  await prisma.passwordResetToken.updateMany({
    where: {
      userId: user.id,
      status: PasswordResetTokenStatus.ACTIVE,
    },
    data: {
      status: PasswordResetTokenStatus.REVOKED,
    },
  });

  const resetToken = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: crypto.randomUUID(),
      expiresAt: buildPasswordResetExpiry(),
    },
  });

  await recordAuditLog({
    organizationId: user.memberships[0].organizationId,
    actorUserId: user.id,
    targetType: AuditLogTargetType.SETTINGS,
    action: "auth.password_reset_requested",
    title: "Password reset issued",
    detail: `${user.email} · ${user.memberships[0].organization.name}`,
    payload: {
      resetTokenId: resetToken.id,
    },
  });

  return {
    success: true,
    resetPath: buildPasswordResetPath(resetToken.token),
    message: "A password-reset path is ready for internal delivery.",
  };
}

export async function completePasswordResetAction(token: string, input: z.infer<typeof completePasswordResetSchema>) {
  const parsed = completePasswordResetSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: "Password reset details are invalid." };
  }

  const passwordCheck = validatePasswordStrength(parsed.data.password);
  if (!passwordCheck.valid) {
    return { success: false, error: passwordCheck.error ?? "Password is too weak." };
  }

  const context = await getPasswordResetContext(token);

  if (!context || !context.isActive) {
    return { success: false, error: "This reset link is no longer active." };
  }

  await prisma.$transaction([
    prisma.userPasswordCredential.upsert({
      where: { userId: context.resetToken.userId },
      update: {
        passwordHash: hashPassword(parsed.data.password.trim()),
        mustRotate: false,
      },
      create: {
        userId: context.resetToken.userId,
        passwordHash: hashPassword(parsed.data.password.trim()),
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: context.resetToken.id },
      data: {
        status: PasswordResetTokenStatus.USED,
        usedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: context.resetToken.userId,
        status: PasswordResetTokenStatus.ACTIVE,
        id: {
          not: context.resetToken.id,
        },
      },
      data: {
        status: PasswordResetTokenStatus.REVOKED,
      },
    }),
    prisma.appSession.deleteMany({
      where: {
        userId: context.resetToken.userId,
      },
    }),
  ]);

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId: context.resetToken.userId,
    },
    orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
  });

  if (membership) {
    await recordAuditLog({
      organizationId: membership.organizationId,
      actorUserId: context.resetToken.userId,
      targetType: AuditLogTargetType.SETTINGS,
      action: "auth.password_reset_completed",
      title: "Password reset completed",
      detail: context.resetToken.user.email,
      payload: {
        resetTokenId: context.resetToken.id,
      },
    });
  }

  return { success: true, redirectTo: "/login?reset=success" as Route };
}

export async function revokeSessionAction(sessionId: string) {
  const session = await requireActionSession(MembershipRole.VIEWER);
  const currentSession = await getAppSession();

  if (!currentSession) {
    return { success: false, error: "Session expired." };
  }

  if (sessionId === currentSession.id) {
    return { success: false, error: "Use sign out for the current session." };
  }

  await revokeSessionRecord({
    sessionId,
    organizationId: session.organizationId,
    userId: session.user.id,
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    targetType: AuditLogTargetType.SETTINGS,
    action: "auth.session_revoked",
    title: "Workspace session revoked",
    detail: `Revoked one active session for ${session.user.email}.`,
  });

  return { success: true };
}

export async function revokeOtherSessionsAction() {
  const session = await requireActionSession(MembershipRole.VIEWER);
  const currentSession = await getAppSession();

  if (!currentSession) {
    return { success: false, error: "Session expired." };
  }

  await revokeOtherSessions({
    currentSessionId: currentSession.id,
    organizationId: session.organizationId,
    userId: session.user.id,
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.user.id,
    targetType: AuditLogTargetType.SETTINGS,
    action: "auth.other_sessions_revoked",
    title: "Other workspace sessions revoked",
    detail: `Revoked all other active sessions for ${session.user.email}.`,
  });

  return { success: true };
}

export async function acceptWorkspaceInviteFormAction(token: string, formData: FormData) {
  const result = await acceptWorkspaceInviteAction(token, {
    name: String(formData.get("name") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.success) {
    redirect(`/accept-invite/${token}?error=${encodeURIComponent(result.error ?? "invalid")}` as Route);
  }

  redirect(result.redirectTo ?? ("/dashboard" as Route));
}

export async function completePasswordResetFormAction(token: string, formData: FormData) {
  const result = await completePasswordResetAction(token, {
    password: String(formData.get("password") ?? ""),
  });

  if (!result.success) {
    redirect(`/reset-password/${token}?error=${encodeURIComponent(result.error ?? "invalid")}` as Route);
  }

  redirect(result.redirectTo ?? ("/login" as Route));
}
