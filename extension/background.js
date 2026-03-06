// ============================================
// SITE BLOCKER - SERVICE WORKER (BACKGROUND)
// ============================================

// Constantes
const RULE_START_ID = 1000;
const LOG_RETENTION_DAYS = 15;
const STORAGE_KEYS = {
  CONFIG: 'config',
  USERS: 'users',
  LOGS: 'logs',
  REQUESTS: 'requests',
  BLOCKED_SITES: 'blocked_sites',
  ALLOWED_SITES: 'allowed_sites',
  CURRENT_USER: 'current_user',
  BROWSING_HISTORY: 'browsing_history'
};

// Constante para retencao do historico (72 horas)
const HISTORY_RETENTION_HOURS = 72;

// ============================================
// INICIALIZACAO
// ============================================

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await initializeExtension();
  }
});

async function initializeExtension() {
  // Configuracao inicial
  const defaultConfig = {
    adminPasswordHash: '',
    adminPasswordSalt: '',
    companyName: 'Empresa',
    quickLinks: [
      { name: 'Intranet', url: 'https://intranet.empresa.com' },
      { name: 'Email', url: 'https://mail.empresa.com' },
      { name: 'Suporte TI', url: 'https://suporte.empresa.com' }
    ],
    vpsUrl: '',
    wsConnected: false,
    initialized: false
  };

  const defaultBlockedSites = [
    { domain: 'facebook.com', wildcard: true, reason: 'Rede Social' },
    { domain: 'instagram.com', wildcard: true, reason: 'Rede Social' },
    { domain: 'twitter.com', wildcard: true, reason: 'Rede Social' },
    { domain: 'x.com', wildcard: true, reason: 'Rede Social' },
    { domain: 'tiktok.com', wildcard: true, reason: 'Rede Social' },
    { domain: 'youtube.com', wildcard: true, reason: 'Streaming' },
    { domain: 'netflix.com', wildcard: true, reason: 'Streaming' },
    { domain: 'twitch.tv', wildcard: true, reason: 'Streaming' }
  ];

  await chrome.storage.local.set({
    [STORAGE_KEYS.CONFIG]: defaultConfig,
    [STORAGE_KEYS.USERS]: [],
    [STORAGE_KEYS.LOGS]: [],
    [STORAGE_KEYS.REQUESTS]: [],
    [STORAGE_KEYS.BLOCKED_SITES]: defaultBlockedSites,
    [STORAGE_KEYS.ALLOWED_SITES]: [],
    [STORAGE_KEYS.CURRENT_USER]: null,
    [STORAGE_KEYS.BROWSING_HISTORY]: []
  });

  // Aplicar regras de bloqueio iniciais
  await updateBlockingRules();
}

// ============================================
// GERENCIAMENTO DE REGRAS DE BLOQUEIO
// ============================================

async function updateBlockingRules() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.BLOCKED_SITES,
      STORAGE_KEYS.ALLOWED_SITES,
      STORAGE_KEYS.CURRENT_USER,
      STORAGE_KEYS.USERS
    ]);

    const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];
    const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];
    const currentUser = data[STORAGE_KEYS.CURRENT_USER];
    const users = data[STORAGE_KEYS.USERS] || [];

    // Pegar permissoes do usuario atual
    let userAllowedSites = [];
    let userBlockedSites = [];

    if (currentUser) {
      const user = users.find(u => u.id === currentUser.id);
      if (user) {
        userAllowedSites = user.allowedSites || [];
        userBlockedSites = user.blockedSites || [];
      }
    }

    // Combinar sites permitidos
    const finalAllowed = [...new Set([...allowedSites.map(s => s.domain), ...userAllowedSites])];

    // Criar regras de bloqueio
    const rules = [];
    let ruleId = RULE_START_ID;

    // Primeiro: regras de permissao (prioridade maior)
    for (const domain of finalAllowed) {
      // Tratar wildcards: *.google.com -> permite todos os subdominios
      const cleanDomain = domain.replace(/^\*\./, '');
      const isWildcard = domain.startsWith('*.');
      
      rules.push({
        id: ruleId++,
        priority: 2,
        action: { type: 'allow' },
        condition: {
          urlFilter: isWildcard ? `||${cleanDomain}` : `||${domain}`,
          resourceTypes: ['main_frame', 'sub_frame']
        }
      });
    }

    // Depois: regras de bloqueio
    const allBlocked = [...blockedSites, ...userBlockedSites.map(d => ({ domain: d, wildcard: true }))];
    
    for (const site of allBlocked) {
      // Tratar wildcards no dominio
      const cleanDomain = site.domain.replace(/^\*\./, '');
      const isWildcardDomain = site.domain.startsWith('*.');
      
      // Pular se estiver na lista de permitidos
      const isAllowed = finalAllowed.some(allowed => {
        const cleanAllowed = allowed.replace(/^\*\./, '');
        // Verifica correspondencia exata ou de subdominios
        return cleanDomain === cleanAllowed || 
               cleanDomain.endsWith('.' + cleanAllowed) ||
               cleanAllowed.endsWith('.' + cleanDomain) ||
               (allowed.startsWith('*.') && cleanDomain.endsWith(cleanAllowed));
      });
      
      if (isAllowed) {
        continue;
      }

      // Usar formato correto para wildcard
      const urlFilter = (site.wildcard || isWildcardDomain) ? `||${cleanDomain}` : `|https://${site.domain}|`;
      
      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            extensionPath: `/blockpage.html?site=${encodeURIComponent(site.domain)}&reason=${encodeURIComponent(site.reason || 'Site bloqueado')}`
          }
        },
        condition: {
          urlFilter: urlFilter,
          resourceTypes: ['main_frame']
        }
      });
    }

    // Remover regras dinamicas existentes, EXCETO a regra 999999 (Bloquear Tudo)
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id).filter(id => id !== 999999);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: rules
    });

    console.log(`[SiteBlocker] ${rules.length} regras aplicadas`);
  } catch (error) {
    console.error('[SiteBlocker] Erro ao atualizar regras:', error);
  }
}

// ============================================
// GERENCIAMENTO DE LOGS
// ============================================

async function addLog(action, details) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.LOGS, STORAGE_KEYS.CURRENT_USER]);
  const logs = data[STORAGE_KEYS.LOGS] || [];
  const currentUser = data[STORAGE_KEYS.CURRENT_USER];

  const newLog = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('pt-BR'),
    time: new Date().toLocaleTimeString('pt-BR'),
    action: action,
    details: details,
    user: currentUser ? currentUser.name : 'Desconhecido',
    userId: currentUser ? currentUser.id : null
  };

  logs.push(newLog);

  // Limpar logs antigos
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);
  
  const filteredLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= cutoffDate;
  });

  await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: filteredLogs });
  return newLog;
}

// ============================================
// GERENCIAMENTO DE SOLICITACOES
// ============================================

async function addRequest(site, reason) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.REQUESTS, STORAGE_KEYS.CURRENT_USER]);
  const requests = data[STORAGE_KEYS.REQUESTS] || [];
  const currentUser = data[STORAGE_KEYS.CURRENT_USER];

  const newRequest = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('pt-BR'),
    time: new Date().toLocaleTimeString('pt-BR'),
    site: site,
    reason: reason,
    user: currentUser ? currentUser.name : 'Desconhecido',
    userId: currentUser ? currentUser.id : null,
    status: 'pending', // pending, approved, rejected
    approvedAt: null,
    approvedBy: null
  };

  requests.push(newRequest);
  await chrome.storage.local.set({ [STORAGE_KEYS.REQUESTS]: requests });

  // Registrar no log
  await addLog('REQUEST', { site, reason });

  return newRequest;
}

async function approveRequest(requestId, adminName) {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.REQUESTS,
    STORAGE_KEYS.ALLOWED_SITES
  ]);
  
  const requests = data[STORAGE_KEYS.REQUESTS] || [];
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];

  const requestIndex = requests.findIndex(r => r.id === requestId);
  if (requestIndex === -1) return null;

  const request = requests[requestIndex];
  request.status = 'approved';
  request.approvedAt = new Date().toISOString();
  request.approvedBy = adminName;

  // Adicionar site a lista de permitidos
  if (!allowedSites.some(s => s.domain === request.site)) {
    allowedSites.push({
      domain: request.site,
      addedAt: new Date().toISOString(),
      addedBy: adminName,
      reason: `Solicitacao aprovada: ${request.reason}`
    });
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.REQUESTS]: requests,
    [STORAGE_KEYS.ALLOWED_SITES]: allowedSites
  });

  // Atualizar regras de bloqueio
  await updateBlockingRules();

  // Registrar no log
  await addLog('APPROVE_REQUEST', { site: request.site, requestId });

  return request;
}

async function rejectRequest(requestId, adminName) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.REQUESTS]);
  const requests = data[STORAGE_KEYS.REQUESTS] || [];

  const requestIndex = requests.findIndex(r => r.id === requestId);
  if (requestIndex === -1) return null;

  const request = requests[requestIndex];
  request.status = 'rejected';
  request.approvedAt = new Date().toISOString();
  request.approvedBy = adminName;

  await chrome.storage.local.set({ [STORAGE_KEYS.REQUESTS]: requests });

  // Registrar no log
  await addLog('REJECT_REQUEST', { site: request.site, requestId });

  return request;
}

// ============================================
// GERENCIAMENTO DE SITES
// ============================================

async function addBlockedSite(domain, reason, wildcard = true) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.BLOCKED_SITES]);
  const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];

  // Verificar se ja existe
  if (blockedSites.some(s => s.domain === domain)) {
    return { success: false, message: 'Site ja esta na lista de bloqueados' };
  }

  blockedSites.push({
    domain: domain,
    wildcard: wildcard,
    reason: reason,
    addedAt: new Date().toISOString()
  });

  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: blockedSites });
  await updateBlockingRules();
  await addLog('ADD_BLOCKED', { domain, reason });

  return { success: true };
}

async function removeBlockedSite(domain) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.BLOCKED_SITES]);
  const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];

  const filtered = blockedSites.filter(s => s.domain !== domain);
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: filtered });
  await updateBlockingRules();
  await addLog('REMOVE_BLOCKED', { domain });

  return { success: true };
}

async function addAllowedSite(domain, reason) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.ALLOWED_SITES]);
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];

  if (allowedSites.some(s => s.domain === domain)) {
    return { success: false, message: 'Site ja esta na lista de permitidos' };
  }

  allowedSites.push({
    domain: domain,
    reason: reason,
    addedAt: new Date().toISOString()
  });

  await chrome.storage.local.set({ [STORAGE_KEYS.ALLOWED_SITES]: allowedSites });
  await updateBlockingRules();
  await addLog('ADD_ALLOWED', { domain, reason });

  return { success: true };
}

async function removeAllowedSite(domain) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.ALLOWED_SITES]);
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];

  const filtered = allowedSites.filter(s => s.domain !== domain);
  await chrome.storage.local.set({ [STORAGE_KEYS.ALLOWED_SITES]: filtered });
  await updateBlockingRules();
  await addLog('REMOVE_ALLOWED', { domain });

  return { success: true };
}

// ============================================
// GERENCIAMENTO DE USUARIOS
// ============================================

async function addUser(userData) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.USERS]);
  const users = data[STORAGE_KEYS.USERS] || [];

  const newUser = {
    id: Date.now().toString(),
    name: userData.name,
    department: userData.department || '',
    level: userData.level || 'user', // admin, manager, user
    windowsUser: userData.windowsUser || '',
    allowedSites: userData.allowedSites || [],
    blockedSites: userData.blockedSites || [],
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  await chrome.storage.local.set({ [STORAGE_KEYS.USERS]: users });
  await addLog('ADD_USER', { name: newUser.name });

  return newUser;
}

async function updateUser(userId, updates) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.USERS]);
  const users = data[STORAGE_KEYS.USERS] || [];

  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) return null;

  users[userIndex] = { ...users[userIndex], ...updates };
  await chrome.storage.local.set({ [STORAGE_KEYS.USERS]: users });
  await updateBlockingRules();
  await addLog('UPDATE_USER', { userId, updates });

  return users[userIndex];
}

async function deleteUser(userId) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.USERS]);
  const users = data[STORAGE_KEYS.USERS] || [];

  const user = users.find(u => u.id === userId);
  const filtered = users.filter(u => u.id !== userId);
  
  await chrome.storage.local.set({ [STORAGE_KEYS.USERS]: filtered });
  await addLog('DELETE_USER', { userId, name: user?.name });

  return { success: true };
}

// ============================================
// AUTENTICACAO ADMIN
// ============================================

async function hashPassword(password, salt = null) {
  if (!salt) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    salt = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

  return { hash, salt };
}

async function verifyPassword(password) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.CONFIG]);
  const config = data[STORAGE_KEYS.CONFIG];

  if (!config.adminPasswordHash || !config.adminPasswordSalt) {
    return { valid: false, needsSetup: true };
  }

  const { hash } = await hashPassword(password, config.adminPasswordSalt);
  return { valid: hash === config.adminPasswordHash, needsSetup: false };
}

async function setAdminPassword(password) {
  const { hash, salt } = await hashPassword(password);
  
  const data = await chrome.storage.local.get([STORAGE_KEYS.CONFIG]);
  const config = data[STORAGE_KEYS.CONFIG];
  
  config.adminPasswordHash = hash;
  config.adminPasswordSalt = salt;
  config.initialized = true;

  await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });
  await addLog('SET_PASSWORD', { action: 'Admin password configured' });

  return { success: true };
}

// ============================================
// BACKUP E RESTORE
// ============================================

async function exportBackup() {
  const data = await chrome.storage.local.get(null);
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    data: data
  };
}

async function importBackup(backup) {
  if (!backup.data) {
    return { success: false, message: 'Backup invalido' };
  }

  await chrome.storage.local.set(backup.data);
  await updateBlockingRules();
  await addLog('IMPORT_BACKUP', { exportedAt: backup.exportedAt });

  return { success: true };
}

// ============================================
// ACOES RAPIDAS
// ============================================

async function blockAll() {
  // Bloqueia todos os sites exceto os essenciais
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.CONFIG, 
    STORAGE_KEYS.ALLOWED_SITES,
    STORAGE_KEYS.BLOCKED_SITES
  ]);
  const config = data[STORAGE_KEYS.CONFIG];
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];
  const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];

  config.blockAllMode = true;
  await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });

  // Dominios dos quickLinks
  const quickLinkDomains = (config.quickLinks || []).map(l => {
    try { return new URL(l.url).hostname; } catch { return null; }
  }).filter(Boolean);

  // Dominios da lista de sites permitidos (sem o prefixo *.)
  const allowedDomains = allowedSites.map(s => s.domain.replace(/^\*\./, ''));

  // Dominios da lista de sites bloqueados (para verificar prioridade)
  const blockedDomains = blockedSites.map(s => s.domain.replace(/^\*\./, ''));

  // Filtrar dominios permitidos que NAO estao na lista de bloqueados
  // (Sites Bloqueados tem prioridade sobre Sites Permitidos)
  const filteredAllowedDomains = allowedDomains.filter(allowedDomain => {
    return !blockedDomains.some(blockedDomain => {
      return allowedDomain === blockedDomain || 
             allowedDomain.endsWith('.' + blockedDomain) ||
             blockedDomain.endsWith('.' + allowedDomain);
    });
  });

  // Combinar todos os dominios excluidos (quickLinks + permitidos nao bloqueados)
  const excludedDomains = [...new Set([...quickLinkDomains, ...filteredAllowedDomains])];

  // Remover regra antiga se existir e adicionar nova
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [999999],
    addRules: [{
      id: 999999,
      priority: 100,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/blockpage.html?site=all&reason=Bloqueio%20total%20ativado'
        }
      },
      condition: {
        urlFilter: '*',
        resourceTypes: ['main_frame'],
        excludedRequestDomains: excludedDomains
      }
    }]
  });

  await addLog('BLOCK_ALL', { action: 'Activated' });
  return { success: true };
}

async function unblockAll() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.CONFIG]);
  const config = data[STORAGE_KEYS.CONFIG];
  
  config.blockAllMode = false;
  await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: config });

  // Remover regra de bloqueio total
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [999999]
  });

  await addLog('UNBLOCK_ALL', { action: 'Deactivated' });
  return { success: true };
}

// ============================================
// RASTREIO DE HISTORICO DE NAVEGACAO
// ============================================

async function trackBrowsingHistory(url, title = '') {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // Ignorar URLs internas da extensao
    if (url.startsWith('chrome-extension://') || url.startsWith('chrome://')) {
      return;
    }

    const data = await chrome.storage.local.get([STORAGE_KEYS.BROWSING_HISTORY, STORAGE_KEYS.CURRENT_USER]);
    const history = data[STORAGE_KEYS.BROWSING_HISTORY] || [];
    const currentUser = data[STORAGE_KEYS.CURRENT_USER];

    const newEntry = {
      id: Date.now().toString(),
      url: url,
      domain: domain,
      title: title || domain,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR'),
      user: currentUser ? currentUser.name : 'Desconhecido',
      userId: currentUser ? currentUser.id : null
    };

    history.push(newEntry);

    // Limpar entradas antigas (mais de 72 horas)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - HISTORY_RETENTION_HOURS);
    
    const filteredHistory = history.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= cutoffDate;
    });

    await chrome.storage.local.set({ [STORAGE_KEYS.BROWSING_HISTORY]: filteredHistory });
    return newEntry;
  } catch (error) {
    console.error('[SiteBlocker] Erro ao rastrear historico:', error);
  }
}

async function getBrowsingHistory(filters = {}) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.BROWSING_HISTORY]);
  let history = data[STORAGE_KEYS.BROWSING_HISTORY] || [];

  // Aplicar filtros
  if (filters.domain) {
    history = history.filter(h => h.domain.includes(filters.domain));
  }
  if (filters.date) {
    history = history.filter(h => h.date === filters.date);
  }
  if (filters.userId) {
    history = history.filter(h => h.userId === filters.userId);
  }

  // Ordenar por timestamp decrescente
  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return history;
}

async function clearBrowsingHistory() {
  await chrome.storage.local.set({ [STORAGE_KEYS.BROWSING_HISTORY]: [] });
  await addLog('CLEAR_HISTORY', { action: 'Historico limpo' });
  return { success: true };
}

// Listener para rastrear navegacao
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Apenas frame principal
  if (details.frameId === 0) {
    try {
      const tab = await chrome.tabs.get(details.tabId);
      await trackBrowsingHistory(details.url, tab.title);
    } catch (error) {
      // Tab pode ter sido fechada
      await trackBrowsingHistory(details.url, '');
    }
  }
});

// ============================================
// LIBERACAO TEMPORARIA AUTOMATICA
// ============================================

async function grantTemporaryAccess(site, durationMinutes = 30) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.ALLOWED_SITES, STORAGE_KEYS.CONFIG]);
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];
  const config = data[STORAGE_KEYS.CONFIG] || {};

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

  // Verificar se ja existe uma liberacao temporaria para esse site
  const existingIndex = allowedSites.findIndex(s => s.domain === site && s.temporary);
  if (existingIndex >= 0) {
    // Atualizar expiracao
    allowedSites[existingIndex].expiresAt = expiresAt;
  } else {
    // Adicionar nova liberacao temporaria
    allowedSites.push({
      domain: site,
      temporary: true,
      expiresAt: expiresAt,
      addedAt: new Date().toISOString()
    });
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.ALLOWED_SITES]: allowedSites });

  // Se o modo "Bloquear Tudo" esta ativo, adicionar excecao especifica para esse site
  if (config.blockAllMode) {
    await addBlockAllException(site, expiresAt);
  } else {
    await updateBlockingRules();
  }

  await addLog('TEMP_ACCESS', { site, durationMinutes });

  // Agendar remocao
  setTimeout(async () => {
    await revokeTemporaryAccess(site);
  }, durationMinutes * 60 * 1000);

  return { success: true, expiresAt };
}

// Funcao para adicionar excecao no modo "Bloquear Tudo"
async function addBlockAllException(site, expiresAt) {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.CONFIG, 
    STORAGE_KEYS.ALLOWED_SITES,
    STORAGE_KEYS.BLOCKED_SITES
  ]);
  const config = data[STORAGE_KEYS.CONFIG] || {};
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];
  const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];

  // Pegar os dominios ja permitidos nos quickLinks
  const quickLinkDomains = (config.quickLinks || []).map(l => {
    try {
      return new URL(l.url).hostname;
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Dominios da lista de sites permitidos (sem o prefixo *.)
  const allowedDomains = allowedSites.map(s => s.domain.replace(/^\*\./, ''));

  // Dominios da lista de sites bloqueados (para verificar prioridade)
  const blockedDomains = blockedSites.map(s => s.domain.replace(/^\*\./, ''));

  // Filtrar dominios permitidos que NAO estao na lista de bloqueados
  // (Sites Bloqueados tem prioridade sobre Sites Permitidos)
  const filteredAllowedDomains = allowedDomains.filter(allowedDomain => {
    return !blockedDomains.some(blockedDomain => {
      return allowedDomain === blockedDomain || 
             allowedDomain.endsWith('.' + blockedDomain) ||
             blockedDomain.endsWith('.' + allowedDomain);
    });
  });

  // Combinar todos os dominios excluidos (quickLinks + permitidos nao bloqueados + site temporario)
  const excludedDomains = [...new Set([...quickLinkDomains, ...filteredAllowedDomains, site])];

  // Atualizar a regra de bloqueio total com a nova excecao
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [999999],
    addRules: [{
      id: 999999,
      priority: 100,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/blockpage.html?site=all&reason=Bloqueio%20total%20ativado'
        }
      },
      condition: {
        urlFilter: '*',
        resourceTypes: ['main_frame'],
        excludedRequestDomains: excludedDomains
      }
    }]
  });
}

async function revokeTemporaryAccess(site) {
  const data = await chrome.storage.local.get([STORAGE_KEYS.ALLOWED_SITES, STORAGE_KEYS.CONFIG]);
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];
  const config = data[STORAGE_KEYS.CONFIG] || {};

  const filtered = allowedSites.filter(s => !(s.domain === site && s.temporary));
  await chrome.storage.local.set({ [STORAGE_KEYS.ALLOWED_SITES]: filtered });
  
  // Se o modo "Bloquear Tudo" esta ativo, atualizar excecoes mantendo o bloqueio
  if (config.blockAllMode) {
    await refreshBlockAllExceptions();
  } else {
    await updateBlockingRules();
  }
  
  await addLog('REVOKE_TEMP_ACCESS', { site });
}

// Funcao para atualizar as excecoes do modo "Bloquear Tudo" sem desativa-lo
async function refreshBlockAllExceptions() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.CONFIG, 
    STORAGE_KEYS.ALLOWED_SITES,
    STORAGE_KEYS.BLOCKED_SITES
  ]);
  const config = data[STORAGE_KEYS.CONFIG] || {};
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];
  const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];

  // Se blockAllMode nao esta ativo, nao faz nada
  if (!config.blockAllMode) {
    return;
  }

  // Pegar os dominios ja permitidos nos quickLinks
  const quickLinkDomains = (config.quickLinks || []).map(l => {
    try {
      return new URL(l.url).hostname;
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Dominios da lista de sites permitidos (sem o prefixo *.)
  const allowedDomains = allowedSites.map(s => s.domain.replace(/^\*\./, ''));

  // Dominios da lista de sites bloqueados (para verificar prioridade)
  const blockedDomains = blockedSites.map(s => s.domain.replace(/^\*\./, ''));

  // Filtrar dominios permitidos que NAO estao na lista de bloqueados
  const filteredAllowedDomains = allowedDomains.filter(allowedDomain => {
    return !blockedDomains.some(blockedDomain => {
      return allowedDomain === blockedDomain || 
             allowedDomain.endsWith('.' + blockedDomain) ||
             blockedDomain.endsWith('.' + allowedDomain);
    });
  });

  // Combinar todos os dominios excluidos
  const excludedDomains = [...new Set([...quickLinkDomains, ...filteredAllowedDomains])];

  // Atualizar a regra de bloqueio total
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [999999],
    addRules: [{
      id: 999999,
      priority: 100,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/blockpage.html?site=all&reason=Bloqueio%20total%20ativado'
        }
      },
      condition: {
        urlFilter: '*',
        resourceTypes: ['main_frame'],
        excludedRequestDomains: excludedDomains
      }
    }]
  });
}

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Indica que a resposta sera assincrona
});

async function handleMessage(message) {
  const { action, payload } = message;

  switch (action) {
    // Autenticacao
    case 'VERIFY_PASSWORD':
      return await verifyPassword(payload.password);
    case 'SET_PASSWORD':
      return await setAdminPassword(payload.password);

    // Sites bloqueados/permitidos
    case 'GET_BLOCKED_SITES':
      return (await chrome.storage.local.get([STORAGE_KEYS.BLOCKED_SITES]))[STORAGE_KEYS.BLOCKED_SITES] || [];
    case 'GET_ALLOWED_SITES':
      return (await chrome.storage.local.get([STORAGE_KEYS.ALLOWED_SITES]))[STORAGE_KEYS.ALLOWED_SITES] || [];
    case 'ADD_BLOCKED_SITE':
      return await addBlockedSite(payload.domain, payload.reason, payload.wildcard);
    case 'REMOVE_BLOCKED_SITE':
      return await removeBlockedSite(payload.domain);
    case 'ADD_ALLOWED_SITE':
      return await addAllowedSite(payload.domain, payload.reason);
    case 'REMOVE_ALLOWED_SITE':
      return await removeAllowedSite(payload.domain);

    // Usuarios
    case 'GET_USERS':
      return (await chrome.storage.local.get([STORAGE_KEYS.USERS]))[STORAGE_KEYS.USERS] || [];
    case 'ADD_USER':
      return await addUser(payload);
    case 'UPDATE_USER':
      return await updateUser(payload.userId, payload.updates);
    case 'DELETE_USER':
      return await deleteUser(payload.userId);

    // Logs
    case 'GET_LOGS':
      return (await chrome.storage.local.get([STORAGE_KEYS.LOGS]))[STORAGE_KEYS.LOGS] || [];
    case 'ADD_LOG':
      return await addLog(payload.action, payload.details);

    // Solicitacoes
    case 'GET_REQUESTS':
      return (await chrome.storage.local.get([STORAGE_KEYS.REQUESTS]))[STORAGE_KEYS.REQUESTS] || [];
    case 'ADD_REQUEST':
      return await addRequest(payload.site, payload.reason);
    case 'APPROVE_REQUEST':
      return await approveRequest(payload.requestId, payload.adminName);
    case 'REJECT_REQUEST':
      return await rejectRequest(payload.requestId, payload.adminName);

    // Configuracao
    case 'GET_CONFIG':
      return (await chrome.storage.local.get([STORAGE_KEYS.CONFIG]))[STORAGE_KEYS.CONFIG];
    case 'UPDATE_CONFIG':
      const currentConfig = (await chrome.storage.local.get([STORAGE_KEYS.CONFIG]))[STORAGE_KEYS.CONFIG];
      const newConfig = { ...currentConfig, ...payload };
      await chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: newConfig });
      return newConfig;

    // Backup/Restore
    case 'EXPORT_BACKUP':
      return await exportBackup();
    case 'IMPORT_BACKUP':
      return await importBackup(payload);

    // Acoes rapidas
    case 'BLOCK_ALL':
      return await blockAll();
    case 'UNBLOCK_ALL':
      return await unblockAll();

    // Liberacao temporaria
    case 'GRANT_TEMP_ACCESS':
      return await grantTemporaryAccess(payload.site, payload.duration);

    // Atualizar regras
    case 'UPDATE_RULES':
      await updateBlockingRules();
      return { success: true };

    // Historico de navegacao
    case 'GET_BROWSING_HISTORY':
      return await getBrowsingHistory(payload || {});
    case 'CLEAR_BROWSING_HISTORY':
      return await clearBrowsingHistory();

    default:
      return { error: 'Unknown action' };
  }
}

// Verificar e limpar acessos temporarios expirados a cada minuto
setInterval(async () => {
  const data = await chrome.storage.local.get([STORAGE_KEYS.ALLOWED_SITES, STORAGE_KEYS.CONFIG]);
  const allowedSites = data[STORAGE_KEYS.ALLOWED_SITES] || [];
  const config = data[STORAGE_KEYS.CONFIG] || {};
  
  const now = new Date();
  const filtered = allowedSites.filter(site => {
    if (!site.temporary || !site.expiresAt) return true;
    return new Date(site.expiresAt) > now;
  });

  if (filtered.length !== allowedSites.length) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ALLOWED_SITES]: filtered });
    // Se o modo "Bloquear Tudo" esta ativo, apenas atualizar excecoes
    if (config.blockAllMode) {
      await refreshBlockAllExceptions();
    } else {
      await updateBlockingRules();
    }
  }
}, 60000);

console.log('[SiteBlocker] Service Worker initialized');
