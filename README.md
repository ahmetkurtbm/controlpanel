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
   hesap + token olustur. `GRAFANA_URL` (Grafana'ya giris yaptigin adres),
   `GRAFANA_PROM_UID` / `GRAFANA_LOKI_UID` (Connections > Data sources'ta
   ilgili datasource'a tiklayinca URL'de gorunen UID) ve `GRAFANA_API_TOKEN`
   degerlerini doldur. (Ham prometheus-prod-xxx/logs-prod-xxx adresleri
   yerine Grafana'nin kendi datasource-proxy API'si kullaniliyor, boylece
   tek bir Bearer token her yerde yeterli oluyor.)
4. `npm run dev` calistir, `http://localhost:3000` adresine git, "GateHub ile
   giris yap" ile dene.

## Yeni servis eklemek

`app/page.tsx` icindeki `SERVICES` dizisine servis adini ekle (GateHub'daki
`OTEL_SERVICE_NAME` ile ayni olmali). Baska hicbir sey degismiyor.
