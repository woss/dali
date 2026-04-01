-- Migration: init
-- Version: 20260513162005

-- UP
-- ---- Tables ----
DEFINE TABLE IF NOT EXISTS embeddings SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE embeddings TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS dimensions ON TABLE embeddings TYPE int;
DEFINE FIELD IF NOT EXISTS model ON TABLE embeddings TYPE string;
DEFINE TABLE IF NOT EXISTS facts SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS content ON TABLE facts TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE facts TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS verified ON TABLE facts TYPE bool;
DEFINE TABLE IF NOT EXISTS memories SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS container_tag ON TABLE memories TYPE string;
DEFINE FIELD IF NOT EXISTS content ON TABLE memories TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE memories TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS embedding ON TABLE memories TYPE record<embeddings>;
DEFINE FIELD IF NOT EXISTS is_pinned ON TABLE memories TYPE bool;
DEFINE FIELD IF NOT EXISTS metadata ON TABLE memories TYPE option<object> FLEXIBLE;
DEFINE FIELD IF NOT EXISTS tags ON TABLE memories TYPE array;
DEFINE FIELD IF NOT EXISTS tags.* ON TABLE memories TYPE string;
DEFINE FIELD IF NOT EXISTS type ON TABLE memories TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE memories TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS vector ON TABLE memories TYPE array;
DEFINE FIELD IF NOT EXISTS vector.* ON TABLE memories TYPE float;
DEFINE TABLE IF NOT EXISTS messages SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS content ON TABLE messages TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE messages TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS role ON TABLE messages TYPE string;
DEFINE FIELD IF NOT EXISTS session ON TABLE messages TYPE record<sessions>;
DEFINE TABLE IF NOT EXISTS projects SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE projects TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS directory_path ON TABLE projects TYPE string;
DEFINE FIELD IF NOT EXISTS name ON TABLE projects TYPE string;
DEFINE INDEX idx_projects_directory_path ON TABLE projects COLUMNS directory_path UNIQUE;
DEFINE TABLE IF NOT EXISTS relates_to SCHEMAFULL TYPE RELATION IN facts OUT memories;
DEFINE FIELD IF NOT EXISTS type ON TABLE relates_to TYPE string;
DEFINE TABLE IF NOT EXISTS sessions SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS project ON TABLE sessions TYPE record<projects>;
DEFINE FIELD IF NOT EXISTS slug ON TABLE sessions TYPE string;
DEFINE FIELD IF NOT EXISTS title ON TABLE sessions TYPE string;
DEFINE FIELD IF NOT EXISTS agent ON TABLE sessions TYPE option<string>;
DEFINE FIELD IF NOT EXISTS model ON TABLE sessions TYPE option<object> FLEXIBLE;

-- DOWN
-- ---- Tables ----
REMOVE TABLE embeddings;
REMOVE TABLE facts;
REMOVE TABLE memories;
REMOVE TABLE messages;
REMOVE TABLE projects;
REMOVE TABLE relates_to;
REMOVE TABLE sessions;
