import { isGateHubConfigured, signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Control Panel</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Bagli uygulamalarin metrik, log ve trace verilerini goruntule.
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
            className="rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            GateHub ile giris yap
          </button>
        </form>
      ) : (
        <p className="max-w-sm text-sm text-red-500">
          GATEHUB_CLIENT_ID / GATEHUB_CLIENT_SECRET ortam degiskenleri henuz
          tanimlanmadi. Once GateHub dashboard&apos;undan bu uygulamayi bir
          OAuth istemcisi olarak kaydet.
        </p>
      )}
    </main>
  );
}
