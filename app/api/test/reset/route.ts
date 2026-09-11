import { NextResponse } from "next/server";

import { resetAndSeedDemo } from "@/lib/seed/run-seed";

export async function POST() {
  if (process.env.PLAYWRIGHT !== "1") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await resetAndSeedDemo();

  return NextResponse.json({ ok: true });
}
