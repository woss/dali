-- Migration: embedding
-- Version: 20260513162020

-- UP
-- ---- Tables ----
DEFINE TABLE IF NOT EXISTS part_of_project SCHEMAFULL TYPE RELATION IN projects OUT memories;
DEFINE FIELD IF NOT EXISTS type ON TABLE part_of_project TYPE string;
DEFINE TABLE IF NOT EXISTS part_of_session SCHEMAFULL TYPE RELATION IN sessions OUT memories;
DEFINE FIELD IF NOT EXISTS type ON TABLE part_of_session TYPE string;
DEFINE TABLE IF NOT EXISTS uses_embedding SCHEMAFULL TYPE RELATION IN embeddings OUT memories;
DEFINE FIELD IF NOT EXISTS type ON TABLE uses_embedding TYPE string;
REMOVE FIELD embedding ON TABLE memories;

-- DOWN
-- ---- Tables ----
REMOVE TABLE part_of_project;
REMOVE TABLE part_of_session;
REMOVE TABLE uses_embedding;
