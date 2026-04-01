-- Migration: init_from_pull
-- Version: 20260505155135

-- UP
DEFINE TABLE IF NOT EXISTS article SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS article ON TABLE article TYPE record;
DEFINE FIELD IF NOT EXISTS content ON TABLE article TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE article TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS owner ON TABLE article TYPE record;
DEFINE FIELD IF NOT EXISTS published_at ON TABLE article TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS status ON TABLE article TYPE string;
DEFINE FIELD IF NOT EXISTS tags ON TABLE article TYPE option<array>;
DEFINE FIELD IF NOT EXISTS tags.* ON TABLE article TYPE any;
DEFINE FIELD IF NOT EXISTS title ON TABLE article TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at ON TABLE article TYPE datetime DEFAULT time::now();
DEFINE TABLE IF NOT EXISTS article_share SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE article_share TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS role ON TABLE article_share TYPE string DEFAULT 'viewer';
DEFINE TABLE IF NOT EXISTS published SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS published_at ON TABLE published TYPE datetime;
DEFINE TABLE IF NOT EXISTS todo SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS completed ON TABLE todo TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS completed_at ON TABLE todo TYPE option<datetime> DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS created_at ON TABLE todo TYPE datetime;
DEFINE FIELD IF NOT EXISTS description ON TABLE todo TYPE option<string>;
DEFINE FIELD IF NOT EXISTS owner ON TABLE todo TYPE record;
DEFINE FIELD IF NOT EXISTS tags ON TABLE todo TYPE option<array>;
DEFINE FIELD IF NOT EXISTS tags.* ON TABLE todo TYPE any;
DEFINE FIELD IF NOT EXISTS title ON TABLE todo TYPE string;
DEFINE FIELD IF NOT EXISTS todo ON TABLE todo TYPE record;
DEFINE TABLE IF NOT EXISTS todo_share SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE todo_share TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS role ON TABLE todo_share TYPE string DEFAULT 'viewer';
DEFINE TABLE IF NOT EXISTS user SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE user TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS email ON TABLE user TYPE string;
DEFINE FIELD IF NOT EXISTS name ON TABLE user TYPE string;
DEFINE FIELD IF NOT EXISTS password ON TABLE user TYPE string;
DEFINE TABLE IF NOT EXISTS wrote SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS created_at ON TABLE wrote TYPE datetime DEFAULT time::now();
DEFINE ACCESS user ON DATABASE TYPE RECORD SIGNUP (CREATE user SET email = $email, password = crypto::argon2::generate($password), name = $name) SIGNIN (SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(password, $password)) WITH JWT ALGORITHM HS512 KEY '[REDACTED]' WITH ISSUER KEY '[REDACTED]' DURATION FOR TOKEN 1h, FOR SESSION 1w;

-- DOWN
REMOVE TABLE article;
REMOVE TABLE article_share;
REMOVE TABLE published;
REMOVE TABLE todo;
REMOVE TABLE todo_share;
REMOVE TABLE user;
REMOVE TABLE wrote;
REMOVE ACCESS IF EXISTS user ON DATABASE;
