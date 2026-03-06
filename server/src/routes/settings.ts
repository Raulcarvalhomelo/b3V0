// ============================================
// SITE BLOCKER - SETTINGS ROUTES
// ============================================

import * as db from '../database/db';
import { validateSession } from './auth';
import { broadcastConfigUpdate } from '../websocket';

export default async function settingsRoutes(req: Request, url: URL): Promise<Response> {
  // Validar autenticacao
  const session = await validateSession(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = url.pathname.replace('/api/settings', '');

  // GET /api/settings
  if (path === '' && req.method === 'GET') {
    return Response.json(db.getAllSettings());
  }

  // PUT /api/settings
  if (path === '' && req.method === 'PUT') {
    const body = await req.json();
    
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        db.setSetting(key, value);
      } else {
        db.setSetting(key, JSON.stringify(value));
      }
    }

    db.addLog({
      user_name: session.admin.username,
      action: 'UPDATE_SETTINGS',
      details: JSON.stringify(body)
    });

    broadcastConfigUpdate();
    return Response.json(db.getAllSettings());
  }

  // GET /api/settings/:key
  const keyMatch = path.match(/^\/([^\/]+)$/);
  if (keyMatch && req.method === 'GET') {
    const value = db.getSetting(keyMatch[1]);
    if (value === undefined) {
      return Response.json({ error: 'Setting not found' }, { status: 404 });
    }
    return Response.json({ key: keyMatch[1], value });
  }

  // PUT /api/settings/:key
  if (keyMatch && req.method === 'PUT') {
    const body = await req.json();
    const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);
    
    db.setSetting(keyMatch[1], value);

    db.addLog({
      user_name: session.admin.username,
      action: 'UPDATE_SETTING',
      details: JSON.stringify({ key: keyMatch[1], value })
    });

    broadcastConfigUpdate();
    return Response.json({ key: keyMatch[1], value });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
