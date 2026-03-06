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

// Obter parametros da URL
const urlParams = new URLSearchParams(window.location.search);
const blockedSite = urlParams.get('site') || 'Site desconhecido';
const blockReason = urlParams.get('reason') || 'Site nao permitido';

// Inicializacao
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Exibir informacoes do site bloqueado
  blockedSiteEl.textContent = blockedSite;
  blockReasonEl.textContent = blockReason;

  // Event listeners
  requestForm.addEventListener('submit', handleSubmit);
  backBtn.addEventListener('click', goBack);

  // Registrar acesso bloqueado no log
  logBlockedAccess();
}

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

  // Enviar solicitacao
  await sendMessage('ADD_REQUEST', { site: blockedSite, reason });

  // Liberar acesso temporario (30 minutos)
  await sendMessage('GRANT_TEMP_ACCESS', { site: blockedSite, duration: 30 });

  // Buscar ultimo dominio do historico de rastreio e adicionar aos permitidos com wildcard
  const history = await sendMessage('GET_BROWSING_HISTORY', {});
  if (history && history.length > 0) {
    const lastEntry = history[0]; // ja ordenado por timestamp decrescente
    const lastDomain = lastEntry.domain.replace(/^\*\./, ''); // limpar possivel wildcard existente
    const wildcardDomain = `*.${lastDomain}`;
    await sendMessage('ADD_ALLOWED_SITE', {
      domain: wildcardDomain,
      reason: `Adicionado automaticamente apos solicitacao de liberacao`
    });
  }

  // Mostrar mensagem de sucesso
  showSuccess();
}

function showSuccess() {
  requestFormContainer.style.display = 'none';
  successMessage.classList.add('active');

  // Countdown e redirecionamento
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
  // Extrair dominio limpo
  let url = blockedSite;
  
  // Adicionar protocolo se necessario
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Redirecionar
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
