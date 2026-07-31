import { isGrafanaConfigured } from "@/lib/grafana";
import { listServices } from "@/lib/services";
import { getAllServiceQueries } from "@/lib/metrics-schema";
import { PRESET_META, type PresetId } from "@/lib/panel-presets";

// Answers "which metrics are we actually sending and reading?" — the raw
// metric names each service publishes, plus which built-in panels those
// names can support.
export default async function MetricsCatalogPage() {
  if (!isGrafanaConfigured()) {
    return (
      <div className="p-6 sm:p-7">
        <p className="text-sm text-muted">Grafana bağlantısı yapılandırılmadı.</p>
      </div>
    );
  }

  const services = await listServices();
  const all = await getAllServiceQueries(services);
  const presetIds = Object.keys(PRESET_META) as PresetId[];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="text-lg font-semibold text-ink">Metrik kataloğu</h1>
          <p className="text-sm text-muted">
            Her servisin yayınladığı ham metrikler ve desteklenen paneller
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6 sm:p-7">
        {all.map((sq) => (
          <section key={sq.service} className="rounded-xl border border-line bg-paper p-5">
            <h2 className="text-sm font-semibold text-ink">{sq.service}</h2>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Yayınlanan metrikler ({sq.available.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sq.available.length === 0 ? (
                  <p className="text-sm text-muted">Metrik bulunamadı.</p>
                ) : (
                  sq.available.map((m) => (
                    <code
                      key={m}
                      className="rounded border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-ink"
                    >
                      {m}
                    </code>
                  ))
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Paneller
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-muted">
                      <th className="pb-2 pr-4 font-medium">Panel</th>
                      <th className="pb-2 pr-4 font-medium">Birim</th>
                      <th className="pb-2 font-medium">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presetIds.map((id) => {
                      const supported = Boolean(sq.queries[id]);
                      return (
                        <tr key={id} className="border-b border-line/60 last:border-0">
                          <td className="py-2 pr-4 text-ink">{PRESET_META[id].label}</td>
                          <td className="py-2 pr-4 text-muted">{PRESET_META[id].unit}</td>
                          <td className="py-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                supported
                                  ? "bg-brand-soft text-brand"
                                  : "bg-canvas text-muted"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  supported ? "bg-brand" : "bg-muted"
                                }`}
                              />
                              {supported ? "Kullanılabilir" : "Veri yok"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
