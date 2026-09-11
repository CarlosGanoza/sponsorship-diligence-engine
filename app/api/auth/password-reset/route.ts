import { AuditLogTargetType, PasswordResetTokenStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditLog } from "@/lib/audit/log";
import { buildPasswordResetExpiry, buildPasswordResetPath } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/db/prisma";

const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const parsed = requestPasswordResetSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Reset details are invalid." }, { status: 400 });
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
    return NextResponse.json({
      success: true,
      resetPath: null,
      message: "If that account exists, a password-reset path is now ready for internal delivery.",
    });
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

  return NextResponse.json({
    success: true,
    resetPath: buildPasswordResetPath(resetToken.token),
    message: "A password-reset path is ready for internal delivery.",
  });
}
