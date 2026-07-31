"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, Boxes, LogOut, CircleDot, BellRing } from "lucide-react";
import { AlertBadge } from "@/components/alert-badge";

export function Sidebar({
  services,
  userEmail,
  signOutAction,
}: {
  services: string[];
  userEmail?: string | null;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
          <Activity size={18} strokeWidth={2.25} />
        </span>
        <span className="text-base font-semibold tracking-tight text-white">Control Panel</span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <NavItem href="/" icon={<LayoutDashboard size={16} />} active={pathname === "/"}>
            Genel bakış
          </NavItem>
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">
            Servisler
          </p>
          {services.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/40">Henüz veri gönderen servis yok.</p>
          ) : (
            services.map((service) => (
              <NavItem
                key={service}
                href={`/services/${encodeURIComponent(service)}`}
                icon={<CircleDot size={16} />}
                active={pathname === `/services/${encodeURIComponent(service)}`}
              >
                {service}
              </NavItem>
            ))
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">
            Yönetim
          </p>
          <NavItem href="/alerts" icon={<BellRing size={16} />} active={pathname === "/alerts"}>
            Uyarılar
          </NavItem>
          <NavItem href="/metrics" icon={<Boxes size={16} />} active={pathname === "/metrics"}>
            Metrik kataloğu
          </NavItem>
        </div>
      </nav>

      <AlertBadge />

      <div className="border-t border-white/10 px-3 py-3">
        <p className="truncate px-3 pb-2 text-xs text-white/50">{userEmail}</p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} /> Çıkış yap
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-[#25553f] font-medium text-white"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </Link>
  );
}
