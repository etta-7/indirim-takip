/** Fiyat uyarısı kuralları (mutlak hedef ve yüzdelik düşüş). */

export const NO_ABSOLUTE_TARGET = -1;

const PERCENT_TOKEN_RE = /^(\d+(?:[.,]\d+)?)\s*%$/i;
const DIGIT_PERCENT_SPACED_RE = /(\d+(?:[.,]\d+)?)\s+%/;
const LEADING_PERCENT_RE = /%\s*(\d+(?:[.,]\d+)?)/;

export function normalizeAlertText(text: string): string {
  let t = text.trim().replace(/\uFF05/g, "%");
  t = t.replace(LEADING_PERCENT_RE, "$1%");
  t = t.replace(DIGIT_PERCENT_SPACED_RE, "$1%");
  return t;
}

export function absoluteTargetActive(targetPrice: number): boolean {
  return targetPrice >= 0;
}

export function percentDropFromBaseline(baseline: number, current: number): number {
  if (baseline <= 0) return 0;
  return Math.max(0, ((baseline - current) / baseline) * 100);
}

export function shouldAlertAbsolute(current: number, targetPrice: number): boolean {
  if (!absoluteTargetActive(targetPrice)) return false;
  return current <= targetPrice;
}

export function parsePercentToken(text: string): number | null {
  const m = text.trim().match(PERCENT_TOKEN_RE);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

export function splitAlertArgs(args: string[]): { rest: string[]; percent: number | null } {
  let percent: number | null = null;
  const rest: string[] = [];
  let i = 0;
  while (i < args.length) {
    const token = args[i];
    if (token === "--percent" && i + 1 < args.length) {
      const n = parseFloat(args[i + 1].replace(",", "."));
      if (!Number.isNaN(n)) percent = n;
      i += 2;
      continue;
    }
    const pct = parsePercentToken(token);
    if (pct !== null) {
      percent = pct;
      i += 1;
      continue;
    }
    rest.push(token);
    i += 1;
  }
  return { rest, percent };
}

export function shouldAlertPercentDrop(
  current: number,
  baseline: number | null,
  targetDropPercent: number | null
): boolean {
  if (targetDropPercent == null || targetDropPercent <= 0) return false;
  if (baseline == null || baseline <= 0) return false;
  const drop = percentDropFromBaseline(baseline, current);
  return drop >= targetDropPercent;
}

export function parsePriceMessage(text: string): { target: number | null; dropPct: number | null } {
  const normalized = normalizeAlertText(text);
  const { rest, percent: splitPct } = splitAlertArgs(normalized.split(/\s+/));
  let target: number | null = null;
  let dropPct = splitPct;
  if (rest.length > 0) {
    const inline = parsePercentToken(rest[0]);
    if (inline !== null) target = NO_ABSOLUTE_TARGET;
    else {
      const n = parseFloat(rest[0].replace(",", "."));
      if (Number.isNaN(n)) return { target: null, dropPct: null };
      target = n;
    }
  }
  if (dropPct == null && rest.length > 1) dropPct = parsePercentToken(rest[1]);
  if (target == null && dropPct == null) return { target: null, dropPct: null };
  if (target == null && dropPct != null) target = NO_ABSOLUTE_TARGET;
  return { target, dropPct };
}
