-- Migration: init
-- Version: 20260628174502

-- UP
-- ---- Analyzers ----
DEFINE ANALYZER IF NOT EXISTS fts_ascii TOKENIZERS class FILTERS ascii, lowercase;
-- ---- Tables ----
DEFINE TABLE IF NOT EXISTS workspaces SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON TABLE workspaces TYPE string;
DEFINE FIELD IF NOT EXISTS description ON TABLE workspaces TYPE option<string>;
DEFINE FIELD IF NOT EXISTS is_personal ON TABLE workspaces TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE workspaces TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_workspaces_name ON TABLE workspaces COLUMNS name UNIQUE;
DEFINE TABLE IF NOT EXISTS memories SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON TABLE memories TYPE string;
DEFINE FIELD IF NOT EXISTS content ON TABLE memories TYPE string;
DEFINE FIELD IF NOT EXISTS memory_type ON TABLE memories TYPE string DEFAULT 'fact';
DEFINE FIELD IF NOT EXISTS metadata ON TABLE memories TYPE option<object>;
DEFINE FIELD IF NOT EXISTS workspace_id ON TABLE memories TYPE record<workspaces>;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE memories TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_memories_name_ws ON TABLE memories COLUMNS name, workspace_id UNIQUE;
DEFINE INDEX idx_memories_content_ws ON TABLE memories COLUMNS content, workspace_id UNIQUE;
DEFINE INDEX idx_memories_content_ft ON TABLE memories COLUMNS content FULLTEXT ANALYZER fts_ascii;
DEFINE TABLE IF NOT EXISTS embeddings SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS vector ON TABLE embeddings TYPE array;
DEFINE FIELD IF NOT EXISTS model ON TABLE embeddings TYPE record<models>;
DEFINE FIELD IF NOT EXISTS dimensions ON TABLE embeddings TYPE int;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE embeddings TYPE datetime DEFAULT time::now();
DEFINE TABLE IF NOT EXISTS models SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS provider_id ON TABLE models TYPE string;
DEFINE FIELD IF NOT EXISTS model_id ON TABLE models TYPE string;
DEFINE FIELD IF NOT EXISTS variant ON TABLE models TYPE option<string>;
DEFINE FIELD IF NOT EXISTS dimensions ON TABLE models TYPE int;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE models TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_models_provider_model ON TABLE models COLUMNS provider_id, model_id UNIQUE;
DEFINE TABLE IF NOT EXISTS has_embedding SCHEMAFULL TYPE RELATION IN embeddings OUT memories;
DEFINE TABLE IF NOT EXISTS tags SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON TABLE tags TYPE string;
DEFINE INDEX idx_tags_name ON TABLE tags COLUMNS name UNIQUE;
DEFINE TABLE IF NOT EXISTS memory_tags SCHEMAFULL TYPE RELATION IN memories OUT tags;
DEFINE FIELD IF NOT EXISTS in ON TABLE memory_tags TYPE record<memories>;
DEFINE FIELD IF NOT EXISTS out ON TABLE memory_tags TYPE record<tags>;
DEFINE INDEX idx_memory_tags_pair ON TABLE memory_tags COLUMNS in, out UNIQUE;
DEFINE TABLE IF NOT EXISTS api_keys SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS key_hash ON TABLE api_keys TYPE string;
DEFINE FIELD IF NOT EXISTS name ON TABLE api_keys TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE api_keys TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS last_used_at ON TABLE api_keys TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS user_id ON TABLE api_keys TYPE option<record<users>>;
DEFINE INDEX idx_api_keys_hash ON TABLE api_keys COLUMNS key_hash UNIQUE;
DEFINE TABLE IF NOT EXISTS users SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS email ON TABLE users TYPE string;
DEFINE FIELD IF NOT EXISTS pass ON TABLE users TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE users TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_users_email ON TABLE users COLUMNS email UNIQUE;
-- ---- Access ----
DEFINE ACCESS user_access ON DATABASE TYPE RECORD SIGNUP (CREATE users SET email = $email, pass = crypto::argon2::generate($pass)) SIGNIN (SELECT * FROM users WHERE email = $email AND crypto::argon2::compare(pass, $pass)) DURATION FOR TOKEN 1h, FOR SESSION 30d;

-- DOWN
-- ---- Tables ----
REMOVE TABLE workspaces;
REMOVE TABLE memories;
REMOVE TABLE embeddings;
REMOVE TABLE models;
REMOVE TABLE has_embedding;
REMOVE TABLE tags;
REMOVE TABLE memory_tags;
REMOVE TABLE api_keys;
REMOVE TABLE users;
-- ---- Access ----
REMOVE ACCESS IF EXISTS user_access ON DATABASE;
-- ---- Analyzers ----
REMOVE ANALYZER IF EXISTS fts_ascii;
