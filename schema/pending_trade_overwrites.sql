-- Run once against the same database as `trades` (Neon / Postgres).
-- Needed for "Обновить всё равно" when KV MESSAGE_STORE is not bound.

CREATE TABLE IF NOT EXISTS pending_trade_overwrites (
    user_id BIGINT NOT NULL,
    order_id TEXT NOT NULL,
    trade_json TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_trade_overwrites_expires_at ON pending_trade_overwrites (expires_at);
