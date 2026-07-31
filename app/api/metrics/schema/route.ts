import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getServiceSchema } from "@/lib/metrics-schema";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = req.nextUrl.searchParams.get("service");
  if (!service) {
    return NextResponse.json({ error: "missing service" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getServiceSchema(service));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "schema lookup failed" },
      { status: 502 },
    );
  }
}
