import { sql } from "@vercel/postgres";
import type { UserSession } from "./types";

function rowToSession(row: Record<string, unknown> | undefined, userId: number): UserSession {
  if (!row) {
    return {
      user_id: userId,
      preferred_site: null,
      pending_query: null,
      pending_target_price: null,
      pending_url: null,
      pending_title: null,
      search_results: [],
      awaiting_price: false,
      pending_target_drop_percent: null,
    };
  }
  let searchResults: UserSession["search_results"] = [];
  const raw = row.search_results_json;
  if (Array.isArray(raw)) searchResults = raw as UserSession["search_results"];
  else if (typeof raw === "string") {
    try {
      searchResults = JSON.parse(raw);
    } catch {
      searchResults = [];
    }
  }
  return {
    user_id: userId,
    preferred_site: row.preferred_site != null ? String(row.preferred_site) : null,
    pending_query: row.pending_query != null ? String(row.pending_query) : null,
    pending_target_price:
      row.pending_target_price != null ? Number(row.pending_target_price) : null,
    pending_url: row.pending_url != null ? String(row.pending_url) : null,
    pending_title: row.pending_title != null ? String(row.pending_title) : null,
    search_results: searchResults,
    awaiting_price: Boolean(row.awaiting_price),
    pending_target_drop_percent:
      row.pending_target_drop_percent != null
        ? Number(row.pending_target_drop_percent)
        : null,
  };
}

export async function getSession(userId: number): Promise<UserSession> {
  const { rows } = await sql`SELECT * FROM user_sessions WHERE user_id = ${userId}`;
  return rowToSession(rows[0] as Record<string, unknown> | undefined, userId);
}

async function upsertSession(sess: UserSession): Promise<void> {
  const now = new Date().toISOString();
  await sql`
    INSERT INTO user_sessions (
      user_id,
      preferred_site,
      pending_query,
      pending_target_price,
      pending_url,
      pending_title,
      search_results_json,
      awaiting_price,
      pending_target_drop_percent,
      updated_at
    )
    VALUES (
      ${sess.user_id},
      ${sess.preferred_site},
      ${sess.pending_query},
      ${sess.pending_target_price},
      ${sess.pending_url},
      ${sess.pending_title},
      ${JSON.stringify(sess.search_results)}::jsonb,
      ${sess.awaiting_price},
      ${sess.pending_target_drop_percent},
      ${now}::timestamptz
    )
    ON CONFLICT (user_id) DO UPDATE SET
      preferred_site = EXCLUDED.preferred_site,
      pending_query = EXCLUDED.pending_query,
      pending_target_price = EXCLUDED.pending_target_price,
      pending_url = EXCLUDED.pending_url,
      pending_title = EXCLUDED.pending_title,
      search_results_json = EXCLUDED.search_results_json,
      awaiting_price = EXCLUDED.awaiting_price,
      pending_target_drop_percent = EXCLUDED.pending_target_drop_percent,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function setPendingProduct(
  userId: number,
  url: string,
  title: string,
  targetPrice: number | null,
  awaitingPrice: boolean,
  targetDropPercent?: number | null
): Promise<void> {
  const sess = await getSession(userId);
  sess.pending_url = url;
  sess.pending_title = title;
  sess.pending_target_price = targetPrice;
  sess.pending_target_drop_percent = targetDropPercent ?? null;
  sess.awaiting_price = awaitingPrice;
  sess.search_results = [];
  sess.pending_query = null;
  await upsertSession(sess);
}

export async function clearAfterAdd(userId: number): Promise<void> {
  const now = new Date().toISOString();
  await sql`
    UPDATE user_sessions SET
      pending_query = NULL,
      pending_target_price = NULL,
      pending_target_drop_percent = NULL,
      pending_url = NULL,
      pending_title = NULL,
      search_results_json = '[]'::jsonb,
      awaiting_price = FALSE,
      updated_at = ${now}::timestamptz
    WHERE user_id = ${userId}
  `;
}
