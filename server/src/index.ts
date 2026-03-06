// ============================================
// SITE BLOCKER - MAIN SERVER
// ============================================

import { initDatabase, cleanExpiredSessions, cleanOldLogs, getSetting } from './database/db';
import { handleConnection, handleMessage, handleClose } from './websocket';
import authRoutes from './routes/auth';
import extensionsRoutes from './routes/extensions';
import usersRoutes from './routes/users';
import sitesRoutes from './routes/sites';
import logsRoutes from './routes/logs';
import requestsRoutes from './routes/requests';
import settingsRoutes from './routes/settings';

// Inicializar banco de dados
initDatabase();

// Configuracoes
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ============================================
// HTTP SERVER + WEBSOCKET
// ============================================

const server = Bun.serve({
  port: PORT,
  
  async fetch(req, server) {
    const url = new URL(req.url);
    
    // WebSocket upgrade
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, {
        data: { extensionId: null }
      });
      
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    };

    // Preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Routing
    try {
      let response: Response | null = null;

      // API Routes
      if (url.pathname.startsWith('/api/auth')) {
        response = await authRoutes(req, url);
      } else if (url.pathname.startsWith('/api/extensions')) {
        response = await extensionsRoutes(req, url);
      } else if (url.pathname.startsWith('/api/users')) {
        response = await usersRoutes(req, url);
      } else if (url.pathname.startsWith('/api/sites')) {
        response = await sitesRoutes(req, url);
      } else if (url.pathname.startsWith('/api/logs')) {
        response = await logsRoutes(req, url);
      } else if (url.pathname.startsWith('/api/requests')) {
        response = await requestsRoutes(req, url);
      } else if (url.pathname.startsWith('/api/settings')) {
        response = await settingsRoutes(req, url);
      } else if (url.pathname === '/api/health') {
        response = Response.json({ status: 'ok', timestamp: new Date().toISOString() });
      } else if (url.pathname === '/' || url.pathname === '/api') {
        response = Response.json({
          name: 'Site Blocker API',
          version: '1.0.0',
          endpoints: [
            '/api/auth',
            '/api/extensions',
            '/api/users',
            '/api/sites',
            '/api/logs',
            '/api/requests',
            '/api/settings',
            '/ws'
          ]
        });
      }

      if (response) {
        // Adicionar headers CORS
        const newHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          newHeaders.set(key, value);
        });
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('[Server] Error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  websocket: {
    open: handleConnection,
    message: handleMessage,
    close: handleClose,
    perMessageDeflate: true
  }
});

console.log(`
╔════════════════════════════════════════════╗
║       SITE BLOCKER SERVER v1.0.0           ║
╠════════════════════════════════════════════╣
║  HTTP Server: http://localhost:${PORT}        ║
║  WebSocket:   ws://localhost:${PORT}/ws       ║
╚════════════════════════════════════════════╝
`);

// ============================================
// TAREFAS PERIODICAS
// ============================================

// Limpar sessoes expiradas a cada hora
setInterval(() => {
  cleanExpiredSessions();
}, 60 * 60 * 1000);

// Limpar logs antigos uma vez por dia
setInterval(() => {
  const retentionDays = parseInt(getSetting('log_retention_days') || '15');
  cleanOldLogs(retentionDays);
}, 24 * 60 * 60 * 1000);

export default server;
