-- ============================================
-- SITE BLOCKER - DATABASE SCHEMA
-- ============================================

-- Tabela de Extensoes Conectadas
CREATE TABLE IF NOT EXISTS extensions (
    id TEXT PRIMARY KEY,
    machine_name TEXT NOT NULL,
    windows_user TEXT,
    ip_address TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'online' CHECK(status IN ('online', 'offline')),
    version TEXT,
    config TEXT, -- JSON com configuracoes da extensao
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    level TEXT DEFAULT 'user' CHECK(level IN ('admin', 'manager', 'user')),
    windows_user TEXT UNIQUE,
    allowed_sites TEXT, -- JSON array
    blocked_sites TEXT, -- JSON array
    extension_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE SET NULL
);

-- Tabela de Sites Bloqueados (Global)
CREATE TABLE IF NOT EXISTS blocked_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    reason TEXT,
    wildcard INTEGER DEFAULT 1,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Sites Permitidos (Global)
CREATE TABLE IF NOT EXISTS allowed_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    reason TEXT,
    temporary INTEGER DEFAULT 0,
    expires_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Logs
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extension_id TEXT,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT, -- JSON
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE SET NULL
);

-- Tabela de Solicitacoes de Liberacao
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    extension_id TEXT,
    user_id TEXT,
    user_name TEXT,
    site TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    approved_by TEXT,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE SET NULL
);

-- Tabela de Admins do Dashboard
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'admin' CHECK(role IN ('superadmin', 'admin', 'viewer')),
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Sessoes
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- Tabela de Configuracoes Globais
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_extension_id ON logs(extension_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_extensions_status ON extensions(status);
CREATE INDEX IF NOT EXISTS idx_users_windows_user ON users(windows_user);

-- Inserir configuracoes padrao
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('company_name', 'Empresa'),
    ('log_retention_days', '15'),
    ('auto_approve_requests', 'false'),
    ('block_all_mode', 'false');

-- Inserir admin padrao (senha: admin123)
-- Hash: SHA256 de "admin123" + salt
INSERT OR IGNORE INTO admins (username, password_hash, password_salt, name, role) VALUES 
    ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'default_salt', 'Administrador', 'superadmin');
