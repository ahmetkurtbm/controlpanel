"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Download, Upload } from "lucide-react";
import { ChartPanel } from "@/components/chart-panel";
import { Select } from "@/components/ui/select";
import {
  CHART_COLORS,
  PRESET_META,
  type ChartType,
  type PanelConfig,
  type PresetId,
  type ServiceQueries,
} from "@/lib/panel-presets";

function storageKey(scope: string) {
  return `controlpanel:panels:v2:${scope}`;
}

function defaultPanels(all: ServiceQueries[]): PanelConfig[] {
  const seeds: Array<{ preset: PresetId; chartType: ChartType; colorOffset: number }> = [
    { preset: "rate", chartType: "area", colorOffset: 0 },
    { preset: "duration_p95", chartType: "line", colorOffset: 2 },
    { preset: "errors", chartType: "bar", colorOffset: 4 },
    { preset: "rate_by_route", chartType: "line", colorOffset: 1 },
  ];

  return all.flatMap((sq, si) =>
    seeds
      .filter((s) => sq.queries[s.preset])
      .map((s) => ({
        id: `${sq.service}-${s.preset}`,
        title: `${sq.service} · ${PRESET_META[s.preset].label}`,
        query: sq.queries[s.preset]!,
        color: CHART_COLORS[(si + s.colorOffset) % CHART_COLORS.length].value,
        chartType: s.chartType,
        unit: PRESET_META[s.preset].unit,
      })),
  );
}

export function PanelBoard({
  scope,
  services,
}: {
  /** Namespaces saved layouts so the overview and each service page differ. */
  scope: string;
  services: ServiceQueries[];
}) {
  const [panels, setPanels] = useState<PanelConfig[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [service, setService] = useState(services[0]?.service ?? "");
  const [preset, setPreset] = useState<PresetId>("rate");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [color, setColor] = useState<string>(CHART_COLORS[0].value);
  const [customQuery, setCustomQuery] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(scope));
    if (raw) {
      try {
        setPanels(JSON.parse(raw));
        return;
      } catch {
        // corrupt entry — fall through to defaults
      }
    }
    setPanels(defaultPanels(services));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    if (panels) localStorage.setItem(storageKey(scope), JSON.stringify(panels));
  }, [panels, scope]);

  const selected = services.find((s) => s.service === service);
  const availablePresets = (Object.keys(PRESET_META) as PresetId[]).filter(
    (id) => selected?.queries[id],
  );

  function addPanel() {
    const query = useCustom ? customQuery.trim() : selected?.queries[preset];
    if (!query) return;

    setPanels((prev) => [
      ...(prev ?? []),
      {
        id: `${Date.now()}`,
        title: useCustom ? "Özel sorgu" : `${service} · ${PRESET_META[preset].label}`,
        query,
        color,
        chartType,
        unit: useCustom ? undefined : PRESET_META[preset].unit,
      },
    ]);
    setShowForm(false);
    setUseCustom(false);
    setCustomQuery("");
  }

  function resetPanels() {
    setPanels(defaultPanels(services));
  }

  // Layouts live in localStorage (no database in this app), so export/import
  // is how a dashboard moves to another browser or machine.
  function exportPanels() {
    const blob = new Blob([JSON.stringify(panels ?? [], null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `controlpanel-${scope.replace(/[^a-z0-9]+/gi, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importPanels(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error("Dosya bir panel listesi içermiyor.");
      const valid = parsed.filter(
        (p): p is PanelConfig => typeof p?.query === "string" && typeof p?.title === "string",
      );
      if (valid.length === 0) throw new Error("Dosyada geçerli panel bulunamadı.");
      setPanels(valid);
      setImportError(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Dosya okunamadı.");
    }
  }

  if (!panels) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Grafikler</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportPanels}
            title="Panelleri dosyaya aktar"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <Download size={15} />
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            title="Panelleri dosyadan yükle"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <Upload size={15} />
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importPanels(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={resetPanels}
            className="rounded-lg px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            Varsayılana dön
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            <Plus size={15} /> Panel ekle
          </button>
        </div>
      </div>

      {importError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red">
          {importError}
        </p>
      )}

      {showForm && (
        <div className="rounded-xl border border-line bg-paper p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink">Yeni panel</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md p-1 text-muted hover:bg-canvas hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Servis"
              value={service}
              onChange={setService}
              options={services.map((s) => ({ value: s.service, label: s.service }))}
            />

            <Select
              label="Metrik"
              value={preset}
              onChange={setPreset}
              disabled={useCustom}
              options={availablePresets.map((id) => ({
                value: id,
                label: PRESET_META[id].label,
                hint: PRESET_META[id].unit,
              }))}
            />

            <Select
              label="Grafik türü"
              value={chartType}
              onChange={setChartType}
              options={[
                { value: "area", label: "Alan" },
                { value: "line", label: "Çizgi" },
                { value: "bar", label: "Çubuk" },
              ]}
            />

            <div>
              <span className="mb-1 block text-xs text-muted">Renk</span>
              <div className="flex h-[38px] items-center gap-2">
                {CHART_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.name}
                    onClick={() => setColor(c.value)}
                    className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c.value,
                      outline: color === c.value ? `2px solid ${c.value}` : undefined,
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--green)]"
            />
            Özel PromQL yaz
          </label>

          {useCustom && (
            <>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder={`örn. sum(rate(traces_spanmetrics_calls_total{service="${service}"}[5m])) by (span_name)`}
                className="mt-2 w-full rounded-md border border-line bg-canvas px-2 py-2 font-mono text-xs text-ink"
                rows={2}
              />
              {selected && selected.available.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted">
                    {service} için yayınlanan metrikler ({selected.available.length})
                  </summary>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selected.available.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCustomQuery((q) => q + m)}
                        className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-muted hover:text-ink"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          <div className="mt-4 flex justify-end gap-2">
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
              className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Ekle
            </button>
          </div>
        </div>
      )}

      {panels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-sm text-muted">Henüz panel yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {panels.map((p) => (
            <ChartPanel
              key={p.id}
              title={p.title}
              query={p.query}
              color={p.color}
              chartType={p.chartType}
              unit={p.unit}
              onRemove={() => setPanels((prev) => (prev ?? []).filter((x) => x.id !== p.id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
