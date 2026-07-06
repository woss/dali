-- Migration: init
-- Version: 20260705203422

-- UP
-- ---- Tables ----
DEFINE FIELD IF NOT EXISTS chunk_index ON TABLE embeddings TYPE option<int>;
DEFINE FIELD IF NOT EXISTS chunk_text ON TABLE embeddings TYPE option<string>;
DEFINE FIELD IF NOT EXISTS section ON TABLE embeddings TYPE option<string>;
