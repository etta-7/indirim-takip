function req(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function optional(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function getHttpUserAgent(): string {
  return optional(
    "HTTP_USER_AGENT",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
}

export function getDashboardToken(): string {
  return req("DASHBOARD_TOKEN");
}

export function getTelegramBotToken(): string {
  return req("TELEGRAM_BOT_TOKEN");
}

export function getTelegramChatId(): number {
  const n = parseInt(req("TELEGRAM_CHAT_ID"), 10);
  if (Number.isNaN(n)) throw new Error("Invalid TELEGRAM_CHAT_ID");
  return n;
}

export function getAllowedTelegramUserIds(): Set<number> {
  const raw = optional("ALLOWED_TELEGRAM_USER_IDS");
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n))
  );
}

export function getCronSecret(): string {
  return req("CRON_SECRET");
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}
