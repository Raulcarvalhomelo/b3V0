// ============================================
// SITE BLOCKER - DATABASE CONNECTION
// ============================================

import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Garantir que o diretorio data existe
const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Configuracoes do SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Inicializar schema
export function initDatabase() {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  
  // Executar cada statement separadamente
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      db.exec(statement);
    } catch (error) {
      console.error('Erro ao executar statement:', statement.substring(0, 50));
      console.error(error);
    }
  }
  
  console.log('[DB] Database initialized successfully');
}

// ============================================
// EXTENSOES
// ============================================

export interface Extension {
  id: string;
  machine_name: string;
  windows_user?: string;
  ip_address?: string;
  last_seen: string;
  status: 'online' | 'offline';
  version?: string;
  config?: string;
  created_at: string;
  updated_at: string;
}

export function getExtensions(): Extension[] {
  return db.prepare('SELECT * FROM extensions ORDER BY last_seen DESC').all() as Extension[];
}

export function getExtension(id: string): Extension | undefined {
  return db.prepare('SELECT * FROM extensions WHERE id = ?').get(id) as Extension | undefined;
}

export function upsertExtension(ext: Partial<Extension> & { id: string }): Extension {
  const existing = getExtension(ext.id);
  
  if (existing) {
    const stmt = db.prepare(`
      UPDATE extensions SET
        machine_name = COALESCE(?, machine_name),
        windows_user = COALESCE(?, windows_user),
        ip_address = COALESCE(?, ip_address),
        last_seen = CURRENT_TIMESTAMP,
        status = COALESCE(?, status),
        version = COALESCE(?, version),
        config = COALESCE(?, config),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(ext.machine_name, ext.windows_user, ext.ip_address, ext.status, ext.version, ext.config, ext.id);
  } else {
    const stmt = db.prepare(`
      INSERT INTO extensions (id, machine_name, windows_user, ip_address, status, version, config)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(ext.id, ext.machine_name || 'Unknown', ext.windows_user, ext.ip_address, ext.status || 'online', ext.version, ext.config);
  }
  
  return getExtension(ext.id)!;
}

export function updateExtensionStatus(id: string, status: 'online' | 'offline') {
  db.prepare('UPDATE extensions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
}

// ============================================
// USUARIOS
// ============================================

export interface User {
  id: string;
  name: string;
  department?: string;
  level: 'admin' | 'manager' | 'user';
  windows_user?: string;
  allowed_sites?: string;
  blocked_sites?: string;
  extension_id?: string;
  created_at: string;
  updated_at: string;
}

export function getUsers(): User[] {
  return db.prepare('SELECT * FROM users ORDER BY name').all() as User[];
}

export function getUser(id: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function getUserByWindowsUser(windowsUser: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE windows_user = ?').get(windowsUser) as User | undefined;
}

export function createUser(user: Omit<User, 'created_at' | 'updated_at'>): User {
  const stmt = db.prepare(`
    INSERT INTO users (id, name, department, level, windows_user, allowed_sites, blocked_sites, extension_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(user.id, user.name, user.department, user.level, user.windows_user, user.allowed_sites, user.blocked_sites, user.extension_id);
  return getUser(user.id)!;
}

export function updateUser(id: string, updates: Partial<User>): User | undefined {
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return getUser(id);
  
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as any)[f]);
  
  db.prepare(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values, id);
  return getUser(id);
}

export function deleteUser(id: string): boolean {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  return result.changes > 0;
}

// ============================================
// SITES BLOQUEADOS
// ============================================

export interface BlockedSite {
  id: number;
  domain: string;
  reason?: string;
  wildcard: number;
  created_by?: string;
  created_at: string;
}

export function getBlockedSites(): BlockedSite[] {
  return db.prepare('SELECT * FROM blocked_sites ORDER BY domain').all() as BlockedSite[];
}

export function addBlockedSite(domain: string, reason?: string, wildcard = true, createdBy?: string): BlockedSite {
  const stmt = db.prepare(`
    INSERT INTO blocked_sites (domain, reason, wildcard, created_by)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(domain, reason, wildcard ? 1 : 0, createdBy);
  return db.prepare('SELECT * FROM blocked_sites WHERE id = ?').get(result.lastInsertRowid) as BlockedSite;
}

export function removeBlockedSite(domain: string): boolean {
  const result = db.prepare('DELETE FROM blocked_sites WHERE domain = ?').run(domain);
  return result.changes > 0;
}

// ============================================
// SITES PERMITIDOS
// ============================================

export interface AllowedSite {
  id: number;
  domain: string;
  reason?: string;
  temporary: number;
  expires_at?: string;
  created_by?: string;
  created_at: string;
}

export function getAllowedSites(): AllowedSite[] {
  return db.prepare('SELECT * FROM allowed_sites ORDER BY domain').all() as AllowedSite[];
}

export function addAllowedSite(domain: string, reason?: string, temporary = false, expiresAt?: string, createdBy?: string): AllowedSite {
  const stmt = db.prepare(`
    INSERT INTO allowed_sites (domain, reason, temporary, expires_at, created_by)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(domain, reason, temporary ? 1 : 0, expiresAt, createdBy);
  return db.prepare('SELECT * FROM allowed_sites WHERE id = ?').get(result.lastInsertRowid) as AllowedSite;
}

export function removeAllowedSite(domain: string): boolean {
  const result = db.prepare('DELETE FROM allowed_sites WHERE domain = ?').run(domain);
  return result.changes > 0;
}

// ============================================
// LOGS
// ============================================

export interface Log {
  id: number;
  extension_id?: string;
  user_id?: string;
  user_name?: string;
  action: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export function getLogs(limit = 100, offset = 0): Log[] {
  return db.prepare('SELECT * FROM logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as Log[];
}

export function getLogsByExtension(extensionId: string, limit = 100): Log[] {
  return db.prepare('SELECT * FROM logs WHERE extension_id = ? ORDER BY created_at DESC LIMIT ?').all(extensionId, limit) as Log[];
}

export function getTodayLogs(): Log[] {
  return db.prepare(`
    SELECT * FROM logs 
    WHERE date(created_at) = date('now') 
    ORDER BY created_at DESC
  `).all() as Log[];
}

export function addLog(log: Omit<Log, 'id' | 'created_at'>): Log {
  const stmt = db.prepare(`
    INSERT INTO logs (extension_id, user_id, user_name, action, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(log.extension_id, log.user_id, log.user_name, log.action, log.details, log.ip_address);
  return db.prepare('SELECT * FROM logs WHERE id = ?').get(result.lastInsertRowid) as Log;
}

export function cleanOldLogs(days: number) {
  db.prepare(`DELETE FROM logs WHERE created_at < datetime('now', '-' || ? || ' days')`).run(days);
}

// ============================================
// SOLICITACOES
// ============================================

export interface Request {
  id: string;
  extension_id?: string;
  user_id?: string;
  user_name?: string;
  site: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export function getRequests(status?: string): Request[] {
  if (status) {
    return db.prepare('SELECT * FROM requests WHERE status = ? ORDER BY created_at DESC').all(status) as Request[];
  }
  return db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all() as Request[];
}

export function getRequest(id: string): Request | undefined {
  return db.prepare('SELECT * FROM requests WHERE id = ?').get(id) as Request | undefined;
}

export function createRequest(req: Omit<Request, 'status' | 'approved_by' | 'approved_at' | 'created_at'>): Request {
  const stmt = db.prepare(`
    INSERT INTO requests (id, extension_id, user_id, user_name, site, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(req.id, req.extension_id, req.user_id, req.user_name, req.site, req.reason);
  return getRequest(req.id)!;
}

export function updateRequestStatus(id: string, status: 'approved' | 'rejected', approvedBy: string): Request | undefined {
  db.prepare(`
    UPDATE requests SET 
      status = ?, 
      approved_by = ?, 
      approved_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(status, approvedBy, id);
  return getRequest(id);
}

// ============================================
// ADMINS
// ============================================

export interface Admin {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  name?: string;
  role: 'superadmin' | 'admin' | 'viewer';
  last_login?: string;
  created_at: string;
}

export function getAdminByUsername(username: string): Admin | undefined {
  return db.prepare('SELECT * FROM admins WHERE username = ?').get(username) as Admin | undefined;
}

export function updateAdminLastLogin(id: number) {
  db.prepare('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

// ============================================
// SESSOES
// ============================================

export interface Session {
  id: string;
  admin_id: number;
  expires_at: string;
  created_at: string;
}

export function createSession(adminId: number, expiresInHours = 24): Session {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
  
  db.prepare(`
    INSERT INTO sessions (id, admin_id, expires_at)
    VALUES (?, ?, ?)
  `).run(id, adminId, expiresAt);
  
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session;
}

export function getSession(id: string): (Session & { admin: Admin }) | undefined {
  const session = db.prepare(`
    SELECT s.*, a.username, a.name, a.role 
    FROM sessions s 
    JOIN admins a ON s.admin_id = a.id 
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).get(id) as any;
  
  if (!session) return undefined;
  
  return {
    id: session.id,
    admin_id: session.admin_id,
    expires_at: session.expires_at,
    created_at: session.created_at,
    admin: {
      id: session.admin_id,
      username: session.username,
      name: session.name,
      role: session.role
    } as Admin
  };
}

export function deleteSession(id: string): boolean {
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  return result.changes > 0;
}

export function cleanExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

// ============================================
// CONFIGURACOES
// ============================================

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

// ============================================
// ESTATISTICAS
// ============================================

export function getStats() {
  const extensions = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN status = "online" THEN 1 ELSE 0 END) as online FROM extensions').get() as { total: number; online: number };
  const users = db.prepare('SELECT COUNT(*) as total FROM users').get() as { total: number };
  const blocked = db.prepare('SELECT COUNT(*) as total FROM blocked_sites').get() as { total: number };
  const pendingRequests = db.prepare('SELECT COUNT(*) as total FROM requests WHERE status = "pending"').get() as { total: number };
  const todayLogs = db.prepare("SELECT COUNT(*) as total FROM logs WHERE date(created_at) = date('now')").get() as { total: number };

  return {
    extensions: extensions.total,
    extensionsOnline: extensions.online || 0,
    users: users.total,
    blockedSites: blocked.total,
    pendingRequests: pendingRequests.total,
    todayLogs: todayLogs.total
  };
}

export default db;
