// ============================================
// SITE BLOCKER - BLOCK PAGE SCRIPT
// ============================================

// Elementos DOM
const blockedSiteEl = document.getElementById('blocked-site');
const blockReasonEl = document.getElementById('block-reason');
const requestForm = document.getElementById('request-form');
const requestFormContainer = document.getElementById('request-form-container');
const successMessage = document.getElementById('success-message');
const countdownEl = document.getElementById('countdown');
const backBtn = document.getElementById('back-btn');
const attemptedUrlBanner = document.getElementById('attempted-url-banner');
const attemptedUrlText = document.getElementById('attempted-url-text');
const hardBlockedMessage = document.getElementById('hard-blocked-message');

// Parametros da URL
const urlParams = new URLSearchParams(window.location.search);
const blockedSite = urlParams.get('site') || 'Site desconhecido';
const blockReason = urlParams.get('reason') || 'Site nao permitido';

// Dominio que sera usado na solicitacao de liberacao.
// Por padrao e o site bloqueado dos params; pode ser sobrescrito
// pelo ultimo dominio registrado no historico de navegacao.
let siteToRequest = blockedSite;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  blockedSiteEl.textContent = blockedSite;
  blockReasonEl.textContent = blockReason;

  requestForm.addEventListener('submit', handleSubmit);
  backBtn.addEventListener('click', goBack);

  logBlockedAccess();

  // Carregar ultimo dominio tentado a partir do historico
  await loadLastAttemptedSite();
}

// ============================================
// CARREGAMENTO DO ULTIMO DOMINIO TENTADO
// ============================================

async function loadLastAttemptedSite() {
  const history = await sendMessage('GET_BROWSING_HISTORY', {});
  if (!history || history.length === 0) return;

  // Obter entrada mais recente que nao seja a propria pagina de bloqueio
  const lastEntry = history.find(e =>
    !e.url.startsWith('chrome-extension://') &&
    !e.url.includes('blockpage.html') &&
    !e.url.startsWith('chrome://')
  );

  if (!lastEntry) return;

  const cleanBlocked = blockedSite.replace(/^\*\./, '');
  const lastDomain = lastEntry.domain;

  // Usar o dominio do ultimo rastreio se for subdominio ou correspondencia
  // do dominio bloqueado (ex: mail.google.com quando google.com esta bloqueado)
  const isRelated =
    lastDomain === cleanBlocked ||
    lastDomain.endsWith('.' + cleanBlocked) ||
    cleanBlocked.endsWith('.' + lastDomain);

  if (isRelated && lastDomain !== cleanBlocked) {
    siteToRequest = lastDomain;
  }

  // Exibir a URL completa tentada
  attemptedUrlText.textContent = lastEntry.url;
  attemptedUrlBanner.style.display = 'block';
}

// ============================================
// HANDLERS
// ============================================

async function logBlockedAccess() {
  await sendMessage('ADD_LOG', {
    action: 'BLOCKED_ACCESS',
    details: { site: blockedSite, reason: blockReason }
  });
}

async function handleSubmit(e) {
  e.preventDefault();

  const reason = document.getElementById('request-reason').value.trim();

  if (!reason) {
    alert('Por favor, informe o motivo da solicitacao.');
    return;
  }

  // Registrar solicitacao
  await sendMessage('ADD_REQUEST', { site: siteToRequest, reason });

  // Tentar liberar acesso temporario (30 minutos)
  const result = await sendMessage('GRANT_TEMP_ACCESS', { site: siteToRequest, duration: 30 });

  if (result && result.blocked) {
    // Dominio esta explicitamente bloqueado - exibir mensagem de recusa
    requestForm.style.display = 'none';
    hardBlockedMessage.classList.add('active');
    return;
  }

  showSuccess();
}

function showSuccess() {
  requestFormContainer.querySelector('h2').style.display = 'none';
  requestFormContainer.querySelector('p').style.display = 'none';
  requestForm.style.display = 'none';
  successMessage.classList.add('active');

  let countdown = 5;
  countdownEl.textContent = countdown;

  const interval = setInterval(() => {
    countdown--;
    countdownEl.textContent = countdown;

    if (countdown <= 0) {
      clearInterval(interval);
      redirectToSite();
    }
  }, 1000);
}

function redirectToSite() {
  let url = siteToRequest;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  window.location.href = url;
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
}

async function sendMessage(action, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action, payload }, resolve);
  });
}
