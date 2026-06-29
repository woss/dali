-- Migration: add_user_name
-- Version: 20260629092647

-- UP
-- ---- Tables ----
DEFINE FIELD IF NOT EXISTS name ON TABLE users TYPE option<string>;

-- DOWN

