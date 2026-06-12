# Truqpedia Architecture

## Runtime flow

1. `src/app/page.tsx` loads the Supabase session server-side.
2. Authenticated users receive conversation history and optional selected messages.
3. `TruqpediaShell` handles the chat UI, local draft state, sidebar actions and SSE parsing.
4. `POST /api/chat` validates the request, checks guest limits, creates or verifies the conversation, stores the user message and performs optional web search.
5. `streamWithFallback` selects enabled providers by priority, streams tokens from the first healthy provider and records metrics.
6. The assistant message is persisted after the stream completes.

## AI provider boundary

Every provider implements `AIProvider` from `src/lib/ai/types.ts`.

Providers never leak provider-specific payloads into the app layer. The router receives normalized messages and emits normalized stream events:

- `provider`
- `token`
- `sources`
- `done`
- `error`

Groq, OpenRouter and Grok/xAI use the OpenAI-compatible adapter. Gemini and Cohere have dedicated streaming parsers.

## Database model

Primary user data:

- `user_profiles`
- `user_settings`
- `conversations`
- `messages`

Operational data:

- `ai_provider_settings`
- `provider_metrics`
- `usage_logs`
- `audit_logs`
- `web_search_logs`

Future growth tables:

- `knowledge_collections`
- `document_assets`
- `knowledge_chunks`
- `integration_connections`

All user-owned tables enable RLS and scope reads/writes to `auth.uid()`. Admin-only tables use the `public.is_admin()` helper.

## Extension points

- PDF catalogs: store files in Supabase Storage, create `document_assets`, extract chunks into `knowledge_chunks`.
- RAG: add embedding generation and vector search over `knowledge_chunks`.
- ERP/stock integrations: create rows in `integration_connections` and add background sync jobs.
- WhatsApp: route inbound messages into conversations and reuse `/api/chat` internally.
- Marketplace copy: add prompt templates as a separate table and surface them as quick actions in the chat composer.

