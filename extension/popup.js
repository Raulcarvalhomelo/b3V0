// ============================================
// SITE BLOCKER - POPUP SCRIPT
// ============================================

let isAdminLoggedIn = false;
let currentConfig = null;

const mainView = document.getElementById('main-view');
const adminPanel = document.getElementById('admin-panel');
const adminBtn = document.getElementById('admin-btn');
const loginForm = document.getElementById('login-form');
const setupForm = document.getElementById('setup-form');
const companyName = document.getElementById('company-name');
const quickLinksContainer = document.getElementById('quick-links');
const blockedCount = document.getElementById('blocked-count');
const requestsCount = document.getElementById('requests-count');

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadConfig();
  await loadStats();
  setupEventListeners();
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function loadConfig() {
  currentConfig = await sendMessage('GET_CONFIG');

  if (currentConfig) {
    companyName.textContent = currentConfig.companyName || 'Site Blocker';
    renderQuickLinks(currentConfig.quickLinks || []);
  }
}

async function loadStats() {
  const [blockedSites, requests] = await Promise.all([
    sendMessage('GET_BLOCKED_SITES'),
    sendMessage('GET_REQUESTS')
  ]);

  blockedCount.textContent = blockedSites?.length || 0;

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  requestsCount.textContent = pendingRequests.length;
}

function renderQuickLinks(links) {
  if (!links.length) {
    quickLinksContainer.innerHTML = `
      <div class="empty-state" style="padding: 16px;">
        <p>Nenhum link configurado</p>
      </div>
    `;
    return;
  }

  quickLinksContainer.innerHTML = links.map(link => `
    <a href="${escapeHtml(link.url)}" target="_blank" class="quick-link">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      <span>${escapeHtml(link.name)}</span>
      <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </a>
  `).join('');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  adminBtn.addEventListener('click', handleAdminClick);

  document.getElementById('cancel-login').addEventListener('click', hideLoginForm);
  document.getElementById('submit-login').addEventListener('click', handleLogin);
  document.getElementById('admin-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  document.getElementById('submit-setup').addEventListener('click', handleSetup);
  document.getElementById('confirm-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSetup();
  });
}

async function handleAdminClick() {
  const result = await sendMessage('VERIFY_PASSWORD', { password: '' });

  if (result.needsSetup) {
    showSetupForm();
  } else {
    showLoginForm();
  }
}

function showLoginForm() {
  loginForm.classList.add('active');
  setupForm.classList.remove('active');
  adminBtn.style.display = 'none';
  document.getElementById('admin-password').focus();
  document.getElementById('login-error').classList.remove('active');
}

function hideLoginForm() {
  loginForm.classList.remove('active');
  adminBtn.style.display = 'flex';
  document.getElementById('admin-password').value = '';
}

function showSetupForm() {
  setupForm.classList.add('active');
  loginForm.classList.remove('active');
  adminBtn.style.display = 'none';
  document.getElementById('new-password').focus();
}

async function handleLogin() {
  const password = document.getElementById('admin-password').value;

  if (!password) {
    showLoginError('Digite a senha');
    return;
  }

  const result = await sendMessage('VERIFY_PASSWORD', { password });

  if (result.valid) {
    isAdminLoggedIn = true;
    hideLoginForm();
    showAdminPanel();
  } else {
    showLoginError('Senha incorreta');
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  }
}

async function handleSetup() {
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const errorEl = document.getElementById('setup-error');

  if (!newPassword || newPassword.length < 4) {
    errorEl.textContent = 'A senha deve ter pelo menos 4 caracteres';
    errorEl.classList.add('active');
    return;
  }

  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'As senhas nao conferem';
    errorEl.classList.add('active');
    return;
  }

  await sendMessage('SET_PASSWORD', { password: newPassword });

  setupForm.classList.remove('active');
  isAdminLoggedIn = true;
  showAdminPanel();
}

function showLoginError(message) {
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = message;
  errorEl.classList.add('active');
}

// ============================================
// ADMIN PANEL
// ============================================

function showAdminPanel() {
  mainView.classList.add('hidden');
  adminPanel.classList.add('active');
  renderAdminPanel();
}

function hideAdminPanel() {
  mainView.classList.remove('hidden');
  adminPanel.classList.remove('active');
  isAdminLoggedIn = false;
  loadStats();
}

async function renderAdminPanel() {
  const [blockedSites, allowedSites, users, logs, requests, config] = await Promise.all([
    sendMessage('GET_BLOCKED_SITES'),
    sendMessage('GET_ALLOWED_SITES'),
    sendMessage('GET_USERS'),
    sendMessage('GET_LOGS'),
    sendMessage('GET_REQUESTS'),
    sendMessage('GET_CONFIG')
  ]);

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];

  adminPanel.innerHTML = `
    <div class="admin-container">
      <header class="admin-header">
        <button class="btn btn-ghost btn-icon" id="back-btn" title="Voltar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h2>Administracao</h2>
        <div class="admin-header-actions">
          <button class="btn btn-ghost btn-icon" id="refresh-btn" title="Atualizar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
      </header>

      <nav class="admin-tabs tabs">
        <button class="tab active" data-tab="sites">Sites</button>
        <button class="tab" data-tab="history">Rastreio</button>
        <button class="tab" data-tab="users">Usuarios</button>
        <button class="tab" data-tab="requests">
          Solicitacoes
          ${pendingRequests.length > 0 ? `<span class="badge badge-danger" style="margin-left:4px">${pendingRequests.length}</span>` : ''}
        </button>
        <button class="tab" data-tab="logs">Logs</button>
        <button class="tab" data-tab="settings">Config</button>
      </nav>

      <main class="admin-content">
        <div class="tab-content active" id="tab-sites">
          ${renderSitesTab(blockedSites, allowedSites)}
        </div>
        <div class="tab-content" id="tab-history">
          ${renderHistoryTab()}
        </div>
        <div class="tab-content" id="tab-users">
          ${renderUsersTab(users)}
        </div>
        <div class="tab-content" id="tab-requests">
          ${renderRequestsTab(requests)}
        </div>
        <div class="tab-content" id="tab-logs">
          ${renderLogsTab(logs)}
        </div>
        <div class="tab-content" id="tab-settings">
          ${renderSettingsTab(config)}
        </div>
      </main>

      <footer class="admin-footer">
        <button class="btn btn-danger btn-sm" id="block-all-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
          Bloquear Tudo
        </button>
        <button class="btn btn-success btn-sm" id="unblock-all-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Liberar Tudo
        </button>
      </footer>
    </div>
  `;

  addAdminStyles();
  setupAdminEventListeners();
}

function renderSitesTab(blocked, allowed) {
  return `
    <div class="admin-section">
      <div class="section-header">
        <h3>Sites Bloqueados (${blocked?.length || 0})</h3>
        <button class="btn btn-primary btn-sm" id="add-blocked-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Adicionar
        </button>
      </div>
      <div class="list" id="blocked-list">
        ${blocked?.length ? blocked.map(site => `
          <div class="list-item">
            <div class="list-item-content">
              <span class="list-item-title">${escapeHtml(site.domain)}</span>
              <span class="list-item-subtitle">${escapeHtml(site.reason || 'Sem motivo')}</span>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-ghost btn-sm remove-blocked" data-domain="${escapeHtml(site.domain)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `).join('') : '<div class="empty-state"><p>Nenhum site bloqueado</p></div>'}
      </div>
    </div>

    <div class="admin-section mt-md">
      <div class="section-header">
        <h3>Sites Permitidos (${allowed?.length || 0})</h3>
        <button class="btn btn-success btn-sm" id="add-allowed-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Adicionar
        </button>
      </div>
      <div class="list" id="allowed-list">
        ${allowed?.length ? allowed.map(site => `
          <div class="list-item">
            <div class="list-item-content">
              <span class="list-item-title">${escapeHtml(site.domain)}</span>
              <span class="list-item-subtitle">
                ${site.temporary ? `<span class="badge badge-warning">Temporario</span>` : escapeHtml(site.reason || '')}
              </span>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-ghost btn-sm remove-allowed" data-domain="${escapeHtml(site.domain)}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `).join('') : '<div class="empty-state"><p>Nenhum site permitido</p></div>'}
      </div>
    </div>
  `;
}

function renderUsersTab(users) {
  return `
    <div class="admin-section">
      <div class="section-header">
        <h3>Usuarios (${users?.length || 0})</h3>
        <button class="btn btn-primary btn-sm" id="add-user-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Adicionar
        </button>
      </div>
      <div class="list" id="users-list">
        ${users?.length ? users.map(user => `
          <div class="list-item">
            <div class="list-item-content">
              <span class="list-item-title">${escapeHtml(user.name)}</span>
              <span class="list-item-subtitle">
                ${escapeHtml(user.department || 'Sem departamento')} -
                <span class="badge badge-${user.level === 'admin' ? 'danger' : user.level === 'manager' ? 'warning' : 'neutral'}">${user.level}</span>
              </span>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-ghost btn-sm edit-user" data-id="${user.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn btn-ghost btn-sm delete-user" data-id="${user.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        `).join('') : '<div class="empty-state"><p>Nenhum usuario cadastrado</p></div>'}
      </div>
    </div>
  `;
}

function renderRequestsTab(requests) {
  const pending = requests?.filter(r => r.status === 'pending') || [];
  const processed = requests?.filter(r => r.status !== 'pending') || [];

  return `
    <div class="admin-section">
      <div class="section-header">
        <h3>Pendentes (${pending.length})</h3>
      </div>
      <div class="list" id="pending-requests">
        ${pending.length ? pending.map(req => `
          <div class="list-item" style="flex-wrap: wrap;">
            <div class="list-item-content" style="flex: 1; min-width: 200px;">
              <span class="list-item-title">${escapeHtml(req.site)}</span>
              <span class="list-item-subtitle">${escapeHtml(req.user)} - ${req.date} ${req.time}</span>
              <p class="text-sm mt-xs">${escapeHtml(req.reason)}</p>
            </div>
            <div class="list-item-actions" style="gap: 8px;">
              <button class="btn btn-success btn-sm approve-request" data-id="${req.id}">Aprovar</button>
              <button class="btn btn-danger btn-sm reject-request" data-id="${req.id}">Rejeitar</button>
            </div>
          </div>
        `).join('') : '<div class="empty-state"><p>Nenhuma solicitacao pendente</p></div>'}
      </div>
    </div>

    <div class="admin-section mt-md">
      <div class="section-header">
        <h3>Historico</h3>
      </div>
      <div class="list" id="processed-requests">
        ${processed.length ? processed.slice(0, 10).map(req => `
          <div class="list-item">
            <div class="list-item-content">
              <span class="list-item-title">${escapeHtml(req.site)}</span>
              <span class="list-item-subtitle">${escapeHtml(req.user)} - ${req.date}</span>
            </div>
            <span class="badge badge-${req.status === 'approved' ? 'success' : 'danger'}">
              ${req.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
            </span>
          </div>
        `).join('') : '<div class="empty-state"><p>Nenhum historico</p></div>'}
      </div>
    </div>
  `;
}

// ============================================
// HISTORY TAB
// ============================================

function renderHistoryTab() {
  return `
    <div class="admin-section">
      <div class="section-header">
        <h3>Historico de Navegacao (ultimas 72h)</h3>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" id="refresh-history-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Atualizar
          </button>
          <button class="btn btn-secondary btn-sm" id="export-history-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Exportar CSV
          </button>
          <button class="btn btn-danger btn-sm" id="clear-history-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Limpar
          </button>
        </div>
      </div>

      <div class="input-group mb-md">
        <input type="text" class="input" id="history-filter" placeholder="Filtrar por dominio...">
      </div>

      <div id="history-list-container">
        <div class="text-center text-muted p-md">Carregando historico...</div>
      </div>
    </div>
  `;
}

async function loadHistoryList(filter = '') {
  const history = await sendMessage('GET_BROWSING_HISTORY', { domain: filter });
  const container = document.getElementById('history-list-container');

  if (!container) return;

  // Agrupar por data
  const groupedByDate = {};
  history.forEach(entry => {
    if (!groupedByDate[entry.date]) groupedByDate[entry.date] = [];
    groupedByDate[entry.date].push(entry);
  });

  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum registro de navegacao</p></div>';
    return;
  }

  let html = '';
  for (const [date, entries] of Object.entries(groupedByDate)) {
    const uniqueDomains = [...new Set(entries.map(e => e.domain))];

    html += `
      <div class="mb-md">
        <h4 style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px; padding: 4px 0; border-bottom: 1px solid var(--border);">
          ${date} &mdash; ${entries.length} acessos (${uniqueDomains.length} sites)
        </h4>
        <div class="table-container" style="max-height: 200px; overflow-y: auto;">
          <table style="font-size: 11px;">
            <thead>
              <tr>
                <th style="width: 54px;">Hora</th>
                <th>Site / URL</th>
                <th style="width: 70px;">Usuario</th>
              </tr>
            </thead>
            <tbody>
              ${entries.slice(0, 50).map(entry => `
                <tr>
                  <td style="white-space:nowrap;">${entry.time}</td>
                  <td>
                    <a href="${escapeHtml(entry.url)}" target="_blank"
                       style="color: var(--primary); text-decoration: none; font-weight: 500;">
                      ${escapeHtml(entry.domain)}
                    </a>
                    <div style="font-size:10px; color: var(--text-muted); word-break:break-all; margin-top:1px;">
                      ${escapeHtml(entry.url)}
                    </div>
                  </td>
                  <td>${escapeHtml(entry.user || '-')}</td>
                </tr>
              `).join('')}
              ${entries.length > 50
                ? `<tr><td colspan="3" class="text-center text-muted">... e mais ${entries.length - 50} registros</td></tr>`
                : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ============================================
// LOGS TAB
// ============================================

function renderLogsTab(logs) {
  const todayLogs = logs?.filter(log => {
    const today = new Date().toLocaleDateString('pt-BR');
    return log.date === today;
  }) || [];

  return `
    <div class="admin-section">
      <div class="section-header">
        <h3>Logs de Hoje (${todayLogs.length})</h3>
        <button class="btn btn-secondary btn-sm" id="export-logs-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar
        </button>
      </div>
      <div class="table-container" style="max-height: 300px; overflow-y: auto;">
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Usuario</th>
              <th>Acao</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            ${todayLogs.length ? todayLogs.reverse().map(log => `
              <tr>
                <td>${log.time}</td>
                <td>${escapeHtml(log.user || '-')}</td>
                <td><span class="badge badge-neutral">${log.action}</span></td>
                <td class="truncate" style="max-width: 150px;">${escapeHtml(JSON.stringify(log.details || {}))}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" class="text-center text-muted">Nenhum log hoje</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================
// SETTINGS TAB
// ============================================

function renderSettingsTab(config) {
  return `
    <div class="admin-section">
      <h3 class="mb-md">Configuracoes Gerais</h3>

      <div class="input-group mb-md">
        <label for="company-name-input">Nome da Empresa</label>
        <input type="text" class="input" id="company-name-input" value="${escapeHtml(config?.companyName || '')}" placeholder="Nome da empresa">
      </div>

      <div class="input-group mb-md">
        <label for="vps-url-input">URL do Servidor VPS</label>
        <input type="text" class="input" id="vps-url-input" value="${escapeHtml(config?.vpsUrl || '')}" placeholder="wss://seu-servidor.com">
      </div>

      <button class="btn btn-primary" id="save-config-btn">Salvar Configuracoes</button>
    </div>

    <div class="admin-section mt-lg">
      <h3 class="mb-md">Links Rapidos</h3>
      <div id="quick-links-config">
        ${(config?.quickLinks || []).map((link, i) => `
          <div class="flex gap-sm mb-sm quick-link-item">
            <input type="text" class="input" style="flex:1" value="${escapeHtml(link.name)}" placeholder="Nome" data-index="${i}" data-field="name">
            <input type="text" class="input" style="flex:2" value="${escapeHtml(link.url)}" placeholder="URL" data-index="${i}" data-field="url">
            <button class="btn btn-ghost btn-sm remove-quick-link" data-index="${i}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-secondary btn-sm mt-sm" id="add-quick-link-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Adicionar Link
      </button>
    </div>

    <div class="admin-section mt-lg">
      <h3 class="mb-md">Backup e Restauracao</h3>
      <div class="flex gap-sm">
        <button class="btn btn-secondary" id="export-backup-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar Backup
        </button>
        <button class="btn btn-secondary" id="import-backup-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Importar Backup
        </button>
        <input type="file" id="backup-file-input" accept=".json" style="display: none;">
      </div>
    </div>

    <div class="admin-section mt-lg">
      <h3 class="mb-md">Seguranca</h3>
      <button class="btn btn-warning" id="change-password-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Alterar Senha Admin
      </button>
    </div>
  `;
}

function addAdminStyles() {
  if (document.getElementById('admin-styles')) return;

  const style = document.createElement('style');
  style.id = 'admin-styles';
  style.textContent = `
    .admin-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 500px;
    }
    .admin-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      border-bottom: 1px solid var(--border);
      background-color: var(--surface);
    }
    .admin-header h2 {
      flex: 1;
      font-size: 16px;
    }
    .admin-tabs {
      padding: 0 var(--spacing-md);
      overflow-x: auto;
      white-space: nowrap;
    }
    .admin-tabs .tab {
      font-size: 12px;
      padding: var(--spacing-sm) var(--spacing-sm);
    }
    .admin-content {
      flex: 1;
      padding: var(--spacing-md);
      overflow-y: auto;
    }
    .admin-section {
      margin-bottom: var(--spacing-md);
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-sm);
    }
    .section-header h3 {
      font-size: 13px;
      color: var(--text-secondary);
    }
    .admin-footer {
      display: flex;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      border-top: 1px solid var(--border);
      background-color: var(--surface);
    }
    .admin-footer .btn {
      flex: 1;
    }
  `;
  document.head.appendChild(style);
}

function setupAdminEventListeners() {
  document.getElementById('back-btn').addEventListener('click', hideAdminPanel);
  document.getElementById('refresh-btn').addEventListener('click', renderAdminPanel);

  document.querySelectorAll('.admin-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('block-all-btn').addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja bloquear TODOS os sites?')) {
      await sendMessage('BLOCK_ALL');
      renderAdminPanel();
    }
  });

  document.getElementById('unblock-all-btn').addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja liberar TODOS os sites?')) {
      await sendMessage('UNBLOCK_ALL');
      renderAdminPanel();
    }
  });

  setupSitesListeners();
  setupHistoryListeners();
  setupUsersListeners();
  setupRequestsListeners();
  setupLogsListeners();
  setupSettingsListeners();
}

function setupSitesListeners() {
  document.getElementById('add-blocked-btn')?.addEventListener('click', () => {
    showModal('Adicionar Sites Bloqueados', `
      <div class="input-group mb-md">
        <label for="blocked-domains">Dominios (um por linha ou separados por ;)</label>
        <textarea class="input" id="blocked-domains" rows="4" placeholder="facebook.com&#10;instagram.com&#10;ou: facebook.com; instagram.com" style="resize: vertical; min-height: 80px;"></textarea>
        <small style="color: var(--text-muted); font-size: 11px; margin-top: 4px; display: block;">Use * para wildcard: *.google.com</small>
      </div>
      <div class="input-group mb-md">
        <label for="blocked-reason">Motivo</label>
        <input type="text" class="input" id="blocked-reason" placeholder="Motivo do bloqueio">
      </div>
    `, async () => {
      const domainsText = document.getElementById('blocked-domains').value.trim();
      const reason = document.getElementById('blocked-reason').value.trim();

      if (domainsText) {
        const domains = domainsText.split(/[;\n]/).map(d => d.trim()).filter(d => d.length > 0);
        for (const domain of domains) {
          await sendMessage('ADD_BLOCKED_SITE', { domain, reason, wildcard: true });
        }
        hideModal();
        renderAdminPanel();
      }
    });
  });

  document.getElementById('add-allowed-btn')?.addEventListener('click', () => {
    showModal('Adicionar Sites Permitidos', `
      <div class="input-group mb-md">
        <label for="allowed-domains">Dominios (um por linha ou separados por ;)</label>
        <textarea class="input" id="allowed-domains" rows="4" placeholder="*.google.com&#10;*.youtube.com&#10;ou: *.google.com; *.youtube.com" style="resize: vertical; min-height: 80px;"></textarea>
        <small style="color: var(--text-muted); font-size: 11px; margin-top: 4px; display: block;">Use * para wildcard: *.caixa.gov.br</small>
      </div>
      <div class="input-group mb-md">
        <label for="allowed-reason">Motivo</label>
        <input type="text" class="input" id="allowed-reason" placeholder="Motivo da permissao">
      </div>
    `, async () => {
      const domainsText = document.getElementById('allowed-domains').value.trim();
      const reason = document.getElementById('allowed-reason').value.trim();

      if (domainsText) {
        const domains = domainsText.split(/[;\n]/).map(d => d.trim()).filter(d => d.length > 0);
        for (const domain of domains) {
          await sendMessage('ADD_ALLOWED_SITE', { domain, reason });
        }
        hideModal();
        renderAdminPanel();
      }
    });
  });

  document.querySelectorAll('.remove-blocked').forEach(btn => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.domain;
      if (confirm(`Remover ${domain} da lista de bloqueados?`)) {
        await sendMessage('REMOVE_BLOCKED_SITE', { domain });
        renderAdminPanel();
      }
    });
  });

  document.querySelectorAll('.remove-allowed').forEach(btn => {
    btn.addEventListener('click', async () => {
      const domain = btn.dataset.domain;
      if (confirm(`Remover ${domain} da lista de permitidos?`)) {
        await sendMessage('REMOVE_ALLOWED_SITE', { domain });
        renderAdminPanel();
      }
    });
  });
}

function setupUsersListeners() {
  document.getElementById('add-user-btn')?.addEventListener('click', () => {
    showModal('Adicionar Usuario', `
      <div class="input-group mb-md">
        <label for="user-name">Nome</label>
        <input type="text" class="input" id="user-name" placeholder="Nome do usuario">
      </div>
      <div class="input-group mb-md">
        <label for="user-department">Departamento</label>
        <input type="text" class="input" id="user-department" placeholder="Departamento">
      </div>
      <div class="input-group mb-md">
        <label for="user-level">Nivel</label>
        <select class="input" id="user-level">
          <option value="user">Usuario</option>
          <option value="manager">Gerente</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div class="input-group mb-md">
        <label for="user-windows">Usuario Windows</label>
        <input type="text" class="input" id="user-windows" placeholder="nome.usuario">
      </div>
    `, async () => {
      const name = document.getElementById('user-name').value.trim();
      const department = document.getElementById('user-department').value.trim();
      const level = document.getElementById('user-level').value;
      const windowsUser = document.getElementById('user-windows').value.trim();

      if (name) {
        await sendMessage('ADD_USER', { name, department, level, windowsUser });
        hideModal();
        renderAdminPanel();
      }
    });
  });

  document.querySelectorAll('.delete-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja excluir este usuario?')) {
        await sendMessage('DELETE_USER', { userId: btn.dataset.id });
        renderAdminPanel();
      }
    });
  });
}

function setupRequestsListeners() {
  document.querySelectorAll('.approve-request').forEach(btn => {
    btn.addEventListener('click', async () => {
      await sendMessage('APPROVE_REQUEST', { requestId: btn.dataset.id, adminName: 'Admin' });
      renderAdminPanel();
    });
  });

  document.querySelectorAll('.reject-request').forEach(btn => {
    btn.addEventListener('click', async () => {
      await sendMessage('REJECT_REQUEST', { requestId: btn.dataset.id, adminName: 'Admin' });
      renderAdminPanel();
    });
  });
}

function setupHistoryListeners() {
  // Carregar historico ao abrir a aba
  const historyTab = document.querySelector('[data-tab="history"]');
  if (historyTab) {
    historyTab.addEventListener('click', () => {
      setTimeout(() => loadHistoryList(), 100);
    });
  }

  // Atualizar
  document.getElementById('refresh-history-btn')?.addEventListener('click', () => {
    const filter = document.getElementById('history-filter')?.value || '';
    loadHistoryList(filter);
  });

  // Exportar CSV
  document.getElementById('export-history-btn')?.addEventListener('click', async () => {
    const filter = document.getElementById('history-filter')?.value || '';
    const history = await sendMessage('GET_BROWSING_HISTORY', { domain: filter });
    exportHistoryToCSV(history);
  });

  // Limpar historico
  document.getElementById('clear-history-btn')?.addEventListener('click', async () => {
    if (confirm('Tem certeza que deseja limpar todo o historico de navegacao?')) {
      await sendMessage('CLEAR_BROWSING_HISTORY');
      loadHistoryList();
    }
  });

  // Filtro com debounce
  let filterTimeout;
  document.getElementById('history-filter')?.addEventListener('input', (e) => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => loadHistoryList(e.target.value), 300);
  });
}

function setupLogsListeners() {
  document.getElementById('export-logs-btn')?.addEventListener('click', async () => {
    const logs = await sendMessage('GET_LOGS');
    const content = generateLogsHTML(logs);
    downloadFile('logs.html', content, 'text/html');
  });
}

function setupSettingsListeners() {
  document.getElementById('save-config-btn')?.addEventListener('click', async () => {
    const companyNameVal = document.getElementById('company-name-input').value.trim();
    const vpsUrl = document.getElementById('vps-url-input').value.trim();

    const quickLinks = [];
    document.querySelectorAll('.quick-link-item').forEach(item => {
      const name = item.querySelector('[data-field="name"]').value.trim();
      const url = item.querySelector('[data-field="url"]').value.trim();
      if (name && url) quickLinks.push({ name, url });
    });

    await sendMessage('UPDATE_CONFIG', { companyName: companyNameVal, vpsUrl, quickLinks });
    alert('Configuracoes salvas!');
    loadConfig();
  });

  document.getElementById('add-quick-link-btn')?.addEventListener('click', () => {
    const container = document.getElementById('quick-links-config');
    const index = container.children.length;
    const div = document.createElement('div');
    div.className = 'flex gap-sm mb-sm quick-link-item';
    div.innerHTML = `
      <input type="text" class="input" style="flex:1" placeholder="Nome" data-index="${index}" data-field="name">
      <input type="text" class="input" style="flex:2" placeholder="URL" data-index="${index}" data-field="url">
      <button class="btn btn-ghost btn-sm remove-quick-link" data-index="${index}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    container.appendChild(div);
    div.querySelector('.remove-quick-link').addEventListener('click', () => div.remove());
  });

  document.querySelectorAll('.remove-quick-link').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.quick-link-item').remove());
  });

  document.getElementById('export-backup-btn')?.addEventListener('click', async () => {
    const backup = await sendMessage('EXPORT_BACKUP');
    downloadFile('site-blocker-backup.json', JSON.stringify(backup, null, 2), 'application/json');
  });

  document.getElementById('import-backup-btn')?.addEventListener('click', () => {
    document.getElementById('backup-file-input').click();
  });

  document.getElementById('backup-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (confirm('Isso substituira todas as configuracoes atuais. Continuar?')) {
          await sendMessage('IMPORT_BACKUP', backup);
          alert('Backup importado com sucesso!');
          renderAdminPanel();
        }
      } catch (err) {
        alert('Erro ao ler arquivo de backup');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('change-password-btn')?.addEventListener('click', () => {
    showModal('Alterar Senha', `
      <div class="input-group mb-md">
        <label for="new-admin-password">Nova Senha</label>
        <input type="password" class="input" id="new-admin-password" placeholder="Digite a nova senha">
      </div>
      <div class="input-group mb-md">
        <label for="confirm-admin-password">Confirmar Senha</label>
        <input type="password" class="input" id="confirm-admin-password" placeholder="Confirme a senha">
      </div>
    `, async () => {
      const newPassword = document.getElementById('new-admin-password').value;
      const confirmPassword = document.getElementById('confirm-admin-password').value;

      if (newPassword.length < 4) {
        alert('A senha deve ter pelo menos 4 caracteres');
        return;
      }
      if (newPassword !== confirmPassword) {
        alert('As senhas nao conferem');
        return;
      }

      await sendMessage('SET_PASSWORD', { password: newPassword });
      alert('Senha alterada com sucesso!');
      hideModal();
    });
  });
}

// ============================================
// MODAL
// ============================================

function showModal(title, content, onConfirm) {
  const modalHtml = `
    <div class="modal-overlay active" id="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="modal-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
          <button class="btn btn-primary" id="modal-confirm">Confirmar</button>
        </div>
      </div>
    </div>
  `;

  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);

  document.getElementById('modal-close').addEventListener('click', hideModal);
  document.getElementById('modal-cancel').addEventListener('click', hideModal);
  document.getElementById('modal-confirm').addEventListener('click', onConfirm);
}

function hideModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.parentElement.remove();
}

// ============================================
// UTILITIES
// ============================================

async function sendMessage(action, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, payload }, resolve);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta o historico de navegacao como CSV.
 * @param {Array} history - Entradas do historico (ordenadas por timestamp desc)
 */
function exportHistoryToCSV(history) {
  if (!history || history.length === 0) {
    alert('Nenhum registro para exportar.');
    return;
  }

  const headers = ['Data', 'Hora', 'Usuario', 'Dominio', 'URL Completa'];
  const rows = history.map(entry => [
    entry.date,
    entry.time,
    entry.user || '-',
    entry.domain,
    entry.url
  ]);

  // Escapar campos com virgula ou aspas
  const escapeCSV = (value) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [headers, ...rows]
    .map(row => row.map(escapeCSV).join(','))
    .join('\n');

  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  downloadFile(`historico_navegacao_${timestamp}.csv`, csvContent, 'text/csv;charset=utf-8;');
}

function generateLogsHTML(logs) {
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
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>Logs de Acesso - Site Blocker</h1>
      <p>Exportado em: ${new Date().toLocaleString('pt-BR')}</p>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Hora</th>
            <th>Usuario</th>
            <th>Acao</th>
            <th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr>
              <td>${log.date}</td>
              <td>${log.time}</td>
              <td>${escapeHtml(log.user || '-')}</td>
              <td>${log.action}</td>
              <td>${escapeHtml(JSON.stringify(log.details || {}))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
}
