-- Migration: add_variant_to_model
-- Version: 20260514162212

-- UP
-- ---- Tables ----
DEFINE FIELD IF NOT EXISTS variant ON TABLE models TYPE option<string>;

-- DOWN

