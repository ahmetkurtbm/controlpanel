import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { promQueryRange } from "@/lib/grafana";

// Client chart components fetch through this route instead of calling
// Grafana directly, so the Prometheus credentials never reach the browser.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query");
  const minutes = Number(searchParams.get("minutes") ?? "30");
  const step = searchParams.get("step") ?? "30s";

  if (!query) {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  const end = Math.floor(Date.now() / 1000);
  const start = end - Math.max(1, minutes) * 60;

  try {
    const result = await promQueryRange(query, { start, end, step });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "query failed" },
      { status: 502 },
    );
  }
}
