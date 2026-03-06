// ============================================
// SITE BLOCKER - REQUESTS ROUTES
// ============================================

import * as db from '../database/db';
import { validateSession } from './auth';
import { broadcastConfigUpdate, sendToExtension } from '../websocket';

export default async function requestsRoutes(req: Request, url: URL): Promise<Response> {
  // Validar autenticacao
  const session = await validateSession(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = url.pathname.replace('/api/requests', '');

  // GET /api/requests
  if (path === '' && req.method === 'GET') {
    const status = url.searchParams.get('status') || undefined;
    const requests = db.getRequests(status);
    return Response.json(requests);
  }

  // GET /api/requests/pending
  if (path === '/pending' && req.method === 'GET') {
    const requests = db.getRequests('pending');
    return Response.json(requests);
  }

  // GET /api/requests/:id
  const idMatch = path.match(/^\/([^\/]+)$/);
  if (idMatch && req.method === 'GET') {
    const request = db.getRequest(idMatch[1]);
    if (!request) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }
    return Response.json(request);
  }

  // POST /api/requests/:id/approve
  const approveMatch = path.match(/^\/([^\/]+)\/approve$/);
  if (approveMatch && req.method === 'POST') {
    const request = db.updateRequestStatus(approveMatch[1], 'approved', session.admin.username);
    
    if (!request) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    // Adicionar site a lista de permitidos
    try {
      db.addAllowedSite(request.site, `Solicitacao aprovada: ${request.reason}`, false, undefined, session.admin.username);
    } catch (error) {
      // Site ja pode estar na lista
    }

    db.addLog({
      user_name: session.admin.username,
      action: 'APPROVE_REQUEST',
      details: JSON.stringify({ requestId: request.id, site: request.site })
    });

    // Notificar extensao
    if (request.extension_id) {
      sendToExtension(request.extension_id, {
        type: 'REQUEST_APPROVED',
        payload: { requestId: request.id, site: request.site }
      });
    }

    broadcastConfigUpdate();
    return Response.json(request);
  }

  // POST /api/requests/:id/reject
  const rejectMatch = path.match(/^\/([^\/]+)\/reject$/);
  if (rejectMatch && req.method === 'POST') {
    const request = db.updateRequestStatus(rejectMatch[1], 'rejected', session.admin.username);
    
    if (!request) {
      return Response.json({ error: 'Request not found' }, { status: 404 });
    }

    db.addLog({
      user_name: session.admin.username,
      action: 'REJECT_REQUEST',
      details: JSON.stringify({ requestId: request.id, site: request.site })
    });

    // Notificar extensao
    if (request.extension_id) {
      sendToExtension(request.extension_id, {
        type: 'REQUEST_REJECTED',
        payload: { requestId: request.id, site: request.site }
      });
    }

    return Response.json(request);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
