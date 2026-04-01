-- Migration: add_indexes
-- Version: 20260514150050

-- UP
-- ---- Tables ----
DEFINE INDEX idx_uses_model_in_out ON TABLE uses_model COLUMNS in, out UNIQUE;

-- DOWN
-- ---- Tables ----
REMOVE INDEX idx_uses_model_in_out ON TABLE uses_model;
