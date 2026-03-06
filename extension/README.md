# Site Blocker - Extensao Chrome/Edge

Sistema de bloqueio de sites para ambiente corporativo.

## Instalacao

1. Abra o navegador Chrome ou Edge
2. Acesse `chrome://extensions` (Chrome) ou `edge://extensions` (Edge)
3. Ative o "Modo de desenvolvedor" no canto superior direito
4. Clique em "Carregar sem compactacao"
5. Selecione a pasta `extension`

## Funcionalidades

### Bloqueio de Sites
- Bloqueio por dominio com suporte a wildcard (`*.google.com`)
- Lista de sites permitidos (whitelist)
- Bloqueio total com excecoes (modo "Bloquear Tudo")

### Liberacao Temporaria
- Usuarios podem solicitar liberacao de sites bloqueados
- Liberacao automatica por 30 minutos apos solicitacao
- A solicitacao fica registrada para revisao do admin

### Rastreio de Navegacao
- Historico de todos os sites acessados (ultimas 72 horas)
- Filtro por dominio
- Agrupamento por data

### Gerenciamento de Usuarios
- Cadastro de usuarios com niveis (user, manager, admin)
- Permissoes individuais por usuario

### Logs e Auditoria
- Registro de todas as acoes administrativas
- Retencao de 15 dias
- Exportacao em HTML

### Backup
- Exportacao completa das configuracoes em JSON
- Importacao de backup

## Configuracao Inicial

1. Clique no icone da extensao
2. Clique em "Area Administrativa"
3. Configure a senha de admin (primeira vez)
4. Configure o nome da empresa e links rapidos

## Adicionar Sites

### Sites Bloqueados
Na aba "Sites", clique em "Adicionar" e informe:
- Um ou mais dominios (separados por `;` ou nova linha)
- Motivo do bloqueio

Exemplos:
```
facebook.com
instagram.com; twitter.com
*.tiktok.com
```

### Sites Permitidos
Use a mesma logica para adicionar sites permitidos.
Wildcards funcionam para permitir todos os subdominios:
```
*.google.com
*.youtube.com; *.caixa.gov.br
```

## Integracao com Servidor (Opcional)

Configure a URL do servidor VPS nas configuracoes para sincronizar:
- Listas de bloqueio/permissao
- Usuarios
- Logs

O servidor deve estar rodando e acessivel via WebSocket.
