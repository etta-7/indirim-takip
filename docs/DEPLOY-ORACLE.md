# Oracle Cloud / Ubuntu deploy

Short guide for a fresh **Ubuntu 22.04 or 24.04** VM (Oracle Always Free or any VPS).

## One-shot bootstrap

On the server (as a user with `sudo`):

```bash
git clone https://github.com/etta-7/indirim-takip.git /opt/indirim-takip
cd /opt/indirim-takip
sudo bash deploy/oracle-bootstrap.sh
```

The script installs `python3-venv` and `git`, creates `.venv`, installs Python dependencies, and on the **first** run copies `.env.example` → `.env` and exits. Edit `.env` with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, then run the same command again to install and start the `indirim-takip` systemd unit.

Optional install path:

```bash
sudo bash deploy/oracle-bootstrap.sh /path/to/indirim-takip
```

If you are already inside a checkout, you can run `sudo bash deploy/oracle-bootstrap.sh` from that tree; it uses the current repo instead of cloning.

## Manual steps (same result)

1. Create an Ubuntu VM and note its public IP; ingress only needs SSH (22) from your IP.
2. `ssh ubuntu@<IP>`
3. Clone, configure `.env`, and use `deploy/indirim-takip.service` as in the README **systemd** section.

The bootstrap script automates steps 3 onward.

## Operations

```bash
sudo systemctl status indirim-takip
journalctl -u indirim-takip -f
```

Stop any other machine using the same bot token before starting the service (Telegram `getUpdates` conflict).
