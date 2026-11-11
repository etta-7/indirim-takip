export function formatPrice(amount: number): string {
  const s = amount.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${s} TL`;
}

export function formatPercent(value: number): string {
  if (value === Math.trunc(value)) return `%${Math.trunc(value)}`;
  return `%${value}`;
}
