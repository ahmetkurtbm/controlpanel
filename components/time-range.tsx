"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { RefreshCw, Clock } from "lucide-react";
import { Select } from "@/components/ui/select";

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
      <Select
        value={minutes}
        onChange={setMinutes}
        icon={<Clock size={14} />}
        className="w-40"
        options={TIME_RANGES.map((r) => ({ value: r.minutes, label: r.label }))}
      />
      <button
        type="button"
        onClick={refresh}
        title="Yenile"
        className="rounded-lg border border-line bg-paper p-2.5 text-muted transition-colors hover:border-brand/40 hover:text-ink"
      >
        <RefreshCw size={14} />
      </button>
    </div>
  );
}
