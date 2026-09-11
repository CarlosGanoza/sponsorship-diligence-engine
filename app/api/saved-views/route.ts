import { MembershipRole, SavedViewPage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppSession, hasRequiredMembershipRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { normalizeSavedViewQueryString } from "@/lib/saved-views";

const savedViewSchema = z.object({
  page: z.nativeEnum(SavedViewPage),
  title: z.string().min(3).max(60),
  description: z.string().max(140).optional(),
  queryString: z.string().max(600),
});

function revalidateSavedViewPage(page: SavedViewPage) {
  if (page === SavedViewPage.CANDIDATES) {
    revalidatePath("/candidates");
    return;
  }

  if (page === SavedViewPage.TASKS) {
    revalidatePath("/tasks");
    return;
  }

  if (page === SavedViewPage.PIPELINE) {
    revalidatePath("/pipeline");
    return;
  }

  if (page === SavedViewPage.ALERTS) {
    revalidatePath("/alerts");
  }
}

export async function POST(request: Request) {
  const session = await getAppSession();

  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  if (!hasRequiredMembershipRole(session.membership.membershipRole, MembershipRole.MEMBER)) {
    return NextResponse.json({ success: false, error: "Member workspace access required." }, { status: 403 });
  }

  const parsed = savedViewSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Saved queue details are incomplete." }, { status: 400 });
  }

  const queryString = normalizeSavedViewQueryString(parsed.data.queryString);

  if (!queryString) {
    return NextResponse.json({ success: false, error: "Apply at least one filter before saving a queue." }, { status: 400 });
  }

  const savedView = await prisma.savedView.create({
    data: {
      organizationId: session.organizationId,
      createdById: session.user.id,
      page: parsed.data.page,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() || null,
      queryString,
    },
    select: {
      id: true,
    },
  });

  revalidateSavedViewPage(parsed.data.page);

  return NextResponse.json({ success: true, savedViewId: savedView.id, queryString });
}
