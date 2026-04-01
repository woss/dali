-- Migration: add_index_to_partofproject
-- Version: 20260514182642

-- UP
-- ---- Tables ----
DEFINE INDEX idx_part_of_project_in_out ON TABLE part_of_project COLUMNS in, out UNIQUE;

-- DOWN
-- ---- Tables ----
REMOVE INDEX idx_part_of_project_in_out ON TABLE part_of_project;
