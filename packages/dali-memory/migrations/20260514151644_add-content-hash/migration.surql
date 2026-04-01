-- Migration: add-content-hash
-- Version: 20260514151644

-- UP
-- ---- Tables ----
DEFINE FIELD IF NOT EXISTS content_hash ON TABLE memories TYPE string;
DEFINE INDEX idx_memories_content_hash ON TABLE memories COLUMNS content_hash UNIQUE;

-- DOWN
-- ---- Tables ----
REMOVE INDEX idx_memories_content_hash ON TABLE memories;
