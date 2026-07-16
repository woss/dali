-- Migration: init
-- Version: 20260715232500

-- UP
-- ---- Tables ----
DEFINE FIELD IF NOT EXISTS deleted_at ON TABLE workspaces TYPE option<datetime>;
