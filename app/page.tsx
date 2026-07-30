import { auth, signOut } from "@/auth";
import { isGrafanaConfigured, promQuery } from "@/lib/grafana";

// Every connected app registers here once — this is the single place that
// needs updating when a new project (receiptflow, testmetrix, ...) starts
// sending telemetry to Grafana Cloud.
const SERVICES = ["gatehub"];

async function ServiceCard({ service }: { service: string }) {
  if (!isGrafanaConfigured()) {
    return (
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="font-medium">{service}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Grafana baglantisi henuz yapilandirilmadi (GRAFANA_PROM_URL / GRAFANA_API_TOKEN).
        </p>
      </div>
    );
  }

  try {
    const [rate, errors, duration] = await Promise.all([
      promQuery(`sum(rate(traces_spanmetrics_calls_total{service_name="${service}"}[5m]))`),
      promQuery(
        `sum(rate(traces_spanmetrics_calls_total{service_name="${service}",status_code="STATUS_CODE_ERROR"}[5m]))`,
      ),
      promQuery(
        `histogram_quantile(0.95, sum(rate(traces_spanmetrics_latency_bucket{service_name="${service}"}[5m])) by (le))`,
      ),
    ]);

    const rateValue = rate.data.result[0]?.value?.[1] ?? "0";
    const errorsValue = errors.data.result[0]?.value?.[1] ?? "0";
    const durationValue = duration.data.result[0]?.value?.[1] ?? "0";

    return (
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="font-medium">{service}</h2>
        <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Rate</dt>
            <dd className="text-lg font-semibold">{Number(rateValue).toFixed(3)} req/s</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Errors</dt>
            <dd className="text-lg font-semibold">{Number(errorsValue).toFixed(3)} req/s</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Duration (p95)</dt>
            <dd className="text-lg font-semibold">{(Number(durationValue) * 1000).toFixed(0)} ms</dd>
          </div>
        </dl>
      </div>
    );
  } catch (error) {
    return (
      <div className="rounded-lg border border-red-200 p-4 dark:border-red-900">
        <h2 className="font-medium">{service}</h2>
        <p className="mt-1 text-sm text-red-500">
          Sorgu basarisiz: {error instanceof Error ? error.message : "bilinmeyen hata"}
        </p>
      </div>
    );
  }
}

export default async function Home() {
  const session = await auth();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Control Panel</h1>
          <p className="text-sm text-neutral-500">{session?.user?.email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button type="submit" className="text-sm text-neutral-500 hover:underline">
            Cikis yap
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-4">
        {SERVICES.map((service) => (
          <ServiceCard key={service} service={service} />
        ))}
      </section>
    </main>
  );
}
