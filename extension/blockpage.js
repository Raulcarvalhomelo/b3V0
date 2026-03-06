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

  // Extrair o dominio do site bloqueado
  let domain = blockedSite;
  domain = domain.replace(/^https?:\/\//, ''); // Remover protocolo
  domain = domain.split('/')[0]; // Remover path
  domain = domain.replace(/^www\./, ''); // Remover www
  
  // Pegar dominio base (ex: mail.google.com -> google.com)
  const parts = domain.split('.');
  if (parts.length > 2) {
    domain = parts.slice(-2).join('.');
  }

  // Registrar solicitacao
  await sendMessage('ADD_REQUEST', { site: blockedSite, reason });

  // Adicionar site na lista de permitidos com wildcard (*.dominio.com)
  await sendMessage('ADD_ALLOWED_SITE', {
    domain: `*.${domain}`,
    reason: `Liberado via solicitacao: ${reason}`
  });

  // Liberar acesso temporario - NAO desativa o Bloquear Tudo, apenas adiciona excecao
  await sendMessage('GRANT_TEMP_ACCESS', { site: domain, duration: 30 });

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
