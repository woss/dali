-- Migration: init
-- Version: 20260716180834

-- UP
-- ---- Tables ----
REMOVE FIELD deleted_at ON TABLE workspaces;
