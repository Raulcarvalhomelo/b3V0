// ============================================
// SITE BLOCKER - AUTH ROUTES
// ============================================

import * as db from '../database/db';
import { verifyPassword, hashPassword } from '../utils/crypto';

export default async function authRoutes(req: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace('/api/auth', '');

  // POST /api/auth/login
  if (path === '/login' && req.method === 'POST') {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return Response.json({ error: 'Username and password required' }, { status: 400 });
    }

    const admin = db.getAdminByUsername(username);
    if (!admin) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, admin.password_hash, admin.password_salt);
    if (!isValid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Criar sessao
    const session = db.createSession(admin.id);
    db.updateAdminLastLogin(admin.id);

    return Response.json({
      token: session.id,
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role
      },
      expiresAt: session.expires_at
    });
  }

  // POST /api/auth/logout
  if (path === '/logout' && req.method === 'POST') {
    const token = getToken(req);
    if (token) {
      db.deleteSession(token);
    }
    return Response.json({ success: true });
  }

  // GET /api/auth/me
  if (path === '/me' && req.method === 'GET') {
    const session = await validateSession(req);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return Response.json({
      user: {
        id: session.admin.id,
        username: session.admin.username,
        name: session.admin.name,
        role: session.admin.role
      }
    });
  }

  // POST /api/auth/change-password
  if (path === '/change-password' && req.method === 'POST') {
    const session = await validateSession(req);
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Response.json({ error: 'Current and new password required' }, { status: 400 });
    }

    const admin = db.getAdminByUsername(session.admin.username);
    if (!admin) {
      return Response.json({ error: 'Admin not found' }, { status: 404 });
    }

    const isValid = await verifyPassword(currentPassword, admin.password_hash, admin.password_salt);
    if (!isValid) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // Atualizar senha (seria necessario implementar updateAdminPassword no db.ts)
    const { hash, salt } = await hashPassword(newPassword);
    // TODO: Implementar atualizacao de senha no banco

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

// Helpers
function getToken(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

export async function validateSession(req: Request) {
  const token = getToken(req);
  if (!token) return null;
  return db.getSession(token);
}
