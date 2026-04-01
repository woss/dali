-- Migration: add
-- Version: 20260513232107

-- UP
-- ---- Tables ----
DEFINE TABLE IF NOT EXISTS has_embedding SCHEMAFULL TYPE RELATION IN embeddings OUT memories;

-- DOWN
-- ---- Tables ----
REMOVE TABLE has_embedding;
