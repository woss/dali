-- Migration: init
-- Version: 20260703234914

-- UP
-- ---- Tables ----
DEFINE FIELD IF NOT EXISTS user_id ON TABLE workspaces TYPE option<record<users>>;
