// ============================================
// SITE BLOCKER - USERS ROUTES
// ============================================

import * as db from '../database/db';
import { validateSession } from './auth';
import { generateId } from '../utils/crypto';
import { broadcastConfigUpdate } from '../websocket';

export default async function usersRoutes(req: Request, url: URL): Promise<Response> {
  // Validar autenticacao
  const session = await validateSession(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = url.pathname.replace('/api/users', '');

  // GET /api/users
  if (path === '' && req.method === 'GET') {
    const users = db.getUsers();
    return Response.json(users.map(u => ({
      ...u,
      allowed_sites: u.allowed_sites ? JSON.parse(u.allowed_sites) : [],
      blocked_sites: u.blocked_sites ? JSON.parse(u.blocked_sites) : []
    })));
  }

  // POST /api/users
  if (path === '' && req.method === 'POST') {
    const body = await req.json();
    
    if (!body.name) {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    const user = db.createUser({
      id: generateId(),
      name: body.name,
      department: body.department,
      level: body.level || 'user',
      windows_user: body.windowsUser,
      allowed_sites: body.allowedSites ? JSON.stringify(body.allowedSites) : null,
      blocked_sites: body.blockedSites ? JSON.stringify(body.blockedSites) : null,
      extension_id: body.extensionId
    });

    broadcastConfigUpdate();

    return Response.json({
      ...user,
      allowed_sites: user.allowed_sites ? JSON.parse(user.allowed_sites) : [],
      blocked_sites: user.blocked_sites ? JSON.parse(user.blocked_sites) : []
    }, { status: 201 });
  }

  // GET /api/users/:id
  const idMatch = path.match(/^\/([^\/]+)$/);
  if (idMatch && req.method === 'GET') {
    const user = db.getUser(idMatch[1]);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    
    return Response.json({
      ...user,
      allowed_sites: user.allowed_sites ? JSON.parse(user.allowed_sites) : [],
      blocked_sites: user.blocked_sites ? JSON.parse(user.blocked_sites) : []
    });
  }

  // PUT /api/users/:id
  if (idMatch && req.method === 'PUT') {
    const body = await req.json();
    
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.department !== undefined) updates.department = body.department;
    if (body.level !== undefined) updates.level = body.level;
    if (body.windowsUser !== undefined) updates.windows_user = body.windowsUser;
    if (body.allowedSites !== undefined) updates.allowed_sites = JSON.stringify(body.allowedSites);
    if (body.blockedSites !== undefined) updates.blocked_sites = JSON.stringify(body.blockedSites);
    if (body.extensionId !== undefined) updates.extension_id = body.extensionId;

    const user = db.updateUser(idMatch[1], updates);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    broadcastConfigUpdate();

    return Response.json({
      ...user,
      allowed_sites: user.allowed_sites ? JSON.parse(user.allowed_sites) : [],
      blocked_sites: user.blocked_sites ? JSON.parse(user.blocked_sites) : []
    });
  }

  // DELETE /api/users/:id
  if (idMatch && req.method === 'DELETE') {
    const deleted = db.deleteUser(idMatch[1]);
    if (!deleted) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    broadcastConfigUpdate();
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
