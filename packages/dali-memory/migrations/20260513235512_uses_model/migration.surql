-- Migration: uses_model
-- Version: 20260513235512

-- UP
-- ---- Tables ----
DEFINE TABLE IF NOT EXISTS models SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS provider_id ON TABLE models TYPE string;
DEFINE FIELD IF NOT EXISTS model_id ON TABLE models TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE models TYPE datetime DEFAULT time::now();
DEFINE TABLE IF NOT EXISTS uses_model SCHEMAFULL TYPE RELATION IN sessions OUT models;
DEFINE FIELD IF NOT EXISTS type ON TABLE uses_model TYPE string;

-- DOWN
-- ---- Tables ----
REMOVE TABLE models;
REMOVE TABLE uses_model;
