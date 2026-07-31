import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isGrafanaConfigured } from "@/lib/grafana";
import { evaluateAlerts } from "@/lib/alerts";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isGrafanaConfigured()) {
    return NextResponse.json({ alerts: [] });
  }

  try {
    return NextResponse.json({ alerts: await evaluateAlerts() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "alert evaluation failed" },
      { status: 502 },
    );
  }
}
