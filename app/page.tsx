import { LogOut } from "lucide-react";
import { auth, signOut } from "@/auth";
import { isGrafanaConfigured, promQuery } from "@/lib/grafana";
import { Logo } from "@/components/logo";
import { PanelBoard } from "@/components/panel-board";

// Every connected app registers here once — this is the single place that
// needs updating when a new project (receiptflow, testmetrix, ...) starts
// sending telemetry to Grafana Cloud.
const SERVICES = ["gatehub"];

async function ServiceCard({ service }: { service: string }) {
  if (!isGrafanaConfigured()) {
    return (
      <div className="rounded-xl border border-line bg-paper p-4">
        <h2 className="font-medium text-ink">{service}</h2>
        <p className="mt-1 text-sm text-muted">
          Grafana bağlantısı henüz yapılandırılmadı (GRAFANA_PROM_URL / GRAFANA_API_TOKEN).
        </p>
      </div>
    );
  }

  try {
    // span_kind="SPAN_KIND_SERVER" restricts these to inbound requests
    // handled BY this service, excluding its own outbound/client spans
    // (e.g. GateHub's calls to oauth2.googleapis.com).
    const [rate, errors, duration] = await Promise.all([
      promQuery(
        `sum(rate(traces_spanmetrics_calls_total{service="${service}",span_kind="SPAN_KIND_SERVER"}[5m]))`,
      ),
      promQuery(
        `sum(rate(traces_spanmetrics_calls_total{service="${service}",span_kind="SPAN_KIND_SERVER",status_code="STATUS_CODE_ERROR"}[5m]))`,
      ),
      promQuery(
        `histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{service="${service}",span_kind="SPAN_KIND_SERVER"}[5m])) by (le))`,
      ),
    ]);

    const rateValue = rate.data.result[0]?.value?.[1] ?? "0";
    const errorsValue = errors.data.result[0]?.value?.[1] ?? "0";
    const durationValue = duration.data.result[0]?.value?.[1] ?? "0";

    return (
      <div className="rounded-xl border border-line bg-paper p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-ink">{service}</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> canlı
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <dt className="text-xs text-muted">İstek oranı</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">
              {Number(rateValue).toFixed(3)}
              <span className="ml-1 text-xs font-normal text-muted">req/s</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Hata oranı</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">
              {Number(errorsValue).toFixed(3)}
              <span className="ml-1 text-xs font-normal text-muted">req/s</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Gecikme (p95)</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">
              {(Number(durationValue) * 1000).toFixed(0)}
              <span className="ml-1 text-xs font-normal text-muted">ms</span>
            </dd>
          </div>
        </dl>
      </div>
    );
  } catch (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <h2 className="font-medium text-ink">{service}</h2>
        <p className="mt-1 text-sm text-red">
          Sorgu başarısız: {error instanceof Error ? error.message : "bilinmeyen hata"}
        </p>
      </div>
    );
  }
}

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{session?.user?.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:bg-paper hover:text-ink"
            >
              <LogOut size={14} /> Çıkış
            </button>
          </form>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SERVICES.map((service) => (
          <ServiceCard key={service} service={service} />
        ))}
      </section>

      <PanelBoard services={SERVICES} />
    </main>
  );
}
