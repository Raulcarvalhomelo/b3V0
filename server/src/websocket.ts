// ============================================
// SITE BLOCKER - WEBSOCKET SERVER
// ============================================

import type { ServerWebSocket } from 'bun';
import * as db from './database/db';
import { generateId } from './utils/crypto';

interface ExtensionClient {
  ws: ServerWebSocket<{ extensionId: string }>;
  extensionId: string;
  machineName: string;
  windowsUser?: string;
  lastPing: number;
}

// Store de clientes conectados
const clients = new Map<string, ExtensionClient>();

// ============================================
// HANDLERS
// ============================================

export function handleConnection(ws: ServerWebSocket<{ extensionId: string }>) {
  console.log('[WS] New connection');
}

export function handleMessage(ws: ServerWebSocket<{ extensionId: string }>, message: string | Buffer) {
  try {
    const data = JSON.parse(message.toString());
    
    switch (data.type) {
      case 'REGISTER':
        handleRegister(ws, data.payload);
        break;
      
      case 'PING':
        handlePing(ws);
        break;
      
      case 'SYNC_LOGS':
        handleSyncLogs(ws, data.payload);
        break;
      
      case 'SYNC_REQUESTS':
        handleSyncRequests(ws, data.payload);
        break;
      
      case 'GET_CONFIG':
        handleGetConfig(ws);
        break;
      
      default:
        console.log('[WS] Unknown message type:', data.type);
    }
  } catch (error) {
    console.error('[WS] Error processing message:', error);
    sendError(ws, 'Invalid message format');
  }
}

export function handleClose(ws: ServerWebSocket<{ extensionId: string }>) {
  const extensionId = ws.data?.extensionId;
  
  if (extensionId) {
    clients.delete(extensionId);
    db.updateExtensionStatus(extensionId, 'offline');
    console.log(`[WS] Extension disconnected: ${extensionId}`);
  }
}

// ============================================
// MESSAGE HANDLERS
// ============================================

function handleRegister(ws: ServerWebSocket<{ extensionId: string }>, payload: any) {
  const extensionId = payload.extensionId || generateId();
  
  // Atualizar ou criar extensao no banco
  const extension = db.upsertExtension({
    id: extensionId,
    machine_name: payload.machineName || 'Unknown',
    windows_user: payload.windowsUser,
    ip_address: payload.ipAddress,
    status: 'online',
    version: payload.version,
    config: JSON.stringify(payload.config || {})
  });

  // Armazenar cliente
  ws.data = { extensionId };
  clients.set(extensionId, {
    ws,
    extensionId,
    machineName: payload.machineName || 'Unknown',
    windowsUser: payload.windowsUser,
    lastPing: Date.now()
  });

  // Enviar confirmacao com configuracoes atuais
  send(ws, {
    type: 'REGISTERED',
    payload: {
      extensionId,
      blockedSites: db.getBlockedSites(),
      allowedSites: db.getAllowedSites(),
      settings: db.getAllSettings()
    }
  });

  // Registrar log
  db.addLog({
    extension_id: extensionId,
    action: 'EXTENSION_CONNECTED',
    details: JSON.stringify({ machineName: payload.machineName, windowsUser: payload.windowsUser }),
    ip_address: payload.ipAddress
  });

  console.log(`[WS] Extension registered: ${extensionId} (${payload.machineName})`);
}

function handlePing(ws: ServerWebSocket<{ extensionId: string }>) {
  const extensionId = ws.data?.extensionId;
  
  if (extensionId && clients.has(extensionId)) {
    const client = clients.get(extensionId)!;
    client.lastPing = Date.now();
    
    // Atualizar last_seen no banco
    db.upsertExtension({
      id: extensionId,
      machine_name: client.machineName,
      status: 'online'
    });
  }

  send(ws, { type: 'PONG', payload: { timestamp: Date.now() } });
}

function handleSyncLogs(ws: ServerWebSocket<{ extensionId: string }>, payload: any) {
  const extensionId = ws.data?.extensionId;
  if (!extensionId) return;

  const logs = payload.logs || [];
  
  for (const log of logs) {
    db.addLog({
      extension_id: extensionId,
      user_id: log.userId,
      user_name: log.user,
      action: log.action,
      details: JSON.stringify(log.details),
      ip_address: log.ipAddress
    });
  }

  send(ws, { type: 'LOGS_SYNCED', payload: { count: logs.length } });
}

function handleSyncRequests(ws: ServerWebSocket<{ extensionId: string }>, payload: any) {
  const extensionId = ws.data?.extensionId;
  if (!extensionId) return;

  const requests = payload.requests || [];
  
  for (const req of requests) {
    // Verificar se ja existe
    const existing = db.getRequest(req.id);
    if (!existing) {
      db.createRequest({
        id: req.id,
        extension_id: extensionId,
        user_id: req.userId,
        user_name: req.user,
        site: req.site,
        reason: req.reason
      });
    }
  }

  send(ws, { type: 'REQUESTS_SYNCED', payload: { count: requests.length } });
}

function handleGetConfig(ws: ServerWebSocket<{ extensionId: string }>) {
  send(ws, {
    type: 'CONFIG',
    payload: {
      blockedSites: db.getBlockedSites(),
      allowedSites: db.getAllowedSites(),
      settings: db.getAllSettings()
    }
  });
}

// ============================================
// BROADCAST FUNCTIONS
// ============================================

export function broadcastToAll(message: object) {
  const data = JSON.stringify(message);
  
  for (const [_, client] of clients) {
    try {
      client.ws.send(data);
    } catch (error) {
      console.error(`[WS] Error sending to ${client.extensionId}:`, error);
    }
  }
}

export function broadcastConfigUpdate() {
  broadcastToAll({
    type: 'CONFIG_UPDATE',
    payload: {
      blockedSites: db.getBlockedSites(),
      allowedSites: db.getAllowedSites(),
      settings: db.getAllSettings()
    }
  });
}

export function sendToExtension(extensionId: string, message: object) {
  const client = clients.get(extensionId);
  if (client) {
    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`[WS] Error sending to ${extensionId}:`, error);
    }
  }
  return false;
}

// ============================================
// UTILITIES
// ============================================

function send(ws: ServerWebSocket<{ extensionId: string }>, message: object) {
  try {
    ws.send(JSON.stringify(message));
  } catch (error) {
    console.error('[WS] Error sending message:', error);
  }
}

function sendError(ws: ServerWebSocket<{ extensionId: string }>, error: string) {
  send(ws, { type: 'ERROR', payload: { message: error } });
}

export function getConnectedClients() {
  return Array.from(clients.values()).map(c => ({
    extensionId: c.extensionId,
    machineName: c.machineName,
    windowsUser: c.windowsUser,
    lastPing: c.lastPing
  }));
}

export function getClientCount() {
  return clients.size;
}

// Limpar clientes inativos a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutos
  
  for (const [id, client] of clients) {
    if (now - client.lastPing > timeout) {
      console.log(`[WS] Removing inactive client: ${id}`);
      clients.delete(id);
      db.updateExtensionStatus(id, 'offline');
    }
  }
}, 60000);
