import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { lokiQuery } from "@/lib/grafana";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const p = req.nextUrl.searchParams;
  const service = p.get("service");
  if (!service) {
    return NextResponse.json({ error: "missing service" }, { status: 400 });
  }

  const level = p.get("level");
  const search = p.get("search")?.trim();

  // Grafana Cloud's OTLP ingestion maps the service.name resource attribute
  // to Loki's `service_name` label.
  let query = `{service_name="${service}"}`;
  if (level && level !== "all") query += ` | severity_text = \`${level.toUpperCase()}\``;
  if (search) query += ` |= \`${search.replace(/`/g, "")}\``;

  try {
    const streams = await lokiQuery(query, {
      minutes: Number(p.get("minutes") ?? "60"),
      limit: Number(p.get("limit") ?? "100"),
    });

    // Flatten streams into a single newest-first list; the label set that
    // produced each line is kept so the viewer can show severity.
    const lines = streams
      .flatMap((s) =>
        s.values.map(([ts, line]) => ({
          timestamp: Number(ts) / 1e6,
          line,
          labels: s.stream,
        })),
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ lines, query });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "log query failed", query },
      { status: 502 },
    );
  }
}
