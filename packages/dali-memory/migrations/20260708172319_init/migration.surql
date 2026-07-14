-- Migration: init
-- Version: 20260708172319

-- UP
-- ---- Tables ----
DEFINE TABLE IF NOT EXISTS has_memory SCHEMAFULL TYPE RELATION IN users OUT memories;
REMOVE FIELD dimensions ON TABLE embeddings;
