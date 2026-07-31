"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

type Alert = { id: string; severity: "warning" | "critical" };

/** Sidebar indicator so problems surface without opening the alerts page. */
export function AlertBadge() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/alerts", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setAlerts(json.alerts ?? []);
      } catch {
        // Badge is informational; a failed poll just leaves it as-is.
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (alerts.length === 0) return null;

  const critical = alerts.filter((a) => a.severity === "critical").length;

  return (
    <Link
      href="/alerts"
      className={`mx-3 mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
        critical > 0 ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-200"
      }`}
    >
      <BellRing size={14} />
      {alerts.length} aktif uyarı
    </Link>
  );
}
