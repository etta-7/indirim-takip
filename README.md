# İndirim Takip Botu

Trendyol, Hepsiburada, Akakçe ve Cimri ürün sayfalarındaki fiyatları periyodik kontrol eder; fiyat belirlediğiniz hedefin altına düştüğünde Telegram’a bildirim gönderir.

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
- `/add <url> <hedef_fiyat>` — ürün ekle
- `/list` — takip listesi
- `/remove <id>` — sil
- `/check` — anında kontrol
- `/status` — özet

## Project sohbetinden / CLI ekleme

Sunucudaki veritabanına doğrudan ekleme:

```bash
python scripts/add_product.py "https://www.trendyol.com/..." 1299.99
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

## Test

```bash
pip install pytest
pytest tests/
```

## Yasal not

Site kullanım koşullarına uygun, makul sıklıkta istek atın. Bot ürünler arasında kısa bekleme kullanır.
