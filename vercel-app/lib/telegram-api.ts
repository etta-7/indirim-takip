import { getTelegramBotToken } from "./env";

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  opts: { parseMode?: "Markdown" | "HTML"; disablePreview?: boolean } = {}
): Promise<void> {
  const token = getTelegramBotToken();
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: opts.disablePreview ?? false,
  };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${err}`);
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = getTelegramBotToken();
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: Boolean(text),
    }),
  });
}
