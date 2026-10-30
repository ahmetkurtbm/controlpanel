import { beforeEach, describe, expect, it, vi } from "vitest";

const values = vi.hoisted(() => new Map<string, number | Error | null>());

vi.mock("@/lib/grafana", () => ({
  promQuery: vi.fn(async (query: string) => {
    const value = values.get(query);
    if (value instanceof Error) throw value;
    return { data: { result: value == null ? [] : [{ value: [0, String(value)] }] } };
  }),
}));
vi.mock("@/lib/services", () => ({ listServices: vi.fn(async () => ["app"]) }));
vi.mock("@/lib/metrics-schema", () => ({
  getAllServiceQueries: vi.fn(async (services: string[]) =>
    services.map((service) => ({
      service,
      available: [],
      freshnessQuery: "fresh",
      queries: { rate: "rate", errors: "errors", duration_p95: "p95" },
    })),
  ),
}));

import { evaluateAlerts } from "@/lib/alerts";
import { listServices } from "@/lib/services";

function metrics(overrides: { rate?: number | null; errors?: number | null; p95?: number | null; fresh?: number | null } = {}) {
  values.clear();
  const merged = { rate: 1, errors: 0, p95: 100, fresh: 60, ...overrides };
  for (const [key, value] of Object.entries(merged)) values.set(key, value);
}

beforeEach(() => {
  vi.mocked(listServices).mockResolvedValue(["app"]);
});

describe("evaluateAlerts", () => {
  it("sağlıklı serviste uyarı üretmez", async () => {
    metrics();
    expect(await evaluateAlerts()).toEqual([]);
  });

  it.each([
    [0.01, null],
    [0.02, "warning"],
    [0.09, "warning"],
    [0.1, "critical"],
  ])("hata oranı %f için önem derecesi %s", async (errors, severity) => {
    metrics({ errors });
    const alert = (await evaluateAlerts()).find((a) => a.id === "app:errors");
    expect(alert?.severity ?? null).toBe(severity);
  });

  it("trafik çok azken hata oranını yok sayar", async () => {
    metrics({ rate: 0.01, errors: 0.01 });
    expect(await evaluateAlerts()).toEqual([]);
  });

  it.each([
    [1499, null],
    [1500, "warning"],
    [4000, "critical"],
  ])("p95 %i ms için önem derecesi %s", async (p95, severity) => {
    metrics({ p95 });
    const alert = (await evaluateAlerts()).find((a) => a.id === "app:latency");
    expect(alert?.severity ?? null).toBe(severity);
  });

  it("24 saat veri yoksa kritik sayar", async () => {
    metrics({ fresh: null });
    const [alert] = await evaluateAlerts();
    expect(alert).toMatchObject({ id: "app:silent", severity: "critical" });
    expect(alert.detail).toContain("24 saattir");
  });

  it("3 saatlik sessizlikte uyarı verir", async () => {
    metrics({ fresh: 3 * 3600 });
    const [alert] = await evaluateAlerts();
    expect(alert).toMatchObject({ id: "app:silent", severity: "warning" });
    expect(alert.detail).toContain("3 saat önce");
  });

  it("Prometheus hatasını veri yok gibi ele alır, panoyu düşürmez", async () => {
    metrics({ fresh: 60, p95: null });
    values.set("rate", new Error("zaman aşımı"));
    expect(await evaluateAlerts()).toEqual([]);
  });

  it("kritikleri önce, sonra servis adına göre sıralar", async () => {
    vi.mocked(listServices).mockResolvedValue(["b", "a"]);
    metrics({ p95: 1600, errors: 0.5 });
    const alerts = await evaluateAlerts();
    expect(alerts.map((a) => a.id)).toEqual(["a:errors", "b:errors", "a:latency", "b:latency"]);
  });
});
