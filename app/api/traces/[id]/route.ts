import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isTempoConfigured, tempoTrace } from "@/lib/tempo";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isTempoConfigured()) {
    return NextResponse.json({ error: "Tempo yapılandırılmadı" }, { status: 501 });
  }

  const { id } = await params;

  try {
    return NextResponse.json({ spans: await tempoTrace(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "trace fetch failed" },
      { status: 502 },
    );
  }
}
