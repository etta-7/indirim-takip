#!/usr/bin/env bash
# One-shot Oracle Cloud / Ubuntu server bootstrap for indirim-takip.
# Tested on Ubuntu 22.04 and 24.04. Run: sudo bash deploy/oracle-bootstrap.sh [INSTALL_DIR]
set -euo pipefail

REPO_URL="${INDIRIM_REPO_URL:-https://github.com/etta-7/indirim-takip.git}"
DEFAULT_INSTALL_DIR="/opt/indirim-takip"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root or with sudo." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y python3-venv git

is_repo() {
  local dir="$1"
  [[ -f "${dir}/main.py" && -f "${dir}/requirements.txt" && -f "${dir}/deploy/indirim-takip.service" ]]
}

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(dirname "${SCRIPT_PATH}")"
REPO_FROM_SCRIPT="$(dirname "${SCRIPT_DIR}")"

if [[ -n "${1:-}" ]]; then
  if [[ -d "$1" ]]; then
    INSTALL_DIR="$(cd "$1" && pwd)"
  else
    INSTALL_DIR="$1"
  fi
elif is_repo "${REPO_FROM_SCRIPT}"; then
  INSTALL_DIR="${REPO_FROM_SCRIPT}"
else
  INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
fi

if is_repo "${INSTALL_DIR}"; then
  echo "Using repository at ${INSTALL_DIR}"
elif [[ -d "${INSTALL_DIR}/.git" ]]; then
  echo "${INSTALL_DIR} is not a valid indirim-takip checkout." >&2
  exit 1
elif [[ -d "${INSTALL_DIR}" ]] && [[ -n "$(ls -A "${INSTALL_DIR}" 2>/dev/null || true)" ]]; then
  echo "${INSTALL_DIR} exists and is not empty; remove it or pass another INSTALL_DIR." >&2
  exit 1
else
  mkdir -p "${INSTALL_DIR}"
  git clone "${REPO_URL}" "${INSTALL_DIR}"
fi

cd "${INSTALL_DIR}"

if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  RUN_AS="${SUDO_USER}"
  chown -R "${RUN_AS}:${RUN_AS}" "${INSTALL_DIR}"
else
  RUN_AS="root"
fi

run_as_app_user() {
  if [[ "${RUN_AS}" == "root" ]]; then
    "$@"
  else
    sudo -u "${RUN_AS}" -- "$@"
  fi
}

if [[ ! -d .venv ]]; then
  run_as_app_user python3 -m venv .venv
fi

run_as_app_user .venv/bin/pip install -q --upgrade pip
run_as_app_user .venv/bin/pip install -q -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  if [[ "${RUN_AS}" != "root" ]]; then
    chown "${RUN_AS}:${RUN_AS}" .env
  fi
  cat >&2 <<EOF
Created ${INSTALL_DIR}/.env from .env.example.
Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env, then run this script again:
  sudo bash deploy/oracle-bootstrap.sh
EOF
  exit 1
fi

SERVICE_DST="/etc/systemd/system/indirim-takip.service"
sed "s|/opt/indirim-takip|${INSTALL_DIR}|g" deploy/indirim-takip.service >"${SERVICE_DST}"

systemctl daemon-reload
systemctl enable indirim-takip
systemctl restart indirim-takip

echo "indirim-takip is enabled and running."
systemctl --no-pager status indirim-takip || true
echo "Logs: journalctl -u indirim-takip -f"
