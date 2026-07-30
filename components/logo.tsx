import { Activity } from "lucide-react";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = {
    sm: { box: "h-7 w-7", icon: 15, text: "text-sm" },
    md: { box: "h-9 w-9", icon: 18, text: "text-base" },
    lg: { box: "h-12 w-12", icon: 24, text: "text-xl" },
  }[size];

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`${dims.box} inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm`}
      >
        <Activity size={dims.icon} strokeWidth={2.25} />
      </span>
      <span className={`${dims.text} font-semibold tracking-tight text-ink`}>
        Control Panel
      </span>
    </div>
  );
}
