"use client";

import { useEffect, useRef, useState, useId } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  hint?: string;
};

/**
 * Replaces the native <select>, whose popup is drawn by the OS and can't be
 * styled to match the rest of the panel. Keeps the keyboard behaviour people
 * expect from a listbox: arrows move, Enter/Space commit, Escape cancels,
 * typing jumps to a matching option.
 */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
  disabled,
  icon,
  className = "",
}: {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  label?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });
  const listboxId = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    setHighlight(selectedIndex);

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => (h + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => (h - 1 + options.length) % options.length);
        break;
      case "Home":
        e.preventDefault();
        setHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(highlight);
        break;
      default: {
        if (e.key.length !== 1) return;
        const now = Date.now();
        const t = typeahead.current;
        t.buffer = now - t.at > 800 ? e.key : t.buffer + e.key;
        t.at = now;
        const match = options.findIndex((o) =>
          o.label.toLowerCase().startsWith(t.buffer.toLowerCase()),
        );
        if (match >= 0) setHighlight(match);
      }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && <span className="mb-1 block text-xs text-muted">{label}</span>}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={`flex w-full items-center gap-2 rounded-lg border bg-paper px-3 py-2 text-left text-sm transition-colors ${
          disabled
            ? "cursor-not-allowed border-line text-muted opacity-50"
            : open
              ? "border-brand text-ink ring-2 ring-brand/15"
              : "border-line text-ink hover:border-brand/40"
        }`}
      >
        {icon && <span className="shrink-0 text-muted">{icon}</span>}
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? "—"}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-1.5 max-h-64 w-full min-w-max overflow-auto rounded-xl border border-line bg-paper p-1 shadow-xl"
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <li
                key={String(option.value)}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setHighlight(i)}
                onClick={() => commit(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${
                  i === highlight ? "bg-brand-soft text-ink" : "text-ink"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.hint && (
                    <span className="block truncate text-[11px] text-muted">{option.hint}</span>
                  )}
                </span>
                {isSelected && <Check size={14} className="shrink-0 text-brand" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
