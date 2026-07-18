-- Migration: init
-- Version: 20260708172312

-- UP
-- ---- Tables ----
DEFINE FIELD IF NOT EXISTS dimensions ON TABLE embeddings TYPE int;
REMOVE TABLE has_memory;
