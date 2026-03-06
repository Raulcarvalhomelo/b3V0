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

  // Extrair o dominio base do site bloqueado para criar wildcard
  // Ex: "facebook.com" -> "*.facebook.com"
  // Ex: "www.facebook.com" -> "*.facebook.com"
  let baseDomain = blockedSite;
  
  // Remover protocolo se existir
  baseDomain = baseDomain.replace(/^https?:\/\//, '');
  
  // Remover path se existir
  baseDomain = baseDomain.split('/')[0];
  
  // Remover www. se existir para pegar o dominio base
  baseDomain = baseDomain.replace(/^www\./, '');
  
  // Remover subdominio se houver mais de 2 partes (ex: mail.google.com -> google.com)
  const parts = baseDomain.split('.');
  if (parts.length > 2) {
    // Manter apenas os ultimos 2 niveis (dominio.tld)
    baseDomain = parts.slice(-2).join('.');
  }
  
  const wildcardDomain = `*.${baseDomain}`;

  // Adicionar site com wildcard na lista de permitidos
  // NOTA: Isso NAO desativa o modo "Bloquear Tudo" - apenas adiciona uma excecao
  await sendMessage('ADD_ALLOWED_SITE', {
    domain: wildcardDomain,
    reason: `Solicitacao de liberacao: ${reason}`
  });

  // Liberar acesso temporario (30 minutos) - isso adiciona excecao ao blockAllMode sem desativa-lo
  await sendMessage('GRANT_TEMP_ACCESS', { site: baseDomain, duration: 30 });

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
