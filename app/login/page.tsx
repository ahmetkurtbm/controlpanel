import { Activity, BarChart3, ShieldCheck } from "lucide-react";
import { isGateHubConfigured, signIn } from "@/auth";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-orb login-orb--green" />
      <div className="login-orb login-orb--blue" />

      <div className="login-panel">
        <div className="login-showcase">
          <div>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <Activity size={22} strokeWidth={2.25} />
            </span>
            <h1 className="mt-6 text-2xl font-semibold leading-snug">
              Bağlı uygulamaların nabzını
              <br /> tek ekrandan tut.
            </h1>
            <p className="mt-3 text-sm text-emerald-50/80">
              GateHub'a bağlı tüm uygulamaların istek oranı, hata oranı ve
              gecikme verilerini gerçek zamanlı izle.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-sm text-emerald-50/90">
            <div className="flex items-center gap-2.5">
              <BarChart3 size={16} />
              <span>Grafana Cloud üzerinden canlı metrikler</span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={16} />
              <span>Sadece yetkili hesaplar erişebilir</span>
            </div>
          </div>
        </div>

        <div className="login-form">
          <Logo size="lg" />

          <div>
            <p className="mt-2 text-sm text-muted">
              Devam etmek için GateHub hesabınla giriş yap.
            </p>
          </div>

          {isGateHubConfigured() ? (
            <form
              action={async () => {
                "use server";
                await signIn("gatehub");
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                GateHub ile giriş yap
              </button>
            </form>
          ) : (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              GATEHUB_CLIENT_ID / GATEHUB_CLIENT_SECRET ortam değişkenleri
              henüz tanımlanmadı. Önce GateHub dashboard&apos;undan bu
              uygulamayı bir OAuth istemcisi olarak kaydet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
