# Hyna AI Loan Concierge

An interactive, fictional AI-assisted loan intake prototype for the Hyna AI Lending Platform. The repository contains both the React frontend and a local full-stack pilot API.

## What is real in the pilot

- The frontend detects and labels **Live AI**, **API Demo**, or **Browser Demo** mode.
- The Fastify API persists applications, messages, document metadata, and audit events in SQLite.
- Uploaded files are validated, hashed, and stored outside the public frontend build.
- The OpenAI adapter uses the Responses API and structured output. It is enabled only when explicitly configured.
- AI failure never silently falls back to a simulated answer once the API is configured.
- Application IDs are generated server-side rather than reusing one fixed case ID.

Document OCR, production identity, cloud object storage, malware scanning, and the cross-portal one-time token exchange are defined integration boundaries, not completed production controls.

## Requirements

- Node.js 24+
- pnpm 11+

## Install

```bash
pnpm install --frozen-lockfile
copy .env.example .env
```

Do not commit `.env`. Keep `OPENAI_API_KEY` in a local environment variable or cloud secret manager, never in Vite variables or browser code.

## Run the full-stack pilot

Terminal 1:

```bash
pnpm dev:api
```

Terminal 2:

```bash
pnpm dev
```

Open `http://127.0.0.1:4180/finstreet-demo/`. The API runs at `http://127.0.0.1:8787` and Vite proxies `/api` during development.

The safe default is:

```dotenv
AI_MODE=demo
REQUIRE_REAL_AI=false
```

To use the real AI adapter, set the secret outside the frontend and restart the API:

```dotenv
AI_MODE=openai
OPENAI_API_KEY=your_secret_in_the_runtime_only
OPENAI_MODEL=gpt-5.6-sol
REQUIRE_REAL_AI=true
```

## Validate and build

```bash
pnpm lint
pnpm typecheck
pnpm test:api
pnpm build
pnpm preview
```

## Data locations

The local API binds to `127.0.0.1` by default and writes pilot data to:

```text
.data/pilot.sqlite
.data/uploads/
```

These paths are gitignored. Use fictional data only until authentication, encrypted cloud storage, retention, consent, backup, and deletion controls are deployed and independently reviewed.

## GitHub Pages

Pushes to `main` validate and deploy the static `dist` artifact. GitHub Pages cannot run Fastify, SQLite, OpenAI calls, or secure file storage. On Pages the frontend therefore displays **Browser Demo • API offline** and keeps its previous fictional browser-only behaviour.

For a real public environment, deploy the API separately behind HTTPS, set `VITE_API_BASE_URL` to that origin at frontend build time, restrict `CORS_ORIGINS`, and set `VITE_REQUIRE_API=true` so production cannot fall back to browser simulation.

See [INTEGRATION.md](./INTEGRATION.md) for the production architecture and remaining work.

## Product and compliance boundary

- This is an interactive Hyna AI product concept, not a production lending system or evidence of lender adoption.
- All applicant and lending data shown in the prototype must be fictional.
- AI assists information collection and organisation only.
- Loan eligibility, pricing, responsible-lending assessment, approval, and decline remain human and lender decisions.
