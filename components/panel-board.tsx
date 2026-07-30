"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ChartPanel } from "@/components/chart-panel";
import { CHART_COLORS, PRESETS, type ChartType, type PanelConfig, type PresetId } from "@/lib/panel-presets";

const STORAGE_KEY = "controlpanel:panels:v1";

function defaultPanels(services: string[]): PanelConfig[] {
  return services.flatMap((service, i) => [
    {
      id: `${service}-rate`,
      title: `${service} · İstek oranı`,
      query: PRESETS.rate.query(service),
      color: CHART_COLORS[i % CHART_COLORS.length].value,
      chartType: "area" as ChartType,
      minutes: 30,
    },
    {
      id: `${service}-duration`,
      title: `${service} · Gecikme p95`,
      query: PRESETS.duration_p95.query(service),
      color: CHART_COLORS[(i + 2) % CHART_COLORS.length].value,
      chartType: "line" as ChartType,
      minutes: 30,
    },
  ]);
}

export function PanelBoard({ services }: { services: string[] }) {
  const [panels, setPanels] = useState<PanelConfig[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [service, setService] = useState(services[0] ?? "");
  const [preset, setPreset] = useState<PresetId>("rate");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [color, setColor] = useState<string>(CHART_COLORS[0].value);
  const [minutes, setMinutes] = useState(30);
  const [customQuery, setCustomQuery] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setPanels(JSON.parse(raw));
        return;
      } catch {
        // fall through to defaults
      }
    }
    setPanels(defaultPanels(services));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (panels) localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
  }, [panels]);

  function addPanel() {
    const query = useCustom ? customQuery.trim() : PRESETS[preset].query(service);
    if (!query) return;

    const title = useCustom
      ? "Özel sorgu"
      : `${service} · ${PRESETS[preset].label}`;

    const next: PanelConfig = {
      id: `${Date.now()}`,
      title,
      query,
      color,
      chartType,
      minutes,
    };
    setPanels((prev) => [...(prev ?? []), next]);
    setShowForm(false);
    setUseCustom(false);
    setCustomQuery("");
  }

  function removePanel(id: string) {
    setPanels((prev) => (prev ?? []).filter((p) => p.id !== id));
  }

  if (!panels) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Grafikler</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
        >
          <Plus size={15} /> Panel ekle
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-line bg-paper p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Servis
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="rounded-md border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
              >
                {services.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-muted">
              Metrik
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as PresetId)}
                disabled={useCustom}
                className="rounded-md border border-line bg-canvas px-2 py-1.5 text-sm text-ink disabled:opacity-40"
              >
                {Object.entries(PRESETS).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-muted">
              Grafik türü
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="rounded-md border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
              >
                <option value="line">Çizgi</option>
                <option value="area">Alan</option>
                <option value="bar">Çubuk</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-muted">
              Zaman aralığı
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="rounded-md border border-line bg-canvas px-2 py-1.5 text-sm text-ink"
              >
                <option value={15}>Son 15 dk</option>
                <option value={30}>Son 30 dk</option>
                <option value={60}>Son 1 saat</option>
                <option value={180}>Son 3 saat</option>
                <option value={1440}>Son 24 saat</option>
              </select>
            </label>

            <div className="flex flex-col gap-1 text-xs text-muted">
              Renk
              <div className="flex items-center gap-1.5 pt-1.5">
                {CHART_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    onClick={() => setColor(c.value)}
                    className="h-6 w-6 rounded-full ring-offset-2"
                    style={{
                      backgroundColor: c.value,
                      boxShadow: color === c.value ? `0 0 0 2px ${c.value}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 self-end text-xs text-muted">
              <input
                type="checkbox"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
              />
              Özel PromQL yaz
            </label>
          </div>

          {useCustom && (
            <textarea
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder='örn. sum(rate(traces_spanmetrics_calls_total{service="gatehub"}[5m])) by (span_name)'
              className="mt-3 w-full rounded-md border border-line bg-canvas px-2 py-2 font-mono text-xs text-ink"
              rows={2}
            />
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-canvas"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={addPanel}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Ekle
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {panels.map((p) => (
          <ChartPanel
            key={p.id}
            title={p.title}
            query={p.query}
            color={p.color}
            chartType={p.chartType}
            minutes={p.minutes}
            onRemove={() => removePanel(p.id)}
          />
        ))}
      </div>
    </section>
  );
}
