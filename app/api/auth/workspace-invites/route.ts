import { AuditLogTargetType, MembershipRole, WorkspaceInviteStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditLog } from "@/lib/audit/log";
import { buildWorkspaceInviteExpiry, buildWorkspaceInvitePath } from "@/lib/auth/invites";
import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const createInviteSchema = z.object({
  email: z.string().email(),
  inviteeName: z.string().min(2).max(120),
  membershipRole: z.nativeEnum(MembershipRole),
  title: z.string().max(120).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.ADMIN)) {
    return NextResponse.json({ error: "Admin workspace access required." }, { status: 403 });
  }

  const parsed = createInviteSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invite details are invalid." }, { status: 400 });
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
    return NextResponse.json({ error: "That email already has workspace access." }, { status: 400 });
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
    return NextResponse.json({
      success: true,
      invitePath: buildWorkspaceInvitePath(activeInvite.token),
      inviteId: activeInvite.id,
      reused: true,
    });
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
      createdById: session.userId,
    },
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    targetType: AuditLogTargetType.SETTINGS,
    action: "auth.invite_created",
    title: "Workspace invite created",
    detail: `${invite.email} · ${invite.membershipRole}${invite.title ? ` · ${invite.title}` : ""}`,
    payload: {
      inviteId: invite.id,
    },
  });

  revalidatePath("/settings");

  return NextResponse.json({
    success: true,
    invitePath: buildWorkspaceInvitePath(invite.token),
    inviteId: invite.id,
    reused: false,
  });
}
