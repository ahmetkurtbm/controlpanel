import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { promQuery } from "@/lib/grafana";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("query");
  if (!query) {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  try {
    return NextResponse.json(await promQuery(query));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "query failed" },
      { status: 502 },
    );
  }
}
