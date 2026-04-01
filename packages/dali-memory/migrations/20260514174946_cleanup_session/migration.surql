-- Migration: cleanup_session
-- Version: 20260514174946

-- UP
-- ---- Tables ----
REMOVE FIELD project ON TABLE sessions;
REMOVE FIELD agent ON TABLE sessions;
REMOVE FIELD model ON TABLE sessions;

-- DOWN

