# İndirim Takip Botu

Trendyol, Hepsiburada, Akakçe ve Cimri ürün sayfalarındaki fiyatları periyodik kontrol eder; **mutlak TL hedefinin** altına veya **yüzdelik düşüş** eşiğine ulaşıldığında Telegram’a bildirim gönderir.

## Gereksinimler

- Python 3.10+
- Sürekli çalışan bir process (VPS, ev sunucusu vb.)

## Kurulum

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# .env içine TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID yazın
python main.py
```

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|-----------|
| `TELEGRAM_BOT_TOKEN` | BotFather token |
| `TELEGRAM_CHAT_ID` | Bildirim ve varsayılan chat |
| `CHECK_INTERVAL_MINUTES` | Varsayılan `30` |
| `DATABASE_PATH` | Varsayılan `data/tracker.db` |
| `HTTP_USER_AGENT` | İsteklerde kullanılan UA |
| `ALLOWED_TELEGRAM_USER_IDS` | İsteğe bağlı; boşsa herkes komut kullanabilir |

## Telegram komutları

- `/start` — yardım
- `/add <url> <hedef>` — link ile ürün ekle (`hedef`: TL, `10%` veya `2500 --percent 10`)
- `/add <hedef> <arama metni>` — URL olmadan isimle ekle (önce mağaza seçimi veya `/kategori`)
- `/add <site> <hedef> <arama metni>` — site + hedef + arama (site: `trendyol`, `hepsiburada`, `akakce`, `cimri`)
- `/ekle` — `/add` ile aynı
- `/ara [site] <arama metni>` — arama; listeden ürün seçimi (inline düğmeler)
- `/kategori` — varsayılan mağaza seçimi (Trendyol | Hepsiburada | Akakçe | Cimri)
- `/list` — takip listesi
- `/remove <id>` — sil
- `/check` — anında kontrol
- `/status` — özet

### İsimle ekleme örnekleri

```
/kategori
→ Trendyol seç

/add 2500 ck erkek mont xl beden
→ Arama sonuçlarından birini seç → hedef 2500 TL ile takibe alınır

/add trendyol 2500 ck erkek mont xl
→ Doğrudan Trendyol’da arar

/ara hepsiburada ck erkek mont xl
→ Sonuç listesi; ürün seçince hedef fiyat sorulur
```

Seçilen ürünün gerçek mağaza URL’si kaydedilir; periyodik fiyat kontrolü URL ile devam eder.

### Yüzdelik düşüş uyarısı

- Örnek: `/add https://... 10%` veya `/add trendyol 15% mont araması`
- Yüzde ile TL birlikte: `/add https://... 3000 --percent 10` (ikisi de tetiklenebilir)
- **Baz fiyat:** İlk başarılı kontroldeki fiyat (arama sonucundan eklerken listedeki fiyat varsa o kullanılır). Yüzde bildirimi geldikten sonra baz, bildirilen fiyata güncellenir; bir sonraki uyarı için yeniden en az bu kadar düşüş gerekir.

## Project sohbetinden / CLI ekleme

Sunucudaki veritabanına doğrudan ekleme:

```bash
python scripts/add_product.py "https://www.trendyol.com/..." 1299.99
python scripts/add_product.py "https://www.trendyol.com/..." --percent 10
```

Project sohbetinde `ekle https://... 1299` yazdığınızda koordinatör bu komutu çalıştırabilir.

## Desteklenen URL örnekleri

- `https://www.trendyol.com/...`
- `https://www.hepsiburada.com/...`
- `https://www.akakce.com/...`
- `https://www.cimri.com/...`

Akakçe/Cimri’de karşılaştırma ve mağaza sayfaları farklı HTML kullanabilir; sorun olursa doğrudan ürün sayfası linkini kullanın.

## systemd örneği

`/etc/systemd/system/indirim-takip.service`:

```ini
[Unit]
Description=Indirim Takip Telegram Bot
After=network.target

[Service]
Type=simple
User=indirim
WorkingDirectory=/opt/indirim-takip
Environment=PATH=/opt/indirim-takip/.venv/bin
ExecStart=/opt/indirim-takip/.venv/bin/python main.py
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now indirim-takip
```

## Veritabanı geçişi

Bot `init_db()` çalıştığında SQLite tablosuna `target_drop_percent` ve `baseline_price` sütunları eklenir (mevcut kayıtlar etkilenmez).

## Web paneli (Telegram’a ek)

Aynı SQLite veritabanını (`data/tracker.db`) kullanan mobil uyumlu kişisel panel. Türkçe arayüz; `DASHBOARD_TOKEN` ile korunur (başlık `X-Dashboard-Token`, `Authorization: Bearer` veya çerez).

### Yerel geliştirme

```bash
source .venv/bin/activate
pip install -r requirements.txt
# .env içine DASHBOARD_TOKEN=... ekleyin
python -m dashboard
```

Tarayıcıda `http://127.0.0.1:8787` açın; ilk açılışta panel anahtarını girin (cihazda saklanır). Telefonunuzdan aynı ağda test için geçici olarak `DASHBOARD_HOST=0.0.0.0` kullanabilirsiniz; üretimde yalnızca localhost önerilir.

Ana ekran: ürün listesi, link ile ekleme (hedef: TL / `10%` / ikisi), silme, **Şimdi kontrol et** (`PriceChecker` — Telegram ayarlıysa uyarılar gider).

iOS/Android: **Ana ekrana ekle** için minimal PWA (`manifest.webmanifest`, `theme-color`, güvenli alan boşlukları).

`main.py` botu değiştirmez; paneli botla birlikte veya ayrı process olarak çalıştırın:

```bash
python main.py          # Telegram bot
python -m dashboard     # Web panel (8787)
```

### Oracle VPS (isteğe bağlı)

Paneli yalnızca localhost’ta dinletin; dışarıdan SSH tüneli ile erişin:

```bash
ssh -L 8787:127.0.0.1:8787 kullanici@sunucu
```

Örnek birim dosyası: `deploy/indirim-takip-dashboard.service` (port `8787`, `EnvironmentFile` ile `.env`). Güvenlik duvarında 8787’yi açmayın; tünel veya özel VPN yeterli.

| Değişken | Açıklama |
|----------|-----------|
| `DASHBOARD_TOKEN` | Panel erişim anahtarı (zorunlu) |
| `DASHBOARD_HOST` | Varsayılan `127.0.0.1` |
| `DASHBOARD_PORT` | Varsayılan `8787` |

## Test

```bash
pip install pytest httpx
pytest tests/
```

## Yasal not

Site kullanım koşullarına uygun, makul sıklıkta istek atın. Bot ürünler arasında kısa bekleme kullanır.
