import { notFound } from "next/navigation";
import { isGrafanaConfigured } from "@/lib/grafana";
import { listServices } from "@/lib/services";
import { getServiceQueries } from "@/lib/metrics-schema";
import { PRESET_META } from "@/lib/panel-presets";
import { StatCard } from "@/components/stat-card";
import { PanelBoard } from "@/components/panel-board";
import { TimeRangePicker } from "@/components/time-range";

export default async function ServicePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service: raw } = await params;
  const service = decodeURIComponent(raw);

  if (!isGrafanaConfigured()) notFound();

  const services = await listServices();
  if (!services.includes(service)) notFound();

  const sq = await getServiceQueries(service);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="text-lg font-semibold text-ink">{service}</h1>
          <p className="text-sm text-muted">{sq.available.length} metrik yayınlanıyor</p>
        </div>
        <TimeRangePicker />
      </div>

      <div className="flex flex-col gap-8 p-6 sm:p-7">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
            label={PRESET_META.duration_p50.label}
            query={sq.queries.duration_p50 ?? null}
            unit={PRESET_META.duration_p50.unit}
            color="#2a8a66"
            unavailableNote="Gecikme histogramı yok."
          />
          <StatCard
            label={PRESET_META.duration_p95.label}
            query={sq.queries.duration_p95 ?? null}
            unit={PRESET_META.duration_p95.unit}
            color="#2f6fb0"
            unavailableNote="Gecikme histogramı yok."
          />
          <StatCard
            label={PRESET_META.duration_p99.label}
            query={sq.queries.duration_p99 ?? null}
            unit={PRESET_META.duration_p99.unit}
            color="#6a4fb0"
            unavailableNote="Gecikme histogramı yok."
          />
        </div>

        <PanelBoard scope={`service:${service}`} services={[sq]} />
      </div>
    </>
  );
}
