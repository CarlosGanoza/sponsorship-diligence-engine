import { NextResponse } from "next/server";
import { MembershipRole } from "@prisma/client";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { env } from "@/lib/db/env";
import { runPendingBackgroundJobs } from "@/lib/jobs/queue";

export const runtime = "nodejs";

function isAuthorized(request: Request, authorizationHeader: string | null) {
  if (!env.jobRunnerToken) {
    return false;
  }

  return authorizationHeader === `Bearer ${env.jobRunnerToken}`;
}

export async function POST(request: Request) {
  const session = await getAppSession();
  const isTokenAuthorized = isAuthorized(request, request.headers.get("authorization"));

  if (!session && !isTokenAuthorized) {
    return NextResponse.json({ error: "Authentication or job runner token required." }, { status: 401 });
  }

  if (session && !isTokenAuthorized && !hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.ADMIN)) {
    return NextResponse.json({ error: "Admin workspace access required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const limitValue = Number(url.searchParams.get("limit") ?? "5");
  const result = await runPendingBackgroundJobs({
    limit: Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 25) : 5,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
