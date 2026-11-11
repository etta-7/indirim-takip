export type Product = {
  id: number;
  url: string;
  site: string;
  title: string | null;
  target_price: number;
  last_price: number | null;
  last_checked_at: string | null;
  notify_cooldown_until: string | null;
  target_drop_percent: number | null;
  baseline_price: number | null;
};

export type UserSession = {
  user_id: number;
  preferred_site: string | null;
  pending_query: string | null;
  pending_target_price: number | null;
  pending_url: string | null;
  pending_title: string | null;
  search_results: { title: string; url: string; price?: number | null }[];
  awaiting_price: boolean;
  pending_target_drop_percent: number | null;
};

export function productToDict(p: Product) {
  return {
    id: p.id,
    url: p.url,
    site: p.site,
    title: p.title,
    target_price: p.target_price,
    last_price: p.last_price,
    last_checked_at: p.last_checked_at,
    target_drop_percent: p.target_drop_percent,
    baseline_price: p.baseline_price,
  };
}
