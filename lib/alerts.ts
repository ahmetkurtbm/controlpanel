import "server-only";
import { promQuery } from "@/lib/grafana";
import { getAllServiceQueries } from "@/lib/metrics-schema";
import { listServices } from "@/lib/services";

// Thresholds are evaluated here rather than in Grafana so the panel can show
// current health without a second system to configure. Grafana alert rules
// are still the right place for *notifications* (see README) — this is the
// "what's wrong right now" view.
export const THRESHOLDS = {
  /** Share of requests erroring, 0–1. */
  errorRatioWarning: 0.02,
  errorRatioCritical: 0.1,
  /** p95 latency in milliseconds. */
  latencyWarningMs: 1500,
  latencyCriticalMs: 4000,
  /** Seconds since the service last reported anything. */
  silenceWarningSeconds: 3 * 3600,
  silenceCriticalSeconds: 24 * 3600,
};

export type Severity = "warning" | "critical";

export type Alert = {
  id: string;
  service: string;
  severity: Severity;
  title: string;
  detail: string;
};

async function scalar(query: string): Promise<number | null> {
  try {
    const res = await promQuery(query);
    const raw = res.data.result[0]?.value?.[1];
    if (raw === undefined) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export async function evaluateAlerts(): Promise<Alert[]> {
  const services = await listServices();
  const all = await getAllServiceQueries(services);
  const alerts: Alert[] = [];

  await Promise.all(
    all.map(async (sq) => {
      const [total, errors, p95, silence] = await Promise.all([
        sq.queries.rate ? scalar(sq.queries.rate) : null,
        sq.queries.errors ? scalar(sq.queries.errors) : null,
        sq.queries.duration_p95 ? scalar(sq.queries.duration_p95) : null,
        scalar(sq.freshnessQuery),
      ]);

      // An error ratio needs traffic to be meaningful: 1 error out of 1
      // request is 100% but not worth waking anyone over.
      if (total !== null && errors !== null && total > 0.01) {
        const ratio = errors / total;
        if (ratio >= THRESHOLDS.errorRatioCritical || ratio >= THRESHOLDS.errorRatioWarning) {
          alerts.push({
            id: `${sq.service}:errors`,
            service: sq.service,
            severity: ratio >= THRESHOLDS.errorRatioCritical ? "critical" : "warning",
            title: "Yüksek hata oranı",
            detail: `İsteklerin %${(ratio * 100).toFixed(1)}'i hata ile sonuçlanıyor.`,
          });
        }
      }

      if (p95 !== null && p95 >= THRESHOLDS.latencyWarningMs) {
        alerts.push({
          id: `${sq.service}:latency`,
          service: sq.service,
          severity: p95 >= THRESHOLDS.latencyCriticalMs ? "critical" : "warning",
          title: "Yavaş yanıt süresi",
          detail: `p95 gecikme ${Math.round(p95)} ms.`,
        });
      }

      // No samples at all in 24h reads as null here, which is the most
      // severe case — the service has gone completely quiet.
      if (silence === null || silence >= THRESHOLDS.silenceWarningSeconds) {
        const seconds = silence ?? THRESHOLDS.silenceCriticalSeconds;
        alerts.push({
          id: `${sq.service}:silent`,
          service: sq.service,
          severity: seconds >= THRESHOLDS.silenceCriticalSeconds ? "critical" : "warning",
          title: "Veri gelmiyor",
          detail:
            silence === null
              ? "Son 24 saattir hiç telemetri alınmadı."
              : `Son veri ${Math.round(seconds / 3600)} saat önce alındı.`,
        });
      }
    }),
  );

  const order: Record<Severity, number> = { critical: 0, warning: 1 };
  return alerts.sort(
    (a, b) => order[a.severity] - order[b.severity] || a.service.localeCompare(b.service),
  );
}
