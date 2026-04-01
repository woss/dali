-- Migration: uses_model_idx
-- Version: 20260514001453

-- UP
-- ---- Tables ----
DEFINE INDEX idx_models_provider_id_model_id ON TABLE models COLUMNS provider_id, model_id UNIQUE;

-- DOWN
-- ---- Tables ----
REMOVE INDEX idx_models_provider_id_model_id ON TABLE models;
