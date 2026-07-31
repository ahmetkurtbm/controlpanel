import "server-only";
import { promLabelValues } from "@/lib/grafana";

// Services are discovered from the telemetry itself rather than kept in a
// hardcoded list: any app that starts pushing OTLP data with a new
// `service.name` shows up here automatically, so connecting a new project
// needs no change to this codebase.
export async function listServices(): Promise<string[]> {
  const values = await promLabelValues("service", "{__name__=~\"traces_spanmetrics.*\"}");
  return values.filter(Boolean).sort();
}
