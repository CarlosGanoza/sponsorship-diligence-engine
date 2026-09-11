import { NextResponse } from "next/server";

import { buildSessionCookieOptions, createSessionRecord, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  if (process.env.PLAYWRIGHT !== "1") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
  };

  const membership = await prisma.organizationMembership.findFirst({
    where: body.email
      ? {
          user: {
            email: body.email,
          },
        }
      : undefined,
    include: {
      user: true,
    },
    orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
  });

  if (!membership) {
    return NextResponse.json({ error: "No demo membership found." }, { status: 404 });
  }

  const { sessionToken, expiresAt } = await createSessionRecord(membership.userId, membership.organizationId);
  const response = NextResponse.json({
    ok: true,
    email: membership.user.email,
    sessionToken,
    expiresAt: expiresAt.toISOString(),
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, buildSessionCookieOptions(expiresAt));

  return response;
}

export async function GET(request: Request) {
  if (process.env.PLAYWRIGHT !== "1") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email") ?? undefined;
  const membership = await prisma.organizationMembership.findFirst({
    where: email
      ? {
          user: {
            email,
          },
        }
      : undefined,
    include: {
      user: true,
    },
    orderBy: [{ membershipRole: "asc" }, { createdAt: "asc" }],
  });

  if (!membership) {
    return NextResponse.json({ error: "No demo membership found." }, { status: 404 });
  }

  const { sessionToken, expiresAt } = await createSessionRecord(membership.userId, membership.organizationId);
  const response = NextResponse.redirect(new URL("/dashboard", request.url));

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, buildSessionCookieOptions(expiresAt));

  return response;
}
