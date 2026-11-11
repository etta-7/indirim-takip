# Vercel deployment (indirim-takip)

Oracle VM veya uzun süreli Python polling gerekmez. Uygulama `vercel-app/` altındaki Next.js 14 projesidir: web paneli, Telegram webhook, Vercel Cron ile fiyat kontrolü ve Vercel Postgres.

## 0. Ön koşul

Vercel hesabı GitHub’a bağlı (etta-7). **Hobby** planda Vercel Cron günde en fazla **bir** kez çalışabilir; repo’da `vercel-app/vercel.json` yalnızca günlük yedek cron içerir (`0 8 * * *`). **30 dakikalık** kontroller için GitHub Actions veya Oracle timer: [`docs/EXTERNAL_CRON.md`](EXTERNAL_CRON.md).

## 1. Proje import (bir kez)

1. [Vercel Dashboard](https://vercel.com) → **Add New Project**
2. GitHub repo: **etta-7/indirim-takip**
3. **Root Directory** → **Edit** → `vercel-app` (zorunlu; aksi halde monorepo kökü deploy edilir)
4. Framework: **Next.js** (otomatik)
5. **Deploy** (ilk build env olmadan kısmen başarısız olabilir; Postgres + env sonrası yeniden deploy edin)

### Otomatik deploy

GitHub bağlantısı açıksa **`main`** branch’ine her push production deploy tetikler. Elle CLI gerekmez.

### Koordinatör / CLI deploy

```bash
cd vercel-app
npm i -g vercel   # bir kez
vercel login      # bir kez
./scripts/vercel-deploy.sh
```

Alternatif: `vercel deploy --prod` komutunu `vercel-app` dizininde çalıştırın.

## 2. Vercel Postgres (Storage)

1. Vercel → ilgili proje → **Storage** → **Create Database** → **Postgres** (veya Marketplace’ten Neon)
2. Veritabanını bu projeye **Connect** edin; `POSTGRES_URL` (ve `POSTGRES_PRISMA_URL` vb.) env’lere yazılır
3. Şemayı uygulayın (bir kez):

```bash
cd vercel-app
export POSTGRES_URL='...'   # Storage → .env.local snippet
node scripts/run-migrate.mjs
```

Alternatif: Storage / SQL konsolunda `vercel-app/migrations/001_init.sql` dosyasının tamamını çalıştırın.

## 3. Ortam değişkenleri

Vercel → Project → **Settings** → **Environment Variables** (**Production** ve isteğe bağlı Preview):

| Değişken | Açıklama |
|----------|----------|
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_CHAT_ID` | Uyarıların gideceği chat id |
| `ALLOWED_TELEGRAM_USER_IDS` | İsteğe bağlı; virgülle ayrılmış Telegram user id |
| `DASHBOARD_TOKEN` | Web paneli API anahtarı (güçlü rastgele) |
| `POSTGRES_URL` | Postgres (Storage connect ile gelir) |
| `CRON_SECRET` | Cron endpoint koruması (rastgele uzun string) |
| `HTTP_USER_AGENT` | İsteğe bağlı; scraper User-Agent |

Şablon: `vercel-app/.env.example`

Env ekledikten sonra **Deployments** → son deployment → **Redeploy** (veya `main`’e boş commit / yeni push).

## 4. Cron

**30 dakika:** Vercel Hobby dış scheduler kullanır — ayrıntı: [`docs/EXTERNAL_CRON.md`](EXTERNAL_CRON.md). GitHub repo secret `CRON_SECRET`, workflow [`.github/workflows/price-check-30m.yml`](../.github/workflows/price-check-30m.yml).

**Vercel (günlük yedek):** `vercel-app/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-prices",
      "schedule": "0 8 * * *"
    }
  ]
}
```

Vercel cron isteğine `Authorization: Bearer <CRON_SECRET>` ekler; projede aynı `CRON_SECRET` değerini tanımlayın.

Manuel test:

```bash
curl -sS -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://indirim-takip-two.vercel.app/api/cron/check-prices"
```

## 5. Telegram webhook

Deploy URL’sini alın (ör. `https://indirim-takip-xxx.vercel.app` veya özel domain).

```bash
export TELEGRAM_BOT_TOKEN='...'
export VERCEL_URL='https://YOUR_DOMAIN.vercel.app'
./vercel-app/scripts/set-telegram-webhook.sh
```

Argüman ile: `./vercel-app/scripts/set-telegram-webhook.sh https://YOUR_DOMAIN.vercel.app`

Webhook hedefi: `https://YOUR_DOMAIN.vercel.app/api/telegram`

Oracle / `main.py` long-polling’i durdurun; aynı botta yalnızca webhook kullanılmalı.

## 6. Web paneli

Deployment URL’sini açın. İlk girişte `DASHBOARD_TOKEN` istenir (`localStorage`’da saklanır).

## 7. Telegram komutları

- `/start`, `/add`, `/ekle`, `/list`, `/remove`, `/check`, `/status`
- Örnek: `/add https://www.trendyol.com/... 2500` veya `10%`

## 8. Yerel geliştirme

```bash
cd vercel-app
cp .env.example .env.local
npm install
npm run dev
```

Doğrulama: `npm test && npm run build`

## 9. Kontrol listesi (koordinatör)

- [ ] Proje import: **etta-7/indirim-takip**, Root Directory = **vercel-app**
- [ ] Storage: Postgres oluştur + bağla
- [ ] Migration `001_init.sql` uygulandı
- [ ] Tüm env değişkenleri Production’da set
- [ ] Deploy yeşil
- [ ] `set-telegram-webhook.sh` + Oracle polling kapalı
- [ ] GitHub Actions secret `CRON_SECRET` (= Vercel `CRON_SECRET`); bkz. `docs/EXTERNAL_CRON.md`
- [ ] Panel + `/start` smoke test
