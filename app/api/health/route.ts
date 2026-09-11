import { NextResponse } from "next/server";

import { getDeploymentHealthSnapshot } from "@/lib/runtime/health";

export async function GET() {
  const snapshot = await getDeploymentHealthSnapshot();

  return NextResponse.json(snapshot, {
    status: snapshot.status === "down" ? 503 : 200,
  });
}
