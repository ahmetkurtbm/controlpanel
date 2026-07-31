"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { RefreshCw, Clock } from "lucide-react";

export const TIME_RANGES = [
  { minutes: 15, label: "Son 15 dk" },
  { minutes: 30, label: "Son 30 dk" },
  { minutes: 60, label: "Son 1 saat" },
  { minutes: 180, label: "Son 3 saat" },
  { minutes: 720, label: "Son 12 saat" },
  { minutes: 1440, label: "Son 24 saat" },
] as const;

type TimeRangeValue = {
  minutes: number;
  setMinutes: (m: number) => void;
  /** Bumped on manual refresh so charts can re-fetch without changing range. */
  nonce: number;
  refresh: () => void;
};

const TimeRangeContext = createContext<TimeRangeValue | null>(null);

export function TimeRangeProvider({ children }: { children: React.ReactNode }) {
  const [minutes, setMinutes] = useState(30);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return (
    <TimeRangeContext.Provider value={{ minutes, setMinutes, nonce, refresh }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  const ctx = useContext(TimeRangeContext);
  if (!ctx) throw new Error("useTimeRange must be used inside TimeRangeProvider");
  return ctx;
}

export function TimeRangePicker() {
  const { minutes, setMinutes, refresh } = useTimeRange();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5">
        <Clock size={14} className="text-muted" />
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="bg-transparent text-sm text-ink outline-none"
        >
          {TIME_RANGES.map((r) => (
            <option key={r.minutes} value={r.minutes}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={refresh}
        title="Yenile"
        className="rounded-lg border border-line bg-paper p-2 text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <RefreshCw size={14} />
      </button>
    </div>
  );
}
