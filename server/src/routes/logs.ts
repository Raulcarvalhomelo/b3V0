// ============================================
// SITE BLOCKER - LOGS ROUTES
// ============================================

import * as db from '../database/db';
import { validateSession } from './auth';

export default async function logsRoutes(req: Request, url: URL): Promise<Response> {
  // Validar autenticacao
  const session = await validateSession(req);
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = url.pathname.replace('/api/logs', '');

  // GET /api/logs
  if (path === '' && req.method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    const logs = db.getLogs(limit, offset);
    return Response.json(logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    })));
  }

  // GET /api/logs/today
  if (path === '/today' && req.method === 'GET') {
    const logs = db.getTodayLogs();
    return Response.json(logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    })));
  }

  // GET /api/logs/extension/:id
  const extMatch = path.match(/^\/extension\/([^\/]+)$/);
  if (extMatch && req.method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const logs = db.getLogsByExtension(extMatch[1], limit);
    return Response.json(logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    })));
  }

  // GET /api/logs/export
  if (path === '/export' && req.method === 'GET') {
    const format = url.searchParams.get('format') || 'json';
    const logs = db.getLogs(10000, 0);

    if (format === 'csv') {
      const csv = logsToCSV(logs);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="logs.csv"'
        }
      });
    }

    if (format === 'html') {
      const html = logsToHTML(logs);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': 'attachment; filename="logs.html"'
        }
      });
    }

    return Response.json(logs);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

function logsToCSV(logs: db.Log[]): string {
  const headers = ['ID', 'Data/Hora', 'Usuario', 'Acao', 'Detalhes', 'IP', 'Extensao'];
  const rows = logs.map(log => [
    log.id,
    log.created_at,
    log.user_name || '',
    log.action,
    log.details || '',
    log.ip_address || '',
    log.extension_id || ''
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
}

function logsToHTML(logs: db.Log[]): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Logs - Site Blocker</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f5f5f5; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #e5e7eb; }
  </style>
</head>
<body>
  <h1>Logs de Acesso - Site Blocker</h1>
  <p>Exportado em: ${new Date().toLocaleString('pt-BR')}</p>
  <p>Total de registros: ${logs.length}</p>
  <table>
    <thead>
      <tr>
        <th>Data/Hora</th>
        <th>Usuario</th>
        <th>Acao</th>
        <th>Detalhes</th>
        <th>Extensao</th>
      </tr>
    </thead>
    <tbody>
      ${logs.map(log => `
        <tr>
          <td>${new Date(log.created_at).toLocaleString('pt-BR')}</td>
          <td>${log.user_name || '-'}</td>
          <td><span class="badge">${log.action}</span></td>
          <td>${log.details || '-'}</td>
          <td>${log.extension_id || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
  `;
}
