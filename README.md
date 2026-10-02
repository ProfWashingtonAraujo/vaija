# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev and build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Backend Python (FastAPI)

O backend principal fica em `services/api/` e usa Python/FastAPI com PostgreSQL e Redis para gerenciar autenticacao, pedidos, usuarios, produtos, categorias, plataforma SaaS e impressao. Ele substituiu o backend em Go (o codigo antigo continua no historico do git).

Estrutura atual:

- `services/api/main.py`: bootstrap do servidor, CORS e routers
- `services/api/routers/`: rotas HTTP (`auth`, `catalog`, `orders`, `users`, `platform`, `printer`)
- `services/api/models.py` e `schemas.py`: tabelas SQLAlchemy e contratos Pydantic
- `services/api/auth.py`: cookies, JWT e dependencias de autenticacao
- `services/api/user_utils.py`: papeis, permissoes e categorias por tipo de negocio

Modulos atuais:

- `auth`: login real e sessao com cookies HTTP-only
- `orders`: kanban de pedidos e notificacao de status
- `catalog`: produtos e categorias do cardapio

Scripts:

- `npm run dev` inicia o frontend
- `npm run dev:api` inicia o backend FastAPI em `http://localhost:3002` (requer dependencias de `services/api/requirements.txt`)
- `npm run dev:all` inicia frontend e backend juntos
- `npm run server` inicia o backend FastAPI sem reload
- `./scripts/start-local.ps1` sobe banco, backend e frontend
- `./scripts/stop-local.ps1` derruba a stack local

Banco local com Docker:

- `docker-compose up -d`
- Postgres local em `localhost:5432`
- Banco padrao: `vaija`
- Usuario: `postgres`
- Senha: `postgres`

Banco para producao com Docker:

- `docker-compose -f docker-compose.prod.yml up -d`
- defina `POSTGRES_PASSWORD`, `AUTH_JWT_SECRET` e `FRONTEND_ORIGIN` no ambiente antes de subir
- opcionais: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PORT`, `BACKEND_PORT`

Endpoints:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `POST /api/users/change-password`
- `GET /api/categories`
- `PUT /api/categories`
- `GET /api/products`
- `PUT /api/products`
- `GET /api/orders`
- `PUT /api/orders`
- `GET /api/printer/config`
- `PUT /api/printer/config`
- `POST /api/printer/test`
- `GET /api/printer/status`
- `POST /api/printer/print-order`

Durante o desenvolvimento, o Vite encaminha `/api` para `http://localhost:3002`.

Variaveis do backend:

- `DATABASE_URL`: conexao do Postgres
- `BACKEND_PORT`: porta HTTP do backend
- `AUTH_JWT_SECRET`: segredo do token JWT
- `INTERNAL_API_KEY`: chave compartilhada entre API e servico de pagamentos
- `APP_ENV`: use `production` para habilitar validacoes obrigatorias de seguranca
- `SEED_DEMO_DATA`: cria dados e usuarios de demonstracao somente quando `true`
- `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`: criam ou atualizam o administrador SaaS
- `AUTH_REFRESH_DAYS`: duracao do refresh token em dias
- `AUTH_COOKIE_SECURE`: usar cookie secure em producao
- `COOKIE_SAME_SITE`: politica SameSite dos cookies de auth
- `FRONTEND_ORIGIN`: origem permitida no CORS para o frontend
- `N8N_ORDER_STATUS_WEBHOOK_URL`: webhook do n8n
- `REDIS_URL`: conexao do Redis usada pela fila de impressao
- `PRINTER_IP`, `PRINTER_PORT`, `PRINTER_MODEL`: configuracao da impressora
- `PRINT_COPIES`: numero de vias impressas pelo worker
- `VITE_OFFLINE_MODE`: use `true` apenas para demonstracao sem backend

O backend cria as tabelas automaticamente. Dados de demonstracao so sao criados com `SEED_DEMO_DATA=true`.

Bootstrap local do banco:

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `docker/postgres/init/001-create-database.sql`

Backup e restore do Postgres:

- backup: `./scripts/backup-postgres.ps1`
- restore: `./scripts/restore-postgres.ps1 -BackupFile ./backups/arquivo.sql`
- os scripts usam `docker exec` no container do Postgres

Login inicial de desenvolvimento com `SEED_DEMO_DATA=true`:

- E-mail: `contato@taperaspizzaria.com.br`
- Senha: `123456`

Auth atual:

- `access token` em cookie HTTP-only
- `refresh token` em cookie HTTP-only com rotacao
- refresh automatico no frontend quando a API retorna `401`
- papeis com permissoes: `admin`, `manager`, `operator`

## Deploy Render + Vercel

Arquitetura recomendada:

- frontend no Vercel
- backend no Render
- Postgres no Render

Arquivos de deploy:

- `render.yaml`

Passos:

1. No Render, crie o serviço a partir de `render.yaml`.
2. No Render, defina `FRONTEND_ORIGIN` com a URL do Vercel, por exemplo `https://vaija.vercel.app`.
3. No Render, defina `INTERNAL_API_KEY`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`.
4. No Vercel, defina `VITE_API_BASE_URL` com a URL pública do backend no Render.
5. Em produção, mantenha `AUTH_COOKIE_SECURE=true` e `COOKIE_SAME_SITE=none`.

Sem isso, o login com cookies entre Vercel e Render nao funciona corretamente.

## n8n + WhatsApp

Existe um workflow de exemplo em `n8n/order-status-whatsapp.json` para enviar mensagem no WhatsApp quando o status do pedido mudar.

Arquivos relacionados:

- `.env.example`
- `services/api/routers/orders.py`
- `n8n/order-status-whatsapp.json`

Como usar:

1. Importe `n8n/order-status-whatsapp.json` no n8n.
2. No n8n, configure as variaveis de ambiente `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` para a WhatsApp Cloud API da Meta.
3. Publique o workflow e copie a URL do webhook `POST`.
4. Suba o Postgres local com `docker-compose up -d`.
5. Crie seu `.env` local a partir de `.env.example` e preencha `DATABASE_URL` e `N8N_ORDER_STATUS_WEBHOOK_URL`.
6. Inicie o backend com `npm run dev:server` ou use `docker compose up -d api`.
7. Ao mudar o status de um pedido na tela de `Pedidos`, o frontend salva no backend e o backend envia o payload para o n8n.

Payload enviado pelo backend:

```json
{
  "orderId": 4852,
  "customer": "Ricardo Oliveira",
  "phone": "11999994852",
  "rawPhone": "(11) 99999-4852",
  "status": "Em producao",
  "items": ["Pepperoni Premium", "Coca-Cola 600ml"],
  "value": 84.9,
  "payment": "Pix",
  "time": "19:42",
  "elapsed": "8 min"
}
```

Observacao: o disparo do n8n sai do backend, que evita expor a URL do webhook no cliente e deixa a automacao em um ponto mais apropriado.
