import Link from "next/link";
import { ArrowRight, ServerCrash } from "lucide-react";
import { isGrafanaConfigured } from "@/lib/grafana";
import { listServices } from "@/lib/services";
import { getAllServiceQueries } from "@/lib/metrics-schema";
import { PRESET_META, type ServiceQueries } from "@/lib/panel-presets";
import { ServiceStatus } from "@/components/service-status";
import { StatCard } from "@/components/stat-card";
import { PanelBoard } from "@/components/panel-board";
import { TimeRangePicker } from "@/components/time-range";

export default async function OverviewPage() {
  if (!isGrafanaConfigured()) {
    return <SetupNotice />;
  }

  let services: string[] = [];
  let error: string | null = null;
  try {
    services = await listServices();
  } catch (e) {
    error = e instanceof Error ? e.message : "Grafana'ya ulaşılamadı";
  }

  if (error) return <ErrorNotice message={error} />;

  const all: ServiceQueries[] = await getAllServiceQueries(services);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="text-lg font-semibold text-ink">Genel bakış</h1>
          <p className="text-sm text-muted">
            {services.length} servis telemetri gönderiyor
          </p>
        </div>
        <TimeRangePicker />
      </div>

      <div className="flex flex-col gap-8 p-6 sm:p-7">
        {all.length === 0 ? (
          <EmptyState />
        ) : (
          all.map((sq) => (
            <section key={sq.service} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold text-ink">{sq.service}</h2>
                  <ServiceStatus query={sq.freshnessQuery} />
                </div>
                <Link
                  href={`/services/${encodeURIComponent(sq.service)}`}
                  className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-brand"
                >
                  Detay <ArrowRight size={13} />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label={PRESET_META.rate.label}
                  query={sq.queries.rate ?? null}
                  unit={PRESET_META.rate.unit}
                  color="#176b4d"
                />
                <StatCard
                  label={PRESET_META.errors.label}
                  query={sq.queries.errors ?? null}
                  unit={PRESET_META.errors.unit}
                  color="#b9473e"
                />
                <StatCard
                  label={PRESET_META.duration_p95.label}
                  query={sq.queries.duration_p95 ?? null}
                  unit={PRESET_META.duration_p95.unit}
                  color="#2f6fb0"
                  unavailableNote="Bu servis için gecikme histogramı yayınlanmıyor."
                />
                <StatCard
                  label={PRESET_META.outbound_rate.label}
                  query={sq.queries.outbound_rate ?? null}
                  unit={PRESET_META.outbound_rate.unit}
                  color="#6a4fb0"
                />
              </div>
            </section>
          ))
        )}

        {all.length > 0 && <PanelBoard scope="overview" services={all} />}
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-paper p-10 text-center">
      <h2 className="text-sm font-medium text-ink">Henüz veri gönderen servis yok</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Bir uygulamayı bağlamak için o projeye <code className="font-mono">@vercel/otel</code>{" "}
        paketini kurup <code className="font-mono">instrumentation.ts</code> dosyasını ekle,
        ardından Vercel&apos;de <code className="font-mono">OTEL_SERVICE_NAME</code> ve OTLP
        endpoint değişkenlerini tanımla. Servis burada otomatik belirir.
      </p>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="p-6 sm:p-7">
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <ServerCrash size={18} className="mt-0.5 shrink-0 text-red" />
        <div>
          <h2 className="text-sm font-medium text-ink">Grafana&apos;ya bağlanılamadı</h2>
          <p className="mt-1 text-sm text-red">{message}</p>
        </div>
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="p-6 sm:p-7">
      <div className="rounded-xl border border-line bg-paper p-6">
        <h2 className="text-sm font-medium text-ink">Grafana bağlantısı yapılandırılmadı</h2>
        <p className="mt-2 text-sm text-muted">
          <code className="font-mono">GRAFANA_PROM_URL</code>,{" "}
          <code className="font-mono">GRAFANA_PROM_USER</code>,{" "}
          <code className="font-mono">GRAFANA_LOKI_URL</code>,{" "}
          <code className="font-mono">GRAFANA_LOKI_USER</code> ve{" "}
          <code className="font-mono">GRAFANA_API_TOKEN</code> ortam değişkenlerini tanımla.
        </p>
      </div>
    </div>
  );
}
