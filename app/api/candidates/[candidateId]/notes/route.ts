import { MembershipRole, NoteType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const candidateNoteSchema = z.object({
  noteType: z.nativeEnum(NoteType),
  title: z.string().max(80).optional(),
  content: z.string().min(8).max(600),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ error: "Member workspace access required." }, { status: 403 });
  }

  const { candidateId } = await params;
  const parsed = candidateNoteSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Note details are incomplete." }, { status: 400 });
  }

  const candidate = await prisma.candidate.findFirst({
    where: {
      id: candidateId,
      organizationId: session.organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found in this workspace." }, { status: 404 });
  }

  const note = await prisma.candidateNote.create({
    data: {
      candidateId,
      authorUserId: session.userId,
      noteType: parsed.data.noteType,
      title: parsed.data.title?.trim() || null,
      content: parsed.data.content.trim(),
    },
    select: {
      id: true,
      title: true,
    },
  });

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/dashboard");

  return NextResponse.json({ success: true, note });
}
