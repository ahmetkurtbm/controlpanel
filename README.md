# Control Panel

GateHub'a bagli tum uygulamalarin (gatehub, ileride receiptflow, testmetrix, ...)
metrik/log/trace verisini tek bir yerden izlemek icin kisiye ozel bir panel.

- **Giris**: Grafana Cloud'a degil, **GateHub'a** giris yapilir (bu uygulama
  GateHub'a kayitli bir OAuth istemcisi). Sadece `ADMIN_EMAILS` listesindeki
  adresler icine girebilir.
- **Veri**: Grafana Cloud'un ucretsiz tier'inda barinan Prometheus (Mimir),
  Loki ve Tempo'ya, sunucu tarafinda, salt-okunur bir token ile sorgu atilir
  (`lib/grafana.ts`, `lib/tempo.ts`). Kimse Grafana'nin kendi arayuzune girmez.

## Neler var

- **Genel bakis** — her servis icin RED metrikleri (istek/hata/gecikme) ve
  ozellestirilebilir grafik panolari.
- **Servis detayi** — p50/p95/p99, rota kirilimlari, **trace listesi + span
  waterfall** (yavas isteklerin nerede takildigini gormek icin), **canli log
  akisi** (seviye filtresi ve metin aramasi ile).
- **Uyarilar** — hata orani, gecikme ve "veri gelmiyor" esikleri sunucu
  tarafinda degerlendirilir; sol menude aktif uyari rozeti gorunur.
- **Metrik katalogu** — her servisin yayinladigi ham metrik adlari ve hangi
  panellerin desteklendigi.

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

## Log gonderme (opsiyonel)

`@vercel/otel` yalnizca trace gonderir; log gondermez. Vercel'in Log Drain
ozelligi ucretli plan gerektirdigi icin loglar uygulamadan **OpenTelemetry
Logs SDK** ile ayni OTLP adresine gonderilir. Ornek: gatehub'daki
`instrumentation.ts` (LoggerProvider kaydi) ve `lib/otel-logs.ts` (`log.info`
/ `log.error` sarmalayicisi). Yeni bir projede loglari acmak icin ayni iki
dosyayi kopyalayip `npm i @opentelemetry/exporter-logs-otlp-http` calistirmak
yeterli — ek ortam degiskeni gerekmez.

## Pano duzenleri

Paneller tarayicinin localStorage'inda saklanir (bu uygulamanin veritabani
yok). Baska bir tarayiciya tasimak icin panolarin sag ustundeki indirme /
yukleme dugmelerini kullan.

## Metrikler nereden geliyor?

Uygulamalar yalnizca **trace** gonderir. Grafana Cloud tarafinda Tempo'nun
metrics-generator'i bu trace'lerden `traces_spanmetrics_*` metriklerini
uretir; panel sorgulari bunlari okur. Tempo bu metrikleri surume ve
histogram moduna gore farkli isimlerle yayinladigi icin `lib/metrics-schema.ts`
isimleri sabit yazmak yerine Prometheus'a sorup dogru sorguyu kurar. Hangi
servisin hangi metrikleri yayinladigini **Metrik katalogu** sayfasindan
gorebilirsin.
