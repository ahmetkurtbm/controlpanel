import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { isGrafanaConfigured } from "@/lib/grafana";
import { evaluateAlerts, THRESHOLDS, type Alert } from "@/lib/alerts";

export default async function AlertsPage() {
  if (!isGrafanaConfigured()) {
    return (
      <div className="p-6 sm:p-7">
        <p className="text-sm text-muted">Grafana bağlantısı yapılandırılmadı.</p>
      </div>
    );
  }

  let alerts: Alert[] = [];
  let error: string | null = null;
  try {
    alerts = await evaluateAlerts();
  } catch (e) {
    error = e instanceof Error ? e.message : "Uyarılar hesaplanamadı";
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="text-lg font-semibold text-ink">Uyarılar</h1>
          <p className="text-sm text-muted">
            {error ? "Hesaplanamadı" : `${alerts.length} aktif uyarı`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6 sm:p-7">
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red">{error}</p>
        ) : alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-6">
            <CheckCircle2 size={20} className="text-brand" />
            <div>
              <p className="text-sm font-medium text-ink">Her şey yolunda</p>
              <p className="text-sm text-muted">Eşikleri aşan bir servis yok.</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                  a.severity === "critical"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <AlertTriangle
                  size={18}
                  className={`mt-0.5 shrink-0 ${a.severity === "critical" ? "text-red" : "text-amber"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{a.title}</p>
                    <Link
                      href={`/services/${encodeURIComponent(a.service)}`}
                      className="rounded-full bg-paper px-2 py-0.5 text-xs text-muted hover:text-brand"
                    >
                      {a.service}
                    </Link>
                  </div>
                  <p className="mt-1 text-sm text-muted">{a.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="rounded-xl border border-line bg-paper p-5">
          <h2 className="text-sm font-semibold text-ink">Eşikler</h2>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm sm:max-w-md">
            <dt className="text-muted">Hata oranı — uyarı</dt>
            <dd className="text-ink">%{(THRESHOLDS.errorRatioWarning * 100).toFixed(0)}</dd>
            <dt className="text-muted">Hata oranı — kritik</dt>
            <dd className="text-ink">%{(THRESHOLDS.errorRatioCritical * 100).toFixed(0)}</dd>
            <dt className="text-muted">p95 gecikme — uyarı</dt>
            <dd className="text-ink">{THRESHOLDS.latencyWarningMs} ms</dd>
            <dt className="text-muted">p95 gecikme — kritik</dt>
            <dd className="text-ink">{THRESHOLDS.latencyCriticalMs} ms</dd>
            <dt className="text-muted">Sessizlik — uyarı</dt>
            <dd className="text-ink">{THRESHOLDS.silenceWarningSeconds / 3600} saat</dd>
            <dt className="text-muted">Sessizlik — kritik</dt>
            <dd className="text-ink">{THRESHOLDS.silenceCriticalSeconds / 3600} saat</dd>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Bu sayfa anlık durumu gösterir. Telefonuna bildirim gelmesi için Grafana Cloud
            &rsaquo; Alerting bölümünden aynı eşiklerle bir kural tanımlayıp Telegram veya
            e-posta kanalı bağlaman gerekir.
          </p>
        </section>
      </div>
    </>
  );
}
