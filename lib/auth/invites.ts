import { MembershipRole, UserRole, WorkspaceInviteStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const INVITE_EXPIRY_DAYS = 7;

export function buildWorkspaceInviteExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
  return expiresAt;
}

export function buildWorkspaceInvitePath(token: string) {
  return `/accept-invite/${token}`;
}

export function mapMembershipRoleToUserRole(role: MembershipRole) {
  return role === MembershipRole.OWNER || role === MembershipRole.ADMIN ? UserRole.ADMIN : UserRole.OPERATOR;
}

export async function getWorkspaceInviteContext(token: string) {
  const invite = await prisma.workspaceInvite.findUnique({
    where: { token },
    include: {
      organization: true,
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!invite) {
    return null;
  }

  const isExpired = invite.expiresAt < new Date();
  const isActive = invite.status === WorkspaceInviteStatus.ACTIVE && !isExpired;

  return {
    invite,
    isExpired,
    isActive,
    path: buildWorkspaceInvitePath(invite.token),
  };
}
