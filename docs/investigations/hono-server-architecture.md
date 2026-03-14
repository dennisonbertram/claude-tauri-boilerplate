# Hono Server Architecture Research

**Date**: 2026-03-14
**Purpose**: Evaluate Hono as the backend web framework for the Claude Tauri boilerplate — covering routing, Node.js deployment, SQLite integration, SSE streaming for AI output, Vercel AI SDK compatibility, CORS for Tauri webview, and typed RPC client.

---

## 1. Hono Basics — Routing, Middleware, Context

Hono is a small (<20KB), ultrafast web framework built on Web Standards (Request, Response, Fetch API). It runs on any JS runtime: Node.js, Bun, Deno, Cloudflare Workers.

### Routing

```typescript
import { Hono } from 'hono'

const app = new Hono()

// Basic HTTP method handlers
app.get('/', (c) => c.text('Hello World'))
app.post('/posts', (c) => c.json({ ok: true }))
app.put('/posts/:id', (c) => c.json({ id: c.req.param('id') }))
app.delete('/posts/:id', (c) => c.json({ deleted: true }))

// Route groups / sub-apps
const api = new Hono()
api.get('/users', (c) => c.json([]))
app.route('/api', api)
```

### Middleware

Middleware runs before/after route handlers. Register with `app.use()`:

```typescript
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'

// Global middleware
app.use(logger())

// Path-scoped middleware
app.use('/api/*', cors())
app.post('/admin/*', basicAuth())

// Custom middleware — must call await next()
app.use(async (c, next) => {
  console.log('Before handler')
  await next()
  console.log('After handler')
})
```

Key rule: middleware calls `await next()` and returns nothing (or returns a Response for early exit). Handlers must return a Response.

### Context (`c`)

The context object `c` is the single argument to every handler and middleware:

```typescript
c.req.param('id')        // URL path params
c.req.query('page')      // Query string params
c.req.json()             // Parse JSON body (async)
c.req.formData()         // Parse form data (async)
c.req.header('Authorization')  // Request headers

c.json({ data: 'x' })   // Respond with JSON
c.text('hello')          // Respond with plain text
c.html('<h1>Hi</h1>')    // Respond with HTML
c.status(201)            // Set status code

// Type-safe context variables (shared between middleware and handlers)
type Variables = { userId: string }
const app = new Hono<{ Variables: Variables }>()

app.use(async (c, next) => {
  c.set('userId', 'abc123')
  await next()
})

app.get('/me', (c) => {
  const userId = c.get('userId')   // fully typed
  return c.json({ userId })
})
```

---

## 2. Running Hono on Node.js — `@hono/node-server`

**Package**: `@hono/node-server`
**Node.js version requirement**: >= 18.14.1, >= 19.7.0, or >= 20.0.0

### Installation

```bash
npm install hono @hono/node-server
```

### Basic Setup

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()
app.get('/', (c) => c.text('Hello Node.js!'))

serve(app)
// or with explicit options:
serve({
  fetch: app.fetch,
  port: 8787,
})
```

### With Graceful Shutdown

```typescript
const server = serve({
  fetch: app.fetch,
  port: 8787,
})

process.on('SIGINT', () => {
  server.close()
  process.exit(0)
})
```

### Static File Serving

```typescript
import { serveStatic } from '@hono/node-server/serve-static'

app.use('/static/*', serveStatic({ root: './' }))
```

### HTTP/2

```typescript
import { readFileSync } from 'fs'
import { createSecureServer } from 'http2'

serve({
  fetch: app.fetch,
  createServer: createSecureServer,
  serverOptions: {
    key: readFileSync('./cert/localhost-key.pem'),
    cert: readFileSync('./cert/localhost.pem'),
  },
})
```

The `serve()` function accepts `app` directly (shorthand) or an options object `{ fetch, port, ... }`. The Node.js adapter translates Node.js's `IncomingMessage`/`ServerResponse` into the Web Standard Request/Response that Hono expects.

---

## 3. Hono with SQLite — `better-sqlite3` and `@libsql/client`

Hono has no built-in database layer — you bring your own. The recommended approaches:

### Option A: `better-sqlite3` (synchronous, local file)

**Best for**: local desktop app (Tauri context), fully synchronous API, fastest performance.

```bash
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'

const db = new Database('./data.db')

// Schema setup
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

const app = new Hono()

app.get('/messages', (c) => {
  const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all()
  return c.json(messages)
})

app.post('/messages', async (c) => {
  const { content } = await c.req.json()
  const stmt = db.prepare('INSERT INTO messages (content) VALUES (?)')
  const result = stmt.run(content)
  return c.json({ id: result.lastInsertRowid }, 201)
})

serve({ fetch: app.fetch, port: 8787 })
```

### Option B: `better-sqlite3` with Drizzle ORM

For a type-safe, migration-friendly approach:

```bash
npm install drizzle-orm better-sqlite3
npm install --save-dev drizzle-kit @types/better-sqlite3
```

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

const sqlite = new Database('./data.db')
const db = drizzle(sqlite)

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  content: text('content').notNull(),
})

// In route handlers:
app.get('/messages', (c) => {
  const rows = db.select().from(messages).all()
  return c.json(rows)
})
```

### Option C: `@libsql/client` (Turso / remote SQLite)

For remote or embedded replicated SQLite via Turso:

```bash
npm install @libsql/client
```

```typescript
import { createClient } from '@libsql/client'

const client = createClient({
  url: 'file:./local.db',              // local file
  // url: 'libsql://your-db.turso.io', // remote Turso
  // authToken: process.env.TURSO_TOKEN
})

app.get('/messages', async (c) => {
  const result = await client.execute('SELECT * FROM messages')
  return c.json(result.rows)
})
```

Note: `@libsql/client` is async (returns Promises), unlike `better-sqlite3`'s synchronous API. For a local Tauri app with no remote sync requirements, `better-sqlite3` is simpler and faster.

### Node.js 22+ Native SQLite

Node.js 22.5.0+ includes a built-in `node:sqlite` module — no npm package needed. Still experimental/unstable as of early 2026, but worth watching.

---

## 4. Hono Streaming Responses — SSE for AI Output

Hono has a built-in `streaming` helper with two main functions: `streamText()` and `streamSSE()`.

### `streamText()` — Raw text streaming

Sets `Content-Type: text/plain` automatically:

```typescript
import { streamText } from 'hono/streaming'

app.get('/stream', (c) => {
  return streamText(c, async (stream) => {
    await stream.writeln('Hello')
    await stream.sleep(1000)
    await stream.write('Hono!')
  })
})
```

### `streamSSE()` — Server-Sent Events

Properly formats SSE protocol (`data:`, `event:`, `id:` fields):

```typescript
import { streamSSE } from 'hono/streaming'

let id = 0

app.get('/sse', async (c) => {
  return streamSSE(c, async (stream) => {
    while (true) {
      const message = `It is ${new Date().toISOString()}`
      await stream.writeSSE({
        data: message,
        event: 'time-update',
        id: String(id++),
      })
      await stream.sleep(1000)
    }
  })
})
```

### Abort / Cleanup

```typescript
app.get('/sse', async (c) => {
  return streamSSE(c, async (stream) => {
    stream.onAbort(() => {
      console.log('Client disconnected')
    })
    // ... send events
  })
})
```

---

## 5. Hono with Vercel AI SDK — `streamText` and `createUIMessageStream`

The Vercel AI SDK (package: `ai`) integrates cleanly with Hono. The AI SDK's `streamText()` returns a result object with methods that produce standard Response objects — Hono simply returns them.

### Installation

```bash
npm install ai @ai-sdk/openai
# or @ai-sdk/anthropic, etc.
```

### Pattern 1: UI Message Stream (recommended for AI SDK UI)

Returns an AI SDK data-stream protocol response — compatible with `useChat`/`useCompletion` hooks:

```typescript
import { serve } from '@hono/node-server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()
app.use('*', cors())

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json()

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  })

  return result.toUIMessageStreamResponse()
})

serve({ fetch: app.fetch, port: 8787 })
```

### Pattern 2: Raw Text Stream

For simple text streaming, returns `text/plain` chunked:

```typescript
app.post('/api/complete', async (c) => {
  const { prompt } = await c.req.json()

  const result = streamText({
    model: openai('gpt-4o'),
    prompt,
  })

  return result.toTextStreamResponse()
})
```

### Pattern 3: Custom Data + AI Stream (with `createUIMessageStream`)

For injecting custom data alongside AI stream tokens:

```typescript
import { streamText, createUIMessageStream } from 'ai'
import { streamSSE } from 'hono/streaming'

app.post('/api/chat-with-data', async (c) => {
  const { messages } = await c.req.json()

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  })

  // toUIMessageStreamResponse() handles headers correctly
  return result.toUIMessageStreamResponse({
    headers: {
      'X-Custom-Header': 'value',
    },
  })
})
```

### Known Issues / Caveats

- There have been TypeScript type errors when attempting to directly pipe/return stream responses (GitHub issue #7045 in vercel/ai). Using `.toUIMessageStreamResponse()` or `.toTextStreamResponse()` (which return a plain `Response`) avoids these issues — Hono accepts any standard `Response` return.
- The AI SDK uses SSE as its standard streaming protocol. The AI SDK's response objects set correct `Content-Type: text/event-stream` headers automatically.
- For Anthropic's SDK: use `@ai-sdk/anthropic` as the provider, same API.

### Using Hono's `streamSSE` with AI SDK (manual approach)

If you need fine-grained control over the SSE stream:

```typescript
import { streamSSE } from 'hono/streaming'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

app.post('/api/chat-sse', async (c) => {
  const { prompt } = await c.req.json()

  return streamSSE(c, async (sseStream) => {
    const result = streamText({
      model: openai('gpt-4o'),
      prompt,
    })

    for await (const chunk of result.textStream) {
      await sseStream.writeSSE({
        data: chunk,
        event: 'text-chunk',
      })
    }

    await sseStream.writeSSE({ data: '[DONE]', event: 'done' })
  })
})
```

---

## 6. CORS Setup for Local Development (Tauri Webview → Local Hono Server)

Tauri webviews use a custom protocol (`tauri://localhost` or `https://tauri.localhost`) that will trigger CORS preflight checks when making fetch calls to a local Hono HTTP server.

### Basic CORS (development)

```typescript
import { cors } from 'hono/cors'

app.use('*', cors())
// Allows all origins — fine for local dev, NOT for production
```

### Tauri-specific CORS

```typescript
app.use('*', cors({
  origin: [
    'tauri://localhost',       // Tauri custom protocol (macOS/Linux)
    'https://tauri.localhost', // Tauri on Windows
    'http://localhost:1420',   // Vite dev server (common Tauri dev port)
    'http://localhost:5173',   // Vite alternative
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
```

### Dynamic CORS (env-based)

```typescript
app.use('*', async (c, next) => {
  const corsMiddlewareHandler = cors({
    origin: process.env.CORS_ORIGIN ?? '*',
  })
  return corsMiddlewareHandler(c, next)
})
```

### Multiple Origins with Callback

```typescript
const ALLOWED_ORIGINS = [
  'tauri://localhost',
  'https://tauri.localhost',
  'http://localhost:1420',
]

app.use('*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
```

### Tauri-side Configuration

In `tauri.conf.json`, the CSP and allowed origins may also need updating:

```json
{
  "security": {
    "csp": "default-src 'self'; connect-src 'self' http://localhost:8787"
  }
}
```

And in Rust config, `dangerousRemoteDomainIpcAccess` or `allowlist` may be needed for IPC calls alongside HTTP fetch calls.

---

## 7. Hono RPC / Typed Client — `hono/client`

Hono's RPC system provides end-to-end TypeScript type safety without a code generation step. The server type is inferred directly from your route definitions.

### Server Setup

Export the type of a route or the whole app:

```typescript
// server.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono()

const routes = app
  .get('/posts', (c) => {
    return c.json({ posts: [{ id: 1, title: 'Hello' }] })
  })
  .post(
    '/posts',
    zValidator('json', z.object({
      title: z.string(),
      body: z.string(),
    })),
    (c) => {
      const { title, body } = c.req.valid('json')
      return c.json({ ok: true, id: 1 }, 201)
    }
  )
  .get(
    '/posts/:id',
    (c) => {
      const id = c.req.param('id')
      return c.json({ id, title: 'Hello' })
    }
  )

export type AppType = typeof routes
export default app
```

### Client Setup

```typescript
// client.ts (frontend)
import { hc } from 'hono/client'
import type { AppType } from './server'

const client = hc<AppType>('http://localhost:8787/')

// Fully type-safe calls:
const res = await client.posts.$get()
const { posts } = await res.json()  // typed as { posts: { id: number, title: string }[] }

const createRes = await client.posts.$post({
  json: { title: 'New Post', body: 'Content here' }
})

// Path parameters
const postRes = await client.posts[':id'].$get({
  param: { id: '42' }
})
```

### Type Inference Utilities

```typescript
import { InferRequestType, InferResponseType } from 'hono/client'

// Infer what a route expects as input
type CreatePostReq = InferRequestType<typeof client.posts.$post>

// Infer what a route returns
type PostsResponse = InferResponseType<typeof client.posts.$get>
// or with status narrowing:
type PostsResponse200 = InferResponseType<typeof client.posts.$get, 200>
```

### Headers and Auth

```typescript
// Global headers for all requests
const client = hc<AppType>('http://localhost:8787/', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})

// Per-request headers
const res = await client.posts.$get({}, {
  headers: { 'X-Custom': 'value' }
})
```

### Credentials (Cookies)

```typescript
const client = hc<AppType>('http://localhost:8787/', {
  init: { credentials: 'include' }
})
```

### WebSocket RPC

```typescript
// server.ts
import { createNodeWebSocket } from '@hono/node-ws'

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

const wsApp = app.get('/ws', upgradeWebSocket((c) => ({
  onMessage(event, ws) {
    ws.send(`Echo: ${event.data}`)
  },
})))

export type WsAppType = typeof wsApp

// client.ts
const client = hc<WsAppType>('http://localhost:8787')
const socket = client.ws.$ws()
```

### Caveats and Best Practices

1. **TypeScript strict mode required**: Both `tsconfig.json` files (server + client) must have `"strict": true` for RPC types to work properly.

2. **IDE performance**: Many routes cause expensive type instantiation. Mitigations:
   - Export only specific route groups (not the entire app type)
   - Use TypeScript project references in monorepos
   - Split large apps into sub-apps with separate types

3. **Same Hono version**: Server and client must use the same Hono version. Mismatches cause type depth errors.

4. **Absolute URLs**: Use absolute URLs (e.g., `http://localhost:8787/`) in `hc()`. Relative URLs cause `$url()` to fail.

5. **Status codes must be explicit**: Use `c.json({ error: 'not found' }, 404)` not `c.notFound()` — the latter cannot be inferred by the client type system.

6. **Validators required for input types**: If a route has no Zod/Valibot validator, the client won't know the shape of the request body — it will accept any input. Add `zValidator` for full type safety.

---

## Summary Table

| Feature | Package | Notes |
|---------|---------|-------|
| Core framework | `hono` | Web Standards based, ultrafast |
| Node.js runtime | `@hono/node-server` | `serve()` function, Node >= 18.14.1 |
| SQLite (local) | `better-sqlite3` | Sync API, fastest, ideal for Tauri |
| SQLite (ORM) | `drizzle-orm` + `better-sqlite3` | Type-safe, migrations |
| SQLite (remote) | `@libsql/client` | Turso / async API |
| CORS | `hono/cors` (built-in) | Configure Tauri origins |
| SSE streaming | `hono/streaming` (built-in) | `streamSSE()`, `streamText()` |
| AI SDK | `ai` + `@ai-sdk/anthropic` | `.toUIMessageStreamResponse()` / `.toTextStreamResponse()` |
| Typed RPC | `hono/client` (built-in) | `hc<AppType>()`, no codegen needed |
| Validation | `@hono/zod-validator` | Required for full RPC type inference |

---

## Recommended Stack for Claude Tauri Boilerplate

```
hono                        # framework
@hono/node-server           # Node.js adapter
better-sqlite3              # local SQLite
drizzle-orm                 # ORM (optional but recommended)
drizzle-kit                 # migrations
ai                          # Vercel AI SDK
@ai-sdk/anthropic           # Anthropic provider
@hono/zod-validator         # request validation
zod                         # schema validation
```

### Minimal server entry point

```typescript
// src/server/index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import Database from 'better-sqlite3'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

const db = new Database('./data.db')
const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: ['tauri://localhost', 'https://tauri.localhost', 'http://localhost:1420'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json()
  const result = streamText({
    model: anthropic('claude-opus-4-6'),
    messages,
  })
  return result.toUIMessageStreamResponse()
})

const server = serve({ fetch: app.fetch, port: 8787 })
process.on('SIGINT', () => { server.close(); process.exit(0) })

export type AppType = typeof app
```

---

## Sources

- [Hono Official Docs](https://hono.dev/docs)
- [Hono Node.js Getting Started](https://hono.dev/docs/getting-started/nodejs)
- [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming)
- [Hono CORS Middleware](https://hono.dev/docs/middleware/builtin/cors)
- [Hono RPC Guide](https://hono.dev/docs/guides/rpc)
- [Hono Best Practices](https://hono.dev/docs/guides/best-practices)
- [AI SDK Hono Integration](https://ai-sdk.dev/examples/api-servers/hono)
- [AI SDK streamText Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [AI SDK Stream Protocols](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3)
- [Drizzle ORM + Hono Example](https://dev.to/aaronksaunders/getting-started-with-hono-js-and-drizzle-orm-2g6i)
- [Hono RPC in Monorepos](https://catalins.tech/hono-rpc-in-monorepos/)
- [Type-Safe REST API with Hono 2026](https://dev.to/1xapi/how-to-build-a-type-safe-rest-api-with-honojs-in-2026-4la5)
- [Hono Middleware Repo](https://github.com/honojs/middleware)
- [Node.js Native SQLite](https://betterstack.com/community/guides/scaling-nodejs/nodejs-sqlite/)
