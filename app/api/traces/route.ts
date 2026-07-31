import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isTempoConfigured, tempoSearch } from "@/lib/tempo";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isTempoConfigured()) {
    return NextResponse.json(
      { error: "Tempo yapılandırılmadı (GRAFANA_TEMPO_URL / GRAFANA_TEMPO_USER)" },
      { status: 501 },
    );
  }

  const p = req.nextUrl.searchParams;
  const service = p.get("service");
  if (!service) {
    return NextResponse.json({ error: "missing service" }, { status: 400 });
  }

  try {
    const traces = await tempoSearch({
      service,
      minutes: Number(p.get("minutes") ?? "30"),
      minDurationMs: Number(p.get("minDurationMs") ?? "0") || undefined,
      errorsOnly: p.get("errorsOnly") === "1",
      limit: Number(p.get("limit") ?? "20"),
    });
    return NextResponse.json({ traces });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "search failed" },
      { status: 502 },
    );
  }
}
