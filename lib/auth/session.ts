import { cookies } from "next/headers";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { MembershipRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const SESSION_COOKIE_NAME = "signal_sponsor_session";
const SESSION_TTL_DAYS = 14;
const MEMBERSHIP_ROLE_ORDER: Record<MembershipRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function buildSessionExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
}

export function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function createSessionRecord(userId: string, organizationId: string) {
  const sessionToken = crypto.randomUUID();
  const expiresAt = buildSessionExpiry();

  await prisma.appSession.create({
    data: {
      sessionToken,
      userId,
      organizationId,
      expiresAt,
    },
  });

  return { sessionToken, expiresAt };
}

export function hasRequiredMembershipRole(currentRole: MembershipRole, minimumRole: MembershipRole) {
  return MEMBERSHIP_ROLE_ORDER[currentRole] >= MEMBERSHIP_ROLE_ORDER[minimumRole];
}

function describeMembershipRole(role: MembershipRole) {
  return role.toLowerCase();
}

async function tryClearSessionCookie() {
  const cookieStore = await cookies();

  try {
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Page-render reads can discover an invalid session but are not always allowed to mutate cookies.
  }
}

export async function getAppSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.appSession.findUnique({
    where: { sessionToken },
    include: {
      user: true,
      organization: true,
    },
  });

  if (!session) {
    await tryClearSessionCookie();
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.appSession.delete({
      where: { id: session.id },
    }).catch(() => null);
    await tryClearSessionCookie();
    return null;
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: session.organizationId,
        userId: session.userId,
      },
    },
  });

  if (!membership) {
    await prisma.appSession.deleteMany({
      where: { sessionToken },
    }).catch(() => null);
    await tryClearSessionCookie();
    return null;
  }

  return {
    ...session,
    membership,
  };
}

function assertMembershipRole(session: NonNullable<Awaited<ReturnType<typeof getAppSession>>>, minimumRole: MembershipRole) {
  if (!hasRequiredMembershipRole(session.membership.membershipRole, minimumRole)) {
    throw new Error(`This action requires ${describeMembershipRole(minimumRole)} workspace access.`);
  }
}

export async function requirePageSession(minimumRole: MembershipRole = MembershipRole.VIEWER) {
  const session = await getAppSession();

  if (!session) {
    redirect("/login" as Route);
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, minimumRole)) {
    redirect("/dashboard" as Route);
  }

  return session;
}

export async function requireActionSession(minimumRole: MembershipRole = MembershipRole.MEMBER) {
  const session = await getAppSession();

  if (!session) {
    throw new Error("Authentication required.");
  }

  assertMembershipRole(session, minimumRole);

  return session;
}

export async function createAppSession(userId: string, organizationId: string) {
  const { sessionToken, expiresAt } = await createSessionRecord(userId, organizationId);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, buildSessionCookieOptions(expiresAt));
}

export async function destroyAppSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await prisma.appSession.deleteMany({
      where: { sessionToken },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function revokeSessionRecord(input: {
  sessionId: string;
  organizationId: string;
  userId?: string;
}) {
  await prisma.appSession.deleteMany({
    where: {
      id: input.sessionId,
      organizationId: input.organizationId,
      ...(input.userId ? { userId: input.userId } : {}),
    },
  });
}

export async function revokeOtherSessions(input: {
  currentSessionId: string;
  organizationId: string;
  userId: string;
}) {
  await prisma.appSession.deleteMany({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
      id: {
        not: input.currentSessionId,
      },
    },
  });
}
