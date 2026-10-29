// Kept free of "server-only" so auth.ts (also loaded by proxy.ts) can use it.

export function hasGrafanaCredentials() {
  return Boolean(
    process.env.GRAFANA_PROM_URL &&
      process.env.GRAFANA_PROM_USER &&
      process.env.GRAFANA_LOKI_URL &&
      process.env.GRAFANA_LOKI_USER &&
      process.env.GRAFANA_API_TOKEN,
  );
}

/**
 * No Grafana credentials (or CONTROLPANEL_DEMO=1) → demo mode: generated telemetry (lib/demo.ts) and a
 * one-click demo login. This is how the public Vercel deployment runs.
 */
export function isDemoMode() {
  // CONTROLPANEL_DEMO=1 forces the demo even when Grafana credentials are
  // present (e.g. left over in a hosting project's environment).
  return process.env.CONTROLPANEL_DEMO === "1" || !hasGrafanaCredentials();
}
