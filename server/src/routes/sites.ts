// ============================================
// SITE BLOCKER - SITES ROUTES
// ============================================

import * as db from '../database/db';
import { validateSession } from './auth';
import { broadcastConfigUpdate } from '../websocket';

export default async function sitesRoutes(req: Request, url: URL): Promise<Response> {
  // Validar autenticacao
  const session = await validateSession(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = url.pathname.replace('/api/sites', '');

  // ============================================
  // BLOCKED SITES
  // ============================================

  // GET /api/sites/blocked
  if (path === '/blocked' && req.method === 'GET') {
    return Response.json(db.getBlockedSites());
  }

  // POST /api/sites/blocked
  if (path === '/blocked' && req.method === 'POST') {
    const body = await req.json();
    
    if (!body.domain) {
      return Response.json({ error: 'Domain is required' }, { status: 400 });
    }

    try {
      const site = db.addBlockedSite(
        body.domain,
        body.reason,
        body.wildcard !== false,
        session.admin.username
      );

      db.addLog({
        user_name: session.admin.username,
        action: 'ADD_BLOCKED_SITE',
        details: JSON.stringify({ domain: body.domain, reason: body.reason })
      });

      broadcastConfigUpdate();
      return Response.json(site, { status: 201 });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE')) {
        return Response.json({ error: 'Site already blocked' }, { status: 400 });
      }
      throw error;
    }
  }

  // DELETE /api/sites/blocked/:domain
  const blockedMatch = path.match(/^\/blocked\/(.+)$/);
  if (blockedMatch && req.method === 'DELETE') {
    const domain = decodeURIComponent(blockedMatch[1]);
    const deleted = db.removeBlockedSite(domain);
    
    if (!deleted) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    db.addLog({
      user_name: session.admin.username,
      action: 'REMOVE_BLOCKED_SITE',
      details: JSON.stringify({ domain })
    });

    broadcastConfigUpdate();
    return Response.json({ success: true });
  }

  // ============================================
  // ALLOWED SITES
  // ============================================

  // GET /api/sites/allowed
  if (path === '/allowed' && req.method === 'GET') {
    return Response.json(db.getAllowedSites());
  }

  // POST /api/sites/allowed
  if (path === '/allowed' && req.method === 'POST') {
    const body = await req.json();
    
    if (!body.domain) {
      return Response.json({ error: 'Domain is required' }, { status: 400 });
    }

    try {
      const site = db.addAllowedSite(
        body.domain,
        body.reason,
        body.temporary || false,
        body.expiresAt,
        session.admin.username
      );

      db.addLog({
        user_name: session.admin.username,
        action: 'ADD_ALLOWED_SITE',
        details: JSON.stringify({ domain: body.domain, reason: body.reason })
      });

      broadcastConfigUpdate();
      return Response.json(site, { status: 201 });
    } catch (error: any) {
      if (error.message?.includes('UNIQUE')) {
        return Response.json({ error: 'Site already allowed' }, { status: 400 });
      }
      throw error;
    }
  }

  // DELETE /api/sites/allowed/:domain
  const allowedMatch = path.match(/^\/allowed\/(.+)$/);
  if (allowedMatch && req.method === 'DELETE') {
    const domain = decodeURIComponent(allowedMatch[1]);
    const deleted = db.removeAllowedSite(domain);
    
    if (!deleted) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    db.addLog({
      user_name: session.admin.username,
      action: 'REMOVE_ALLOWED_SITE',
      details: JSON.stringify({ domain })
    });

    broadcastConfigUpdate();
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
