# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

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

## n8n + WhatsApp

Existe um workflow de exemplo em `n8n/order-status-whatsapp.json` para enviar mensagem no WhatsApp quando o status do pedido mudar.

Arquivos relacionados:

- `.env.example`
- `src/lib/order-status-webhook.ts`
- `n8n/order-status-whatsapp.json`

Como usar:

1. Importe `n8n/order-status-whatsapp.json` no n8n.
2. No n8n, configure as variáveis de ambiente `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` para a WhatsApp Cloud API da Meta.
3. Publique o workflow e copie a URL do webhook `POST`.
4. Crie seu `.env` local a partir de `.env.example` e preencha `VITE_N8N_ORDER_STATUS_WEBHOOK_URL` com a URL do webhook publicada.
5. Ao mudar o status de um pedido na tela de `Pedidos`, o frontend envia o payload para o n8n.

Payload enviado pelo app:

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

Observação: neste projeto o disparo sai direto do frontend para o webhook do n8n. Isso funciona para demonstração e protótipo. Em produção, o ideal é acionar o n8n a partir do backend para não expor a URL do webhook no cliente.
