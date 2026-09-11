import { PasswordResetTokenStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const PASSWORD_RESET_EXPIRY_HOURS = 2;

export function buildPasswordResetExpiry() {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRY_HOURS);
  return expiresAt;
}

export function buildPasswordResetPath(token: string) {
  return `/reset-password/${token}`;
}

export async function getPasswordResetContext(token: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!resetToken) {
    return null;
  }

  const isExpired = resetToken.expiresAt < new Date();
  const isActive = resetToken.status === PasswordResetTokenStatus.ACTIVE && !isExpired;

  return {
    resetToken,
    isExpired,
    isActive,
    path: buildPasswordResetPath(resetToken.token),
  };
}
