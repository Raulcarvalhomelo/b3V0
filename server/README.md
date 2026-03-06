# Site Blocker - Servidor Dashboard (VPS)

Dashboard administrativo para gerenciamento centralizado do Site Blocker.

## Requisitos

- Bun.js >= 1.0
- SQLite3

## Instalacao

```bash
cd server

# Instalar dependencias
bun install

# Inicializar banco de dados
bun run src/database/init.ts

# Iniciar servidor
bun run src/index.ts
```

## Configuracao

Variaveis de ambiente (opcional):

```bash
PORT=3000              # Porta do servidor HTTP
WS_PORT=3001           # Porta do WebSocket
JWT_SECRET=seu-secret  # Chave para JWT
```

## API Endpoints

### Autenticacao
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Usuario atual

### Extensoes
- `GET /api/extensions` - Listar extensoes conectadas
- `POST /api/extensions/sync` - Sincronizar dados com extensoes

### Usuarios
- `GET /api/users` - Listar usuarios
- `POST /api/users` - Criar usuario
- `PUT /api/users/:id` - Atualizar usuario
- `DELETE /api/users/:id` - Remover usuario

### Sites
- `GET /api/sites/blocked` - Sites bloqueados
- `POST /api/sites/blocked` - Adicionar site bloqueado
- `DELETE /api/sites/blocked/:id` - Remover site bloqueado
- `GET /api/sites/allowed` - Sites permitidos
- `POST /api/sites/allowed` - Adicionar site permitido
- `DELETE /api/sites/allowed/:id` - Remover site permitido

### Logs
- `GET /api/logs` - Listar logs
- `GET /api/logs/export` - Exportar logs

### Solicitacoes
- `GET /api/requests` - Listar solicitacoes
- `POST /api/requests/:id/approve` - Aprovar solicitacao
- `POST /api/requests/:id/reject` - Rejeitar solicitacao

## WebSocket

O servidor WebSocket permite comunicacao em tempo real com as extensoes.

### Eventos

**Servidor -> Extensao:**
- `sync` - Sincronizar dados
- `block_site` - Bloquear site
- `allow_site` - Permitir site

**Extensao -> Servidor:**
- `register` - Registrar extensao
- `status` - Status da extensao
- `request` - Nova solicitacao de liberacao

## Dashboard Frontend

O frontend React esta em `frontend/`. Para desenvolvimento:

```bash
cd frontend
bun install
bun run dev
```

Para build:

```bash
bun run build
```

Os arquivos de build serao copiados para `../public/` e servidos pelo servidor.

## Estrutura do Banco de Dados

### Tabelas

- `users` - Usuarios do sistema
- `extensions` - Extensoes registradas
- `blocked_sites` - Sites bloqueados
- `allowed_sites` - Sites permitidos
- `logs` - Logs de atividade
- `requests` - Solicitacoes de liberacao
- `settings` - Configuracoes do sistema

## Seguranca

- Senhas armazenadas com bcrypt
- Sessoes JWT com expiracao
- Rate limiting nas APIs
- CORS configuravel
