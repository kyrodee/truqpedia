# Truqpedia

Truqpedia is a professional AI SaaS for auto parts, heavy vehicles, trucks, buses, road implements, diesel maintenance, technical sales and parts support.

The app is built with Next.js 15, React 19, TypeScript, TailwindCSS v4, shadcn-style Radix components and Supabase Auth/PostgreSQL. It is ready for Vercel deployment and already includes a provider router for Groq, OpenRouter, Gemini, Cohere and Grok/xAI.

## What is included

- Minimal landing page with an embedded AI trial, how-it-works section and plan cards.
- Authenticated chat workspace at `/chat` inspired by modern AI workspaces.
- Guest trial with configurable free-message limit.
- Supabase Auth for sign up, login, password recovery and session management.
- Persistent conversations, messages, rename/delete actions and sidebar history for authenticated users.
- Project workspaces backed by `knowledge_collections`.
- Message actions for copy, retry and opening answers in a side canvas.
- Streaming responses through Server-Sent Events.
- Decoupled AI provider interface with automatic priority/fallback routing.
- Admin panel for provider enablement, model names, priorities, timeouts and recent metrics.
- Markdown output with tables, code blocks, links and source references.
- Optional web search through Tavily, Brave Search or Serper.
- Production safety controls: bounded request payloads, per-user/IP chat rate limiting, same-origin auth redirects, security headers and a health endpoint.
- Full Supabase SQL schema with RLS, indexes, triggers and future-ready knowledge/integration tables.

## Project structure

```txt
src/
  app/
    api/
      admin/              Admin metrics and provider settings APIs
      chat/               Streaming chat endpoint
      conversations/      Conversation CRUD
      health/             Production readiness health check
      projects/           Project workspace CRUD
    admin/                Admin dashboard route
    auth/callback/        Supabase OAuth/email callback
    chat/                 Authenticated chat workspace
    page.tsx              Landing page with AI trial
  components/
    admin/                Admin UI
    auth/                 Login/signup/reset modal
    chat/                 Chat shell and streaming UI
    markdown/             Markdown renderer
    ui/                   shadcn-style primitives
  lib/
    ai/                   Providers, streaming parsers and router
    search/               Web search adapters
    supabase/             Browser/server/admin clients and authz helpers
    usage/                Metrics and usage logging
supabase/
  schema.sql              Complete PostgreSQL/RLS setup
docs/
  ARCHITECTURE.md         Maintenance and extension notes
```

## Local setup

1. Install dependencies:

```bash
npm ci
```

2. Create `.env.local` from `.env.example` and fill Supabase plus at least one AI provider key.

3. In Supabase, open the SQL editor and execute:

```txt
supabase/schema.sql
```

4. Run the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

The landing page is available at `/`. The authenticated workspace is available
at `/chat`.

## Supabase configuration

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The service role key is server-only. It is used for provider settings and operational logs. Never expose it to the browser.

To promote a user to admin after signup:

```sql
update public.user_profiles
set role = 'admin'
where id = 'USER_UUID';
```

## AI providers

Configure one or more keys:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `GEMINI_API_KEY`
- `COHERE_API_KEY`
- `XAI_API_KEY`

The router loads provider priorities and model names from `public.ai_provider_settings`. If Supabase service credentials are not available, it uses safe defaults from `src/lib/ai/model-router.ts`.

## Web search

Optional keys:

- `TAVILY_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `SERPER_API_KEY`

When the user enables online search, the chat endpoint queries the first available search provider, injects concise source context into the model prompt and streams source metadata back to the UI.

## Vercel deploy

1. Import the repository in Vercel.
2. Set all required environment variables in Project Settings.
3. Set `NEXT_PUBLIC_APP_URL` to the production URL.
4. Run `npm run validate:prod` with the production environment loaded.
5. Confirm the build command is `npm run build`.
6. In Supabase Auth, add the production URL and `/auth/callback` to allowed redirect URLs.
7. After deploy, check `/api/health`. A production-ready deployment returns HTTP 200 with `status: "ok"`.

## Production controls

- `CHAT_RATE_LIMIT_REQUESTS` and `CHAT_RATE_LIMIT_WINDOW_MS` limit chat requests per authenticated user or client IP.
- `MAX_CHAT_PAYLOAD_BYTES` rejects oversized chat payloads before model/provider work starts.
- `WEB_SEARCH_TIMEOUT_MS` prevents optional search providers from hanging chat startup.
- `NEXT_PUBLIC_FREE_MESSAGE_LIMIT` controls guest trial messages. The server enforces the limit.
- `npm` overrides force `postcss` to a patched version across the dependency tree.

## Validation

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npm run ci
npm audit --omit=dev
```

