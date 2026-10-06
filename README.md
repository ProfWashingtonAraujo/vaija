# Vaija

Plataforma SaaS multi-restaurante para pizzarias, buffets e delivery: cardápio online, PDV, kanban de pedidos, impressão de cupom, automação por WhatsApp e um painel de administração da plataforma (clientes, planos, acessos e financeiro).

- **Site (produção):** https://vaija.vercel.app
- **API (produção):** https://vaija-api-py.onrender.com

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [API](#api)
- [Funcionalidades](#funcionalidades)
- [Scripts utilitários](#scripts-utilitários)
- [Deploy: Vercel + Render + Supabase](#deploy-vercel--render--supabase)
- [n8n + WhatsApp](#n8n--whatsapp)
- [Impressão térmica](#impressão-térmica)
- [Migração do backend Go para FastAPI](#migração-do-backend-go-para-fastapi)
- [Limitações conhecidas e próximos passos](#limitações-conhecidas-e-próximos-passos)
- [Segurança](#segurança)

## Visão geral

| Área | Rota | Para quem |
|---|---|---|
| Site institucional | `/` | visitantes |
| Cardápio e pedido online | `/pedido` e `/pedido/:tenantId` (+ `/checkout`, `/acompanhar`) | clientes do restaurante |
| Painel do restaurante | `/dashboard`, `/orders`, `/pos`, `/menu`, `/reports`, `/settings`, `/operator` | equipe do restaurante |
| Painel SaaS | `/saas`, `/saas/:view`, `/saas/clientes/:tenantId` | administrador da plataforma |

Os módulos do painel do restaurante liberados dependem do **plano** do cliente (Free, Start, Pro, Premium), definido em `src/lib/plan-access.ts`.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, React Router, Recharts, Sonner. Lint com Oxlint.
- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2 (async) + asyncpg, Pydantic v2, JWT (python-jose) e bcrypt (passlib).
- **Banco:** PostgreSQL (Docker em desenvolvimento; Supabase em produção).
- **Fila de impressão:** Redis.
- **Serviços auxiliares:** `payments` (Mercado Pago/Stripe, Python) e `print-worker` (impressora térmica, Python).
- **Automação:** n8n (WhatsApp Cloud API).
- **Hospedagem:** Vercel (frontend), Render (API) e Supabase (banco).

## Arquitetura

```
 Navegador ──► Vercel (React/Vite, estático)
     │
     │  HTTPS + cookies HTTP-only (access + refresh)
     ▼
 Render: vaija-api-py (FastAPI)  ──► Supabase (PostgreSQL)
     │            │
     │            └──► Redis ──► print-worker ──► impressora térmica
     └──► webhook n8n ──► WhatsApp
 payments (Mercado Pago/Stripe) ──► chama a API com X-Internal-API-Key
```

**Multi-tenant:** cada restaurante é um `tenant_id`. Usuários, categorias, produtos e pedidos são sempre filtrados pelo tenant do token. O tenant especial `admin` é a **plataforma** (administradores do SaaS). O restaurante de demonstração usa o tenant `default`, que o frontend associa ao cliente "Taperas Pizzaria".

## Estrutura do repositório

```
src/                      Frontend (React)
  pages/                  Telas (dashboard, pos, orders, menu, saas, pedido…)
  components/             Componentes (layout, pos, menu, saas, shared, ui)
  lib/                    Clientes de API, planos, formatadores, meio a meio
  data/                   Dados de exemplo/offline
services/
  api/                    Backend principal (FastAPI)
    main.py               Bootstrap, CORS, handler de erros, routers
    routers/              auth, catalog, orders, users, platform, printer
    models.py schemas.py  Tabelas SQLAlchemy e contratos Pydantic
    auth.py               JWT, cookies, sessões, dependências de acesso
    database.py           Engine (asyncpg), RLS, bootstrap do admin
    user_utils.py         Papéis, permissões e categorias por tipo de negócio
    seed.py               Script antigo de dados de demonstração
  payments/               Serviço de pagamentos
  print-worker/           Consumidor da fila de impressão
scripts/                  PowerShell e Python utilitários
docker/postgres/init/     Criação do banco no primeiro start
n8n/                      Workflow de exemplo (WhatsApp)
docker-compose.yml        Stack local
docker-compose.prod.yml   Stack de produção em Docker
render.yaml               Blueprint do Render (API, payments, worker)
```

## Rodando localmente

Pré-requisitos: Node.js, Docker Desktop e (opcional) Python 3.12.

1. **Backend, Postgres e Redis (Docker):**
   ```bash
   docker compose up -d postgres redis api
   ```
   - API: http://localhost:3002 (`/api/health`)
   - Postgres: porta `5432` do container, publicada em `POSTGRES_PORT` (padrão `5432`)
   - Redis: `6379`
2. **Frontend:**
   ```bash
   npm install
   npm run dev
   ```
   Abre em http://localhost:5173. O Vite encaminha `/api` para `http://localhost:3002`.

Atalhos:

| Comando | O que faz |
|---|---|
| `npm run dev` | só o frontend |
| `npm run dev:api` | API FastAPI com reload na porta 3002 (precisa de `pip install -r services/api/requirements.txt`) |
| `npm run dev:all` | frontend + API juntos |
| `npm run server` | API sem reload |
| `npm run build` | `tsc -b` + build de produção |
| `npm run lint` | Oxlint |
| `./scripts/start-local.ps1` / `stop-local.ps1` | sobe/derruba a stack local (Windows) |

> No Windows, algumas políticas de segurança bloqueiam extensões nativas de pacotes Python no `.venv`. Se o `uvicorn` local falhar ao importar o SQLAlchemy, rode a API pelo Docker (`docker compose up -d api`).

**Primeiro acesso local:** o banco começa vazio. Defina `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` (senha com 12 ou mais caracteres) no ambiente da API para criar o administrador da plataforma na primeira subida. Veja também [Scripts utilitários](#scripts-utilitários) para redefinir a senha depois.

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste. Principais variáveis:

**Backend (`services/api`)**

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão Postgres. Aceita `postgresql://`, `postgres://` e `?sslmode=require`; hosts do Supabase usam TLS automaticamente |
| `BACKEND_PORT` | Porta local (3002) |
| `AUTH_JWT_SECRET` | Segredo do JWT. **Obrigatório trocar em produção** |
| `INTERNAL_API_KEY` | Chave compartilhada entre API e `payments` (header `X-Internal-API-Key`) |
| `APP_ENV` | `development` ou `production` |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Criam o primeiro admin da plataforma **somente se ainda não existir nenhum** (senha com 12+ caracteres) |
| `AUTH_REFRESH_DAYS` | Validade do refresh token (padrão 7) |
| `AUTH_COOKIE_SECURE` | `true` em produção |
| `COOKIE_SAME_SITE` | `lax` local; `none` em produção (Vercel ↔ Render) |
| `FRONTEND_ORIGIN` | Origem liberada no CORS (uma ou mais, separadas por vírgula) |
| `N8N_ORDER_STATUS_WEBHOOK_URL` | Webhook do n8n (opcional) |
| `REDIS_URL` | Fila de impressão (opcional; sem ele só a impressora fica indisponível) |
| `PRINTER_IP`, `PRINTER_PORT`, `PRINTER_MODEL`, `PRINT_COPIES` | Impressora térmica |
| `PORT` | Injetada pelo Render; o Dockerfile e o comando de start a respeitam |

**Frontend**

| Variável | Descrição |
|---|---|
| `VITE_API_BASE_URL` | Não é mais usada: em produção o `vercel.json` repassa `/api` para a API do Render (cookie first-party, necessário no iPhone/Brave) |
| `VITE_OFFLINE_MODE` | `true` só para demonstração sem backend (dados no `localStorage`) |

> `SEED_DEMO_DATA` existe no compose e no `.env.example`, mas **não tem efeito** no backend FastAPI atual.

## API

Base: `/api`. Erros seguem o formato `{"ok": false, "error": "<codigo>"}` (por exemplo `invalid_credentials`, `forbidden`, `missing_token`, `email_already_exists`).

| Grupo | Rotas |
|---|---|
| Saúde | `GET /api/health` |
| Auth | `POST /api/auth/login` · `POST /api/auth/refresh` · `POST /api/auth/logout` · `GET /api/auth/me` |
| Usuários do tenant | `GET /api/users` · `POST /api/users` · `POST /api/users/change-password` |
| Catálogo | `GET/PUT /api/categories` · `GET/PUT /api/products` |
| Catálogo público | `GET /api/public/{tenant}/categories` · `GET /api/public/{tenant}/products` |
| Pedidos | `GET/PUT /api/orders` · `PUT /api/orders/{id}/status` (interna, exige `X-Internal-API-Key`) |
| Pedidos públicos | `GET/POST /api/public/{tenant}/orders` |
| Plataforma (só admin SaaS) | `GET/POST /api/platform/users` · `PUT /api/platform/users/{id}` · `GET/POST /api/platform/accesses` · `PUT/DELETE /api/platform/accesses/{id}` |
| Impressora | `GET/PUT /api/printer/config` · `POST /api/printer/test` · `GET /api/printer/status` · `POST /api/printer/print-order` |

**Autenticação**

- *Access token* (JWT, 15 min) e *refresh token* (rotativo) em **cookies HTTP-only**; o frontend renova sozinho ao receber `401`.
- O JWT carrega `sub`, `tid` (tenant) e `rk` (papel). A API também aceita `Authorization: Bearer`.
- **Login:** aceita `tenantId` no corpo ou o header `X-Tenant-Id`. Sem tenant, o e-mail precisa ser único entre todos os tenants; se estiver repetido, o login falha por ambiguidade e o cliente deve informar o tenant.
- **Papéis:** `admin`, `manager`, `operator`. Listar usuários exige `users:read` (admin e gerente); criar exige `users:create` (admin). O admin da plataforma é o `admin` do tenant `admin`.

## Funcionalidades

### Pizza meio a meio

Botão **"Meio a meio"** nos cards de pizza do **PDV** e do **cardápio online**. Uma janela escolhe o tamanho e duas metades; o preço aparece antes de adicionar.

- **Cobrança:** pelo sabor mais caro (ou pela média, trocando `pricing` em `src/lib/half-and-half.ts`).
- **Regras:** só pizzas com tamanhos (P/M/G); as duas metades no mesmo tamanho; combinações livres entre categorias.
- **Item do pedido:** texto simples, como `Meio a meio (G): 1/2 Nordestina + 1/2 Calabresa`. Usa `1/2` em ASCII para sair certo na impressora térmica, e o kanban, o webhook e a impressão funcionam sem alterações.
- **Código:** `src/lib/half-and-half.ts` (regras) e `src/components/shared/half-and-half-dialog.tsx` (janela).

### Painel SaaS

Visão geral, clientes, planos, financeiro, acessos, ativações, leads, suporte, auditoria e configurações. A Visão Geral inclui o gráfico **"Acessos por cliente"** (usuários por cliente e papel, `src/components/saas/access-chart.tsx`) e atualiza conforme clientes e acessos mudam.

### Plano de acesso por cliente

`src/lib/plan-access.ts` define quais rotas cada plano libera (Free/Start: pedidos e configurações; Pro: + dashboard, PDV e cardápio; Premium: + operador, estoque e relatórios).

## Scripts utilitários

| Script | Uso |
|---|---|
| `scripts/backup-postgres.ps1` / `restore-postgres.ps1 -BackupFile ./backups/arquivo.sql` | Backup e restore do Postgres via `docker exec` |
| `scripts/acessos_charts.py` | Gera `reports/acessos.png` (usuários por cliente/papel e sessões ativas) lendo do Postgres do Docker. Requer `matplotlib` |
| `scripts/gen_admin_reset_sql.py` | Gera o SQL para **redefinir a senha do admin da plataforma**. Pede a senha no terminal (sem eco) e imprime só o hash bcrypt |

Redefinir a senha do admin da plataforma:

```bash
docker build -q -t vaija-api-tools services/api
docker run --rm -it -v "${PWD}/scripts:/s" vaija-api-tools python /s/gen_admin_reset_sql.py
```

Cole o SQL impresso no **SQL Editor** do Supabase e execute.

## Deploy: Vercel + Render + Supabase

### 1. Banco (Supabase)

1. Crie um projeto (plano Free), de preferência em `South America (São Paulo)`.
2. Em **Connect**, copie a **Session pooler** (`postgresql://postgres.<ref>:[SENHA]@aws-?-sa-east-1.pooler.supabase.com:5432/postgres`). Use **Session pooler**, não a conexão direta (que é só IPv6 e o Render gratuito não alcança). Troque `[SENHA]` pela senha **sem os colchetes** e codifique caracteres especiais (`@` vira `%40`).
3. Em **Data API**, desative a exposição automática de tabelas, se houver.
4. Não é preciso criar tabelas: a API cria o esquema ao subir e **liga RLS em todas as tabelas** (sem policies), o que bloqueia leitura/escrita via Data API/chave `anon`. A conexão direta da API não é afetada.

> O plano gratuito do Supabase pausa o projeto após cerca de uma semana sem uso (reativável no painel).

### 2. API (Render)

*New → Web Service*, repositório do projeto:

| Campo | Valor |
|---|---|
| Language | Python 3 |
| Branch | `main` |
| Root Directory | `services/api` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |

Variáveis de ambiente: `DATABASE_URL` (Session pooler), `AUTH_JWT_SECRET` e `INTERNAL_API_KEY` (valores aleatórios longos), `FRONTEND_ORIGIN` (`https://vaija.vercel.app`), `PYTHON_VERSION=3.12.8`, `APP_ENV=production`, `AUTH_COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` (12+ caracteres).

> O serviço **não pode trocar de runtime** depois de criado (Go → Python exige um serviço novo). O plano gratuito hiberna e a primeira requisição pode levar ~50 s.

O `render.yaml` descreve os mesmos serviços como Blueprint.

### 3. Frontend (Vercel)

1. Em *Settings → Environment Variables*, defina `VITE_API_BASE_URL` com a URL pública da API (sem barra no final e sem `/api`).
2. Faça **Redeploy** sem cache: a variável é embutida no build.

### Docker de produção

```bash
docker compose -f docker-compose.prod.yml up -d
```

Defina antes `POSTGRES_PASSWORD`, `AUTH_JWT_SECRET`, `INTERNAL_API_KEY`, `FRONTEND_ORIGIN` e `PRINTER_IP`. A API sobe na porta `3002`.

## n8n + WhatsApp

O workflow `n8n/order-status-whatsapp.json` envia uma mensagem no WhatsApp quando o status de um pedido muda.

1. Importe o workflow no n8n.
2. Configure `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` (WhatsApp Cloud API da Meta).
3. Publique e copie a URL do webhook `POST`.
4. Defina `N8N_ORDER_STATUS_WEBHOOK_URL` na API.
5. Ao mudar o status de um pedido em *Pedidos*, o frontend salva na API e **a API** dispara o webhook (a URL não fica exposta no navegador). O envio é *best effort*: uma falha do n8n não impede a mudança de status.

Payload enviado:

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

## Impressão térmica

A API enfileira o cupom em `print-jobs` no Redis (`POST /api/printer/print-order`, `/api/printer/test`). O serviço `services/print-worker` consome a fila e imprime na impressora de rede (`PRINTER_IP`, porta 9100, modelo `epson`). O status da fila fica em `GET /api/printer/status`. A configuração da impressora é mantida em memória na API.

## Migração do backend Go para FastAPI

O backend em Go (`backend/`) foi substituído por Python/FastAPI em `services/api/`, e o código antigo permanece no histórico do git. O que mudou:

- **Rotas:** todas as rotas do Go foram portadas, incluindo as da **plataforma SaaS** (usuários e acessos de clientes) e da **impressora** (fila no Redis).
- **JWT:** passou a incluir o papel (`rk`), necessário para identificar o admin da plataforma e aplicar permissões.
- **Bootstrap do admin:** `BOOTSTRAP_ADMIN_*` cria o primeiro admin da plataforma (como o `EnsureBootstrapAdmin` do Go).
- **Login:** aceita `tenantId`/`X-Tenant-Id`; e-mail repetido entre tenants sem tenant informado é tratado como credencial inválida; corpo vazio retorna `missing_credentials`.
- **Erros:** retornam `{ok:false, error}` como no Go.
- **Senhas:** fixado `bcrypt==4.0.1` por incompatibilidade do `passlib` 1.7.4 com versões novas do `bcrypt`.
- **Supabase:** conversão de `sslmode`/TLS para o `asyncpg`, aceitação de `postgres://` e RLS automático nas tabelas.
- **Render:** `render.yaml` passou a usar runtime Python; o Dockerfile respeita a variável `PORT`.
- **Limpeza:** removidos `backend/` (Go), `server/` (Node legado) e o PDF de mapa técnico.

## Limitações conhecidas e próximos passos

- **Clientes, planos, cobrança e suporte do painel SaaS ficam no `localStorage` do navegador**, não no banco. Os usuários ficam no banco; os cartões de cliente, não. Mover tenants e cobrança para o backend resolve a perda de dados ao limpar o cache, o nome/plano do restaurante em outros navegadores e a contagem de acessos por cliente.
- **"Acessar como cliente"** usa só dados locais e **não funciona com a API real**; para entrar como restaurante, faça login com o e-mail e a senha dele.
- **Ligação cliente ↔ usuário:** a contagem de acessos só funciona se o `tenantId` do usuário for igual ao id do cliente (slug do nome). Ao criar acessos fora da tela de Ativações, use o slug correto.
- **Preço calculado no navegador:** o servidor aceita o valor do pedido enviado pelo cliente. Antes de vender de verdade, o servidor deve recalcular o total a partir do cardápio.
- **Relatórios por sabor:** itens de meio a meio ficam em um texto só. Um formato estruturado de itens permitiria ranking de sabores e controle de estoque.
- **`SEED_DEMO_DATA`** não tem efeito no FastAPI; `services/api/seed.py` é um script manual com URL fixa de desenvolvimento.
- **Cold start:** o plano gratuito do Render hiberna a API, e o do Supabase pausa o banco por inatividade.
- **Build do frontend:** há um aviso de TypeScript pendente em `src/components/layout/app-header.tsx` (`description` declarada e não usada) que pode barrar `npm run build`.

## Segurança

- Nunca versione `.env`, senhas, chaves de API ou URLs de banco com senha.
- Em produção troque `AUTH_JWT_SECRET` e `INTERNAL_API_KEY` por valores aleatórios longos e mantenha `AUTH_COOKIE_SECURE=true` e `COOKIE_SAME_SITE=none`.
- Troque imediatamente senhas que tenham sido compartilhadas em conversas, tickets ou capturas de tela (inclusive a senha do banco e a do admin).
- O RLS fica ativo em todas as tabelas; não crie policies para `anon`/`authenticated`, pois a API acessa o banco diretamente.
