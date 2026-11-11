# Vercel deployment (indirim-takip)

Oracle VM veya uzun süreli Python polling gerekmez. Uygulama `vercel-app/` altındaki Next.js 14 projesidir: web paneli, Telegram webhook, Vercel Cron ile fiyat kontrolü ve Vercel Postgres.

## 1. GitHub bağlantısı

1. [Vercel Dashboard](https://vercel.com) → **Add New Project**
2. Repo: **etta-7/indirim-takip**
3. **Root Directory**: `vercel-app` (Edit → `vercel-app`)
4. Framework: Next.js (otomatik algılanır)
5. Deploy

## 2. Vercel Postgres

1. Proje → **Storage** → **Create Database** → **Postgres**
2. Bağlandığında `POSTGRES_URL` (ve ilişkili değişkenler) projeye eklenir.
3. Şemayı uygulayın (bir kez):

```bash
cd vercel-app
export POSTGRES_URL='...'   # Vercel → Storage → .env.local snippet
node scripts/run-migrate.mjs
```

Alternatif: Vercel SQL konsolunda `vercel-app/migrations/001_init.sql` içeriğini çalıştırın.

## 3. Ortam değişkenleri

Vercel → Project → **Settings** → **Environment Variables** (Production + Preview):

| Değişken | Açıklama |
|----------|----------|
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_CHAT_ID` | Uyarıların gideceği chat id |
| `ALLOWED_TELEGRAM_USER_IDS` | İsteğe bağlı; virgülle ayrılmış Telegram user id |
| `DASHBOARD_TOKEN` | Web paneli API anahtarı (güçlü rastgele) |
| `POSTGRES_URL` | Postgres (Storage ile gelir) |
| `CRON_SECRET` | Cron endpoint koruması (rastgele uzun string) |
| `HTTP_USER_AGENT` | İsteğe bağlı; scraper User-Agent |

Örnekler: `vercel-app/.env.example`

## 4. Cron

`vercel-app/vercel.json` her **30 dakikada** `/api/cron/check-prices` çağırır. Vercel, isteğe `Authorization: Bearer <CRON_SECRET>` ekler (aynı değeri `CRON_SECRET` env’de tutun).

Hobby planda cron sıklığı kısıtlı olabilir; Pro’da 30 dk hedeflenir. Manuel test:

```bash
curl -sS -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://YOUR_DOMAIN.vercel.app/api/cron/check-prices"
```

## 5. Telegram webhook

Deploy sonrası domain’i kullanın (`https://xxx.vercel.app` veya özel domain):

```bash
export TELEGRAM_BOT_TOKEN='...'
./vercel-app/scripts/set-telegram-webhook.sh https://YOUR_DOMAIN.vercel.app
```

Webhook URL: `https://YOUR_DOMAIN.vercel.app/api/telegram`

Eski long-polling botu (Oracle) durdurun; aynı token ile yalnızca webhook kullanılmalı.

## 6. Web paneli

Tarayıcıda deployment URL’si. İlk açılışta `DASHBOARD_TOKEN` istenir; cihazda `localStorage`’da saklanır.

## 7. Telegram komutları

- `/start`, `/add`, `/ekle`, `/list`, `/remove`, `/check`, `/status`
- Link + hedef: `/add https://www.trendyol.com/... 2500` veya `10%`

Python botu (`main.py`) ve Oracle systemd birimleri artık gerekli değil; isteğe bağlı yerel geliştirme için durabilir.

## 8. Yerel geliştirme

```bash
cd vercel-app
cp .env.example .env.local
# POSTGRES_URL ve diğerlerini doldurun
npm install
npm run dev
```

`ngrok` ile webhook testi: `set-telegram-webhook.sh` URL’sine ngrok adresini verin.
