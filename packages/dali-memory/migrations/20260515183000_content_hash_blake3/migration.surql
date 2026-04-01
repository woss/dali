-- Migration: content-hash-blake3
-- Version: 20260515183000

-- UP
-- ---- Tables ----
DEFINE FIELD OVERWRITE content_hash ON TABLE memories TYPE string DEFAULT crypto::blake3(content);

-- DOWN
-- ---- Tables ----
DEFINE FIELD OVERWRITE content_hash ON TABLE memories TYPE string;
