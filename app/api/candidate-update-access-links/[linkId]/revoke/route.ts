import { CandidateUpdateAccessLinkStatus, MembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const { linkId } = await params;
  const link = await prisma.candidateUpdateAccessLink.findFirst({
    where: {
      id: linkId,
      candidate: {
        organizationId: session.organizationId,
      },
    },
    select: {
      id: true,
      candidateId: true,
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Secure intake link not found." }, { status: 404 });
  }

  await prisma.candidateUpdateAccessLink.update({
    where: { id: link.id },
    data: {
      status: CandidateUpdateAccessLinkStatus.REVOKED,
    },
  });

  revalidatePath(`/candidates/${link.candidateId}`);
  revalidatePath("/tasks");

  return NextResponse.json({ success: true });
}
