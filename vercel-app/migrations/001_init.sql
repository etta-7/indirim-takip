-- Vercel Postgres schema for indirim-takip (run once against POSTGRES_URL)

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    site TEXT NOT NULL,
    title TEXT,
    target_price DOUBLE PRECISION NOT NULL,
    last_price DOUBLE PRECISION,
    last_checked_at TIMESTAMPTZ,
    notify_cooldown_until TIMESTAMPTZ,
    target_drop_percent DOUBLE PRECISION,
    baseline_price DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
    user_id BIGINT PRIMARY KEY,
    preferred_site TEXT,
    pending_query TEXT,
    pending_target_price DOUBLE PRECISION,
    pending_url TEXT,
    pending_title TEXT,
    search_results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    awaiting_price BOOLEAN NOT NULL DEFAULT FALSE,
    pending_target_drop_percent DOUBLE PRECISION,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS products_site_idx ON products (site);
CREATE INDEX IF NOT EXISTS products_last_checked_idx ON products (last_checked_at);
