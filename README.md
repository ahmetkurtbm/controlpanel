# Control Panel

GateHub'a bagli tum uygulamalarin (gatehub, ileride receiptflow, testmetrix, ...)
metrik/log/trace verisini tek bir yerden izlemek icin kisiye ozel bir panel.

- **Giris**: Grafana Cloud'a degil, **GateHub'a** giris yapilir (bu uygulama
  GateHub'a kayitli bir OAuth istemcisi). Sadece `ADMIN_EMAILS` listesindeki
  adresler icine girebilir.
- **Veri**: Grafana Cloud'un ucretsiz tier'inda barinan Prometheus (Mimir) ve
  Loki'ye, sunucu tarafinda, salt-okunur bir Service Account token'i ile
  sorgu atilir (`lib/grafana.ts`). Kimse Grafana'nin kendi arayuzune girmez.

## Kurulum

1. GateHub'da (`/dashboard` > "Yeni uygulama") bu uygulamayi bir OAuth
   istemcisi olarak kaydet, redirect URI: `http://localhost:3000/api/auth/callback/gatehub`
   (production'da kendi domain'inle).
2. `.env.example` dosyasini `.env.local` olarak kopyala, `GATEHUB_CLIENT_ID`,
   `GATEHUB_CLIENT_SECRET`, `AUTH_SECRET` (`openssl rand -base64 32`),
   `ADMIN_EMAILS` degerlerini doldur.
3. Grafana Cloud > Administration > Service Accounts'tan **Viewer** rollu bir
   hesap + token olustur. Connections > Data sources > Prometheus sayfasindan
   `GRAFANA_PROM_URL` ("Prometheus server URL") ve `GRAFANA_PROM_USER`
   (Authentication > "User") degerlerini, ayni sekilde Loki sayfasindan
   `GRAFANA_LOKI_URL` / `GRAFANA_LOKI_USER` degerlerini al. `GRAFANA_API_TOKEN`
   olusturdugun Service Account token'i — hem Prometheus hem Loki icin Basic
   Auth sifresi olarak bu ayni token kullanilir.
4. `npm run dev` calistir, `http://localhost:3000` adresine git, "GateHub ile
   giris yap" ile dene.

## Yeni servis eklemek

Bu repoda **hicbir degisiklik gerekmez** — servisler telemetrinin kendisinden
kesfedilir. Baglamak istedigin projeye:

1. `npm i @vercel/otel`
2. Proje koküne `instrumentation.ts` ekle:
   ```ts
   import { registerOTel } from "@vercel/otel";
   export function register() {
     registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? "proje-adi" });
   }
   ```
3. Vercel > Settings > Environment Variables:
   ```
   OTEL_SERVICE_NAME=proje-adi
   OTEL_EXPORTER_OTLP_ENDPOINT=<Grafana Cloud OTLP endpoint>
   OTEL_EXPORTER_OTLP_HEADERS=<Authorization=Basic ...>
   ```
   (Endpoint ve header tum projelerde ayni.)
4. Deploy et, birkac istek at. Servis sol menude kendiliginden belirir.

## Metrikler nereden geliyor?

Uygulamalar yalnizca **trace** gonderir. Grafana Cloud tarafinda Tempo'nun
metrics-generator'i bu trace'lerden `traces_spanmetrics_*` metriklerini
uretir; panel sorgulari bunlari okur. Tempo bu metrikleri surume ve
histogram moduna gore farkli isimlerle yayinladigi icin `lib/metrics-schema.ts`
isimleri sabit yazmak yerine Prometheus'a sorup dogru sorguyu kurar. Hangi
servisin hangi metrikleri yayinladigini **Metrik katalogu** sayfasindan
gorebilirsin.
