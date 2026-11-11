import {
  absoluteTargetActive,
  percentDropFromBaseline,
  shouldAlertAbsolute,
  shouldAlertPercentDrop,
} from "./alert-rules";
import { listProducts, updateAfterCheck } from "./db/products";
import type { Product } from "./db/types";
import { formatPercent, formatPrice } from "./format";
import { getHttpUserAgent, getTelegramChatId, telegramConfigured } from "./env";
import { fetchPrice } from "./scrapers/base";
import { sendTelegramMessage } from "./telegram-api";

const NOTIFY_COOLDOWN_HOURS = 24;

let lastRun: Date | null = null;

export function getLastRun(): Date | null {
  return lastRun;
}

function parseIso(ts: string | null): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function sendAbsoluteAlert(
  product: Product,
  title: string,
  oldPrice: number | null,
  newPrice: number
): Promise<void> {
  if (!telegramConfigured() || !absoluteTargetActive(product.target_price)) return;
  const oldS = oldPrice != null ? formatPrice(oldPrice) : "—";
  const text =
    `🔻 *Fiyat hedefin altında*\n\n` +
    `*${title}*\n` +
    `Yeni: \`${formatPrice(newPrice)}\`\n` +
    `Önceki: \`${oldS}\`\n` +
    `Hedef: \`${formatPrice(product.target_price)}\`\n` +
    `[Ürüne git](${product.url})`;
  await sendTelegramMessage(getTelegramChatId(), text, {
    parseMode: "Markdown",
    disablePreview: false,
  });
}

async function sendPercentAlert(
  product: Product,
  title: string,
  baseline: number,
  oldPrice: number | null,
  newPrice: number,
  dropPct: number
): Promise<void> {
  if (!telegramConfigured()) return;
  const oldS = oldPrice != null ? formatPrice(oldPrice) : "—";
  const threshold = product.target_drop_percent ?? 0;
  const text =
    `📉 *Yüzdelik düşüş hedefine ulaşıldı*\n\n` +
    `*${title}*\n` +
    `Yeni: \`${formatPrice(newPrice)}\`\n` +
    `Önceki kontrol: \`${oldS}\`\n` +
    `Referans (baz): \`${formatPrice(baseline)}\`\n` +
    `Düşüş: \`${dropPct.toFixed(1)}%\` (eşik: ${formatPercent(threshold)})\n` +
    `[Ürüne git](${product.url})`;
  await sendTelegramMessage(getTelegramChatId(), text, {
    parseMode: "Markdown",
    disablePreview: false,
  });
}

async function checkProduct(product: Product, userAgent: string): Promise<void> {
  const result = await fetchPrice(product.url, userAgent);
  const oldPrice = product.last_price;
  const now = new Date();
  let baseline = product.baseline_price;
  if (baseline == null) baseline = result.price;

  const absHit = shouldAlertAbsolute(result.price, product.target_price);
  const pctHit = shouldAlertPercentDrop(result.price, baseline, product.target_drop_percent);

  let cooldownUntil: string | null = null;
  let baselineUpdate: number | null = null;

  const cd = parseIso(product.notify_cooldown_until);
  const onCooldown = cd != null && now < cd;

  if (product.baseline_price == null) baselineUpdate = result.price;

  if ((absHit || pctHit) && !onCooldown) {
    if (absHit) await sendAbsoluteAlert(product, result.title, oldPrice, result.price);
    if (pctHit) {
      const drop = percentDropFromBaseline(baseline, result.price);
      await sendPercentAlert(product, result.title, baseline, oldPrice, result.price, drop);
      baselineUpdate = result.price;
    }
    const until = new Date(now.getTime() + NOTIFY_COOLDOWN_HOURS * 3600 * 1000);
    cooldownUntil = until.toISOString();
  }

  await updateAfterCheck(product.id, {
    title: result.title,
    last_price: result.price,
    notify_cooldown_until: cooldownUntil,
    baseline_price: baselineUpdate,
  });
}

export async function checkAllPrices(): Promise<{ ok: number; failed: number }> {
  const userAgent = getHttpUserAgent();
  const products = await listProducts();
  let ok = 0;
  let failed = 0;
  for (const product of products) {
    try {
      await checkProduct(product, userAgent);
      ok += 1;
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      failed += 1;
      console.error(`Ürün kontrol hatası id=${product.id}`, e);
    }
  }
  lastRun = new Date();
  return { ok, failed };
}
