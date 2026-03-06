// ============================================
// SITE BLOCKER - EXTENSIONS ROUTES
// ============================================

import * as db from '../database/db';
import { validateSession } from './auth';
import { getConnectedClients, sendToExtension, broadcastConfigUpdate } from '../websocket';

export default async function extensionsRoutes(req: Request, url: URL): Promise<Response> {
  // Validar autenticacao
  const session = await validateSession(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = url.pathname.replace('/api/extensions', '');

  // GET /api/extensions
  if (path === '' && req.method === 'GET') {
    const extensions = db.getExtensions();
    const connectedClients = getConnectedClients();
    
    // Enriquecer com status de conexao real
    const enriched = extensions.map(ext => ({
      ...ext,
      isConnected: connectedClients.some(c => c.extensionId === ext.id),
      config: ext.config ? JSON.parse(ext.config) : null
    }));

    return Response.json(enriched);
  }

  // GET /api/extensions/connected
  if (path === '/connected' && req.method === 'GET') {
    return Response.json(getConnectedClients());
  }

  // GET /api/extensions/stats
  if (path === '/stats' && req.method === 'GET') {
    return Response.json(db.getStats());
  }

  // GET /api/extensions/:id
  const idMatch = path.match(/^\/([^\/]+)$/);
  if (idMatch && req.method === 'GET') {
    const extension = db.getExtension(idMatch[1]);
    if (!extension) {
      return Response.json({ error: 'Extension not found' }, { status: 404 });
    }
    
    const logs = db.getLogsByExtension(idMatch[1], 50);
    
    return Response.json({
      ...extension,
      config: extension.config ? JSON.parse(extension.config) : null,
      recentLogs: logs
    });
  }

  // POST /api/extensions/:id/sync
  const syncMatch = path.match(/^\/([^\/]+)\/sync$/);
  if (syncMatch && req.method === 'POST') {
    const extensionId = syncMatch[1];
    
    const sent = sendToExtension(extensionId, {
      type: 'CONFIG_UPDATE',
      payload: {
        blockedSites: db.getBlockedSites(),
        allowedSites: db.getAllowedSites(),
        settings: db.getAllSettings()
      }
    });

    if (sent) {
      return Response.json({ success: true, message: 'Config sent to extension' });
    } else {
      return Response.json({ success: false, message: 'Extension not connected' }, { status: 400 });
    }
  }

  // POST /api/extensions/sync-all
  if (path === '/sync-all' && req.method === 'POST') {
    broadcastConfigUpdate();
    return Response.json({ success: true, message: 'Config broadcast to all extensions' });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
