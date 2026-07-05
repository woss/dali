-- Migration: init
-- Version: 20260703234923

-- UP
-- ---- Tables ----
DEFINE FIELD IF NOT EXISTS default_workspace_id ON TABLE users TYPE option<record<workspaces>>;
