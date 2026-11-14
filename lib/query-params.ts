// Query-string values reach Prometheus/Loki/Tempo (or the demo generator), so
// every numeric/step parameter is clamped here instead of trusted as sent.

export const MAX_MINUTES = 1440; // largest range the UI offers
export const MAX_LIMIT = 500;

// Same shape the UI sends (e.g. "15s", "180s", "1m", "1h").
const STEP_PATTERN = /^(\d{1,5})([smh])$/;
const STEP_UNIT_SECONDS = { s: 1, m: 60, h: 3600 } as const;

function clampInt(raw: string | null | undefined, fallback: number, min: number, max: number) {
  const n = Number(raw);
  // NaN and 0 (also what null/"" parse to) fall back; Infinity clamps to max.
  return Math.min(max, Math.max(min, Math.floor(n) || fallback));
}

export function parseMinutes(raw: string | null | undefined, fallback = 30) {
  return clampInt(raw, fallback, 1, MAX_MINUTES);
}

export function parseLimit(raw: string | null | undefined, fallback: number) {
  return clampInt(raw, fallback, 1, MAX_LIMIT);
}

export function parseStep(raw: string | null | undefined, fallback = "30s") {
  const match = raw ? STEP_PATTERN.exec(raw) : null;
  if (!match) return fallback;
  const seconds = Number(match[1]) * STEP_UNIT_SECONDS[match[2] as keyof typeof STEP_UNIT_SECONDS];
  return seconds >= 1 && seconds <= 86400 ? raw! : fallback;
}
