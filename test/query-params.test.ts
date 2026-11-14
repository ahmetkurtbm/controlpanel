import { describe, expect, it } from "vitest";
import { parseLimit, parseMinutes, parseStep } from "@/lib/query-params";
import { isSignInAllowed } from "@/lib/auth-rules";
import { MAX_DEMO_POINTS, demoQueryRange } from "@/lib/demo";

describe("parseMinutes", () => {
  it("geçerli değeri korur, boşta varsayılanı kullanır", () => {
    expect(parseMinutes("60")).toBe(60);
    expect(parseMinutes(null)).toBe(30);
    expect(parseMinutes(null, 60)).toBe(60);
  });

  it.each([
    ["NaN", "abc", 30],
    ["Infinity", "Infinity", 1440],
    ["negatif", "-5", 1],
    ["sıfır", "0", 30],
    ["çok büyük", "100000000", 1440],
  ])("%s değerini sınırlar", (_name, raw, expected) => {
    expect(parseMinutes(raw)).toBe(expected);
  });
});

describe("parseLimit", () => {
  it("en fazla 500 döner", () => {
    expect(parseLimit("100", 20)).toBe(100);
    expect(parseLimit("99999", 20)).toBe(500);
    expect(parseLimit("-1", 20)).toBe(1);
    expect(parseLimit("x", 20)).toBe(20);
    expect(parseLimit("Infinity", 20)).toBe(500);
  });
});

describe("parseStep", () => {
  it.each(["15s", "30s", "180s", "1m", "5m", "15m", "1h"])("%s kabul edilir", (step) => {
    expect(parseStep(step)).toBe(step);
  });

  it.each(["", "abc", "0s", "-1m", "1d", "15", "1e9s", "999999s", "15s;drop", "100000h"])(
    "geçersiz %j varsayılana düşer",
    (step) => {
      expect(parseStep(step)).toBe("30s");
    },
  );

  it("null için varsayılanı döner", () => {
    expect(parseStep(null)).toBe("30s");
    expect(parseStep(null, "1m")).toBe("1m");
  });
});

describe("demoQueryRange", () => {
  it("çok büyük aralıkta seri başına nokta sayısını sınırlar", () => {
    const end = 1_700_000_000;
    const result = demoQueryRange('rate(x{service="receiptflow"}[1m])', { start: end - 1440 * 60 * 1000, end, step: "15s" });
    for (const series of result.data.result) {
      expect(series.values!.length).toBeLessThanOrEqual(MAX_DEMO_POINTS);
      expect(series.values!.length).toBeGreaterThan(1);
    }
  });

  it("makul aralıkta istenen adımı korur", () => {
    const end = 1_700_000_000;
    const result = demoQueryRange('rate(x{service="receiptflow"}[1m])', { start: end - 1800, end, step: "30s" });
    expect(result.data.result[0].values).toHaveLength(61);
  });

  it("sonsuz aralıkta takılmaz", () => {
    const result = demoQueryRange('x{service="receiptflow"}', { start: 0, end: Infinity, step: "30s" });
    expect(result.data.result[0].values!.length).toBeLessThanOrEqual(MAX_DEMO_POINTS);
  });
});

describe("isSignInAllowed", () => {
  const allowed = ["admin@example.com"];

  it("allowlist'teki adrese izin verir (büyük/küçük harf fark etmez)", () => {
    expect(isSignInAllowed("Admin@Example.com", allowed)).toBe(true);
  });

  it("allowlist dışını ve boş adresi reddeder", () => {
    expect(isSignInAllowed("x@example.com", allowed)).toBe(false);
    expect(isSignInAllowed(undefined, allowed)).toBe(false);
    expect(isSignInAllowed("admin@example.com", [])).toBe(false);
  });

  it("email_verified açıkça false ise reddeder", () => {
    expect(isSignInAllowed("admin@example.com", allowed, false)).toBe(false);
  });

  it("email_verified true veya yoksa reddetmez", () => {
    expect(isSignInAllowed("admin@example.com", allowed, true)).toBe(true);
    expect(isSignInAllowed("admin@example.com", allowed, undefined)).toBe(true);
  });
});
