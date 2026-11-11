import {
  NO_ABSOLUTE_TARGET,
  parsePercentToken,
  parsePriceMessage,
  splitAlertArgs,
} from "./alert-rules";
import { clearAfterAdd, getSession, setPendingProduct } from "./db/sessions";
import {
  countProducts,
  latestCheckTime,
  listProducts,
  removeProduct,
} from "./db/products";
import { formatPercent, formatPrice } from "./format";
import { checkAllPrices, getLastRun } from "./price-checker";
import { detectSite } from "./scrapers/base";
import { getAllowedTelegramUserIds } from "./env";
import { sendTelegramMessage } from "./telegram-api";
import { addProduct } from "./db/products";

const URL_RE = /https?:\/\/\S+/gi;

type TgMessage = {
  message_id: number;
  text?: string;
  chat: { id: number };
  from?: { id: number };
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
};

function userAllowed(userId: number | undefined): boolean {
  const allowed = getAllowedTelegramUserIds();
  if (allowed.size === 0) return true;
  return userId != null && allowed.has(userId);
}

function formatAlertSummary(
  target: number,
  dropPct: number | null,
  prefix = "Hedef"
): string {
  const parts: string[] = [];
  if (target >= 0) parts.push(`${prefix}: ${formatPrice(target)}`);
  if (dropPct != null) parts.push(`Düşüş eşiği: ${formatPercent(dropPct)}`);
  return parts.length ? parts.join(" | ") : "Uyarı eşiği yok";
}

async function reply(chatId: number, text: string): Promise<void> {
  await sendTelegramMessage(chatId, text);
}

async function finalizeAdd(
  chatId: number,
  userId: number,
  url: string,
  target: number,
  opts: {
    titleHint?: string | null;
    targetDropPercent?: number | null;
    baselinePrice?: number | null;
  } = {}
): Promise<void> {
  if (target < 0 && opts.targetDropPercent == null) {
    await reply(chatId, "En az bir uyarı eşiği gerekli (TL hedefi veya yüzde, örn. 10%).");
    return;
  }
  const site = detectSite(url);
  if (site === "unknown") {
    await reply(
      chatId,
      "URL tanınamadı. Trendyol, Hepsiburada, Akakçe veya Cimri linki gerekli."
    );
    return;
  }
  try {
    const product = await addProduct(url, site, target, {
      target_drop_percent: opts.targetDropPercent ?? null,
      baseline_price: opts.baselinePrice ?? null,
    });
    await clearAfterAdd(userId);
    const name = (opts.titleHint || url).slice(0, 50);
    await reply(
      chatId,
      `Eklendi #${product.id} (${site}) ${name}\n${formatAlertSummary(target, opts.targetDropPercent ?? null)}`
    );
  } catch {
    await reply(chatId, "Bu URL zaten listede veya kayıt başarısız.");
  }
}

async function handleStart(chatId: number): Promise<void> {
  await reply(
    chatId,
    "İndirim takip botu\n\n" +
      "/add <url> <hedef> — link ile ekle (hedef: TL, 10% veya --percent 10)\n" +
      "/ekle — /add ile aynı\n" +
      "/list — listele\n" +
      "/remove <id> — sil\n" +
      "/check — hemen fiyat kontrolü\n" +
      "/status — durum\n\n" +
      "Web paneli: Vercel adresinizdeki ana sayfa."
  );
}

async function handleAdd(chatId: number, userId: number, rawArgs: string[]): Promise<void> {
  const { rest: args, percent: trailing } = splitAlertArgs(rawArgs);
  const joined = rawArgs.join(" ");

  if (URL_RE.test(joined)) {
    const urlMatch = joined.match(URL_RE);
    const url = urlMatch?.[0]?.replace(/[),.;]+$/, "") ?? null;
    if (!url) {
      await reply(chatId, "Kullanım: /add <url> <hedef> [ --percent N ]");
      return;
    }
    const alertTokens = args.filter((a) => a !== url);
    const { rest: alertRest, percent: urlPct } = splitAlertArgs(alertTokens);
    let dropPct = urlPct ?? trailing;
    if (alertRest.length === 0) {
      if (dropPct == null) {
        await setPendingProduct(userId, url, url, null, true);
        await reply(
          chatId,
          "Hedef yazın: TL (ör. 2500), yüzde (ör. 10%) veya ikisi (2500 10%)."
        );
        return;
      }
      await finalizeAdd(chatId, userId, url, NO_ABSOLUTE_TARGET, {
        targetDropPercent: dropPct,
      });
      return;
    }
    const first = alertRest[0];
    const inline = parsePercentToken(first);
    let target: number;
    if (inline != null) {
      target = NO_ABSOLUTE_TARGET;
      if (dropPct == null) dropPct = inline;
    } else {
      const n = parseFloat(first.replace(",", "."));
      if (Number.isNaN(n)) {
        await reply(chatId, "Geçersiz hedef. Örnek: 2500, 10% veya 2500 --percent 10");
        return;
      }
      target = n;
    }
    await finalizeAdd(chatId, userId, url, target, { targetDropPercent: dropPct });
    return;
  }

  await reply(
    chatId,
    "Şimdilik link ile ekleyin:\n/add <url> <hedef TL veya %>\nÖrnek: /add https://www.hepsiburada.com/... 10%"
  );
}

async function handleList(chatId: number): Promise<void> {
  const products = await listProducts();
  if (!products.length) {
    await reply(chatId, "Liste boş.");
    return;
  }
  const lines = products.map((p) => {
    const last = p.last_price != null ? formatPrice(p.last_price) : "—";
    const name = (p.title || p.url).slice(0, 60);
    const alert = formatAlertSummary(p.target_price, p.target_drop_percent);
    const base =
      p.baseline_price != null ? ` | Baz: ${formatPrice(p.baseline_price)}` : "";
    return `#${p.id} [${p.site}] ${name}\n  Son: ${last} | ${alert}${base}`;
  });
  await reply(chatId, lines.join("\n\n"));
}

async function handleRemove(chatId: number, args: string[]): Promise<void> {
  if (!args.length) {
    await reply(chatId, "Kullanım: /remove <id>");
    return;
  }
  const pid = parseInt(args[0], 10);
  if (Number.isNaN(pid)) {
    await reply(chatId, "Geçersiz id.");
    return;
  }
  if (await removeProduct(pid)) await reply(chatId, `#${pid} silindi.`);
  else await reply(chatId, "Ürün bulunamadı.");
}

async function handleCheck(chatId: number): Promise<void> {
  await reply(chatId, "Fiyat kontrolü başlıyor…");
  const { ok, failed } = await checkAllPrices();
  await reply(chatId, `Tamamlandı: ${ok} başarılı, ${failed} hata.`);
}

async function handleStatus(chatId: number): Promise<void> {
  const count = await countProducts();
  const lastDb = await latestCheckTime();
  const lastJob = getLastRun();
  await reply(
    chatId,
    `Ürün sayısı: ${count}\n` +
      `Son DB kontrolü: ${lastDb || "—"}\n` +
      `Son job çalışması: ${lastJob ? lastJob.toISOString() : "henüz yok"}\n` +
      `Zamanlama: Vercel Cron (30 dk)`
  );
}

async function handlePriceReply(chatId: number, userId: number, text: string): Promise<boolean> {
  const sess = await getSession(userId);
  if (!sess.awaiting_price || !sess.pending_url) return false;
  const { target, dropPct } = parsePriceMessage(text);
  if (target == null && dropPct == null) {
    await reply(chatId, "Geçersiz hedef. Örnek: 2500, 10%, 5 % veya 2500 10%");
    return true;
  }
  const t = target ?? NO_ABSOLUTE_TARGET;
  await finalizeAdd(chatId, userId, sess.pending_url, t, {
    titleHint: sess.pending_title,
    targetDropPercent: dropPct,
  });
  return true;
}

export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  const msg = update.message;
  if (!msg?.text || !msg.from) return;
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  if (!userAllowed(userId)) {
    await reply(chatId, "Bu botu kullanma yetkiniz yok.");
    return;
  }

  const text = msg.text.trim();
  if (!text.startsWith("/")) {
    const handled = await handlePriceReply(chatId, userId, text);
    if (handled) return;
    return;
  }

  const [commandRaw, ...rest] = text.split(/\s+/);
  const command = commandRaw.split("@")[0].toLowerCase();
  const args = rest;

  switch (command) {
    case "/start":
      await handleStart(chatId);
      break;
    case "/add":
    case "/ekle":
      await handleAdd(chatId, userId, args);
      break;
    case "/list":
      await handleList(chatId);
      break;
    case "/remove":
      await handleRemove(chatId, args);
      break;
    case "/check":
      await handleCheck(chatId);
      break;
    case "/status":
      await handleStatus(chatId);
      break;
    default:
      await reply(chatId, "Bilinmeyen komut. /start ile yardım alın.");
  }
}
