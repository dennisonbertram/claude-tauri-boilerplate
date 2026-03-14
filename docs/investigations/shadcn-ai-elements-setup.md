# shadcn/ui + AI SDK Elements Setup Research

**Date**: 2026-03-14
**Purpose**: Setup guide for shadcn/ui v2+ with Vite/React (non-Next.js), AI SDK Elements components, Tailwind CSS v4, and custom Hono backend integration.

---

## 1. Tailwind CSS v4 with Vite

Tailwind v4 completely eliminates the `tailwind.config.js` file. Configuration moves into CSS and the Vite plugin handles the rest.

### Installation

```bash
npm install tailwindcss @tailwindcss/vite
```

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
```

### `src/index.css` (or `globals.css`)

```css
@import "tailwindcss";
```

That single import replaces the old `@tailwind base; @tailwind components; @tailwind utilities;` directives.

### Key Differences from v3

- No `tailwind.config.js` needed
- No content paths configuration — v4 auto-detects files
- Custom colors use `@theme inline` directive instead of `extend.colors`
- Dark mode uses `@custom-variant dark (&:is(.dark *))` instead of `darkMode: 'class'`

---

## 2. shadcn/ui v2 Setup — Vite/React (Non-Next.js)

shadcn/ui v2 (the "v4" branch targeting Tailwind v4) works cleanly with Vite. `rsc: false` disables all Next.js-specific RSC features.

### Initialize

```bash
npx shadcn@latest init -t vite
# or for monorepo:
npx shadcn@latest init -t vite --monorepo
```

This scaffolds `components.json`, installs dependencies, and sets up path aliases.

### `components.json` (Vite-specific, Tailwind v4)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

Note: `tailwind.config` is empty string for v4 (no config file needed).

### TypeScript Path Aliases — `tsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

And in `vite.config.ts` add the resolver:

```typescript
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### Global CSS with Full Theme Variables

The `src/styles/globals.css` file for Tailwind v4 + shadcn:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Adding Custom Colors (v4 pattern)

```css
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}
.dark {
  --warning: oklch(0.41 0.11 46);
  --warning-foreground: oklch(0.99 0.02 95);
}

@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

### Adding Components

```bash
npx shadcn@latest add button
npx shadcn@latest add card input textarea
```

Components copy into `src/components/ui/` as editable source files.

---

## 3. AI SDK Elements

### What It Is

AI Elements is a component library and custom shadcn/ui registry built by Vercel on top of shadcn/ui. It provides pre-built, composable components for AI-native UIs: chat threads, prompt inputs, reasoning panels, tool call displays, voice interfaces, and code artifact views.

**Key technical facts:**
- Targets React 19 (no `forwardRef` usage)
- Requires Tailwind CSS v4
- Requires AI SDK v6+ (formerly AI SDK 5)
- Components are installed as editable source files via the shadcn "copy-and-own" model
- Registry URL: `https://elements.ai-sdk.dev/api/registry/`

### Prerequisites

Before installing AI Elements:

1. Node.js 18+
2. shadcn/ui initialized (has `components.json`)
3. Tailwind CSS v4 configured
4. AI SDK v6 installed: `npm install ai @ai-sdk/react`

### Installation Methods

**Method 1 — Dedicated CLI (recommended):**

```bash
# Install a single component
npx ai-elements@latest add message

# Install multiple components
npx ai-elements@latest add prompt-input conversation message

# Install all components
npx ai-elements@latest add all
```

**Method 2 — shadcn CLI with registry URL:**

```bash
npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/all.json
```

**Method 3 — Individual registry URLs:**

```bash
npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/message.json
npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/conversation.json
npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/prompt-input.json
```

The CLI detects your package manager via `npm_config_user_agent` and uses pnpm/yarn/bun/npx accordingly.

### Post-Installation Structure

```
src/components/
└── ai-elements/
    ├── message.tsx
    ├── conversation.tsx
    ├── prompt-input.tsx
    ├── reasoning.tsx
    └── ...
```

Import using your configured alias:

```typescript
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message"
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation"
import { PromptInput, PromptInputTextarea, PromptInputSubmit } from "@/components/ai-elements/prompt-input"
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
```

---

## 4. Key AI Elements Components

### Message

Displays individual chat messages. Role-based styling via the `from` prop.

**Sub-components:**

| Component | Purpose |
|---|---|
| `<Message from="user\|assistant">` | Root container, role-based styling |
| `<MessageContent>` | Wrapper for content area |
| `<MessageResponse>` | Renders markdown (GFM, KaTeX math, syntax highlighting) |
| `<MessageActions>` | Container for action buttons below message |
| `<MessageAction tooltip="...">` | Individual action button with tooltip |
| `<MessageBranch>` | Manages multiple AI response versions |
| `<MessageBranchSelector>` | Navigation UI for branch switching |
| `<MessageToolbar>` | Horizontal layout container for actions + branch selector |

**MessageResponse props:**

```typescript
interface MessageResponseProps {
  children: string                    // markdown content
  parseIncompleteMarkdown?: boolean   // fix malformed markdown during stream (default: true)
  className?: string
  components?: Record<string, React.ComponentType>  // custom markdown renderers
  allowedImagePrefixes?: string[]     // URL whitelist (default: ["*"])
  allowedLinkPrefixes?: string[]      // URL whitelist (default: ["*"])
  rehypePlugins?: PluggableList       // includes KaTeX by default
  remarkPlugins?: PluggableList       // includes GFM + math by default
}
```

### Conversation

Container component for a full chat thread.

```typescript
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation"
```

Usage:

```tsx
<Conversation>
  <ConversationContent>
    {messages.map((message, index) => (
      <Message key={index} from={message.role}>
        <MessageContent>
          <MessageResponse>{message.content}</MessageResponse>
        </MessageContent>
      </Message>
    ))}
  </ConversationContent>
</Conversation>
```

### PromptInput

Composable input area for chat. Combines textarea + submit button.

```typescript
import {
  PromptInput as Input,
  PromptInputTextarea,
  PromptInputSubmit
} from "@/components/ai-elements/prompt-input"
```

Usage:

```tsx
<Input
  onSubmit={handleSubmit}
  className="mt-4 w-full max-w-2xl mx-auto relative"
>
  <PromptInputTextarea
    value={input}
    placeholder="Say something..."
    onChange={(e) => setInput(e.currentTarget.value)}
    className="pr-12"
  />
  <PromptInputSubmit
    status={status === 'streaming' ? 'streaming' : 'ready'}
    disabled={!input.trim()}
    className="absolute bottom-1 right-1"
  />
</Input>
```

### Reasoning

Displays AI chain-of-thought reasoning tokens. Collapsible panel with streaming support.

```typescript
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning"
```

Usage (within message parts iteration):

```tsx
case 'reasoning':
  return (
    <Reasoning
      key={`${message.id}-${i}`}
      className="w-full"
      isStreaming={status === 'streaming' && i === message.parts.length - 1}
    >
      <ReasoningTrigger />
      <ReasoningContent>{part.text}</ReasoningContent>
    </Reasoning>
  )
```

The `isStreaming` prop controls the live animation state. Requires `sendReasoning: true` on the backend.

### Tool (Tool Invocation Display)

AI Elements provides tool-call rendering components in the component registry. Install via:

```bash
npx ai-elements@latest add tool
```

For custom rendering without the pre-built component, handle tool invocation parts manually:

```tsx
case 'tool-invocation':
  return (
    <div key={i}>
      <strong>{part.toolInvocation.toolName}</strong>
      <pre>{JSON.stringify(part.toolInvocation.args, null, 2)}</pre>
    </div>
  )
```

### Complete Component Catalog

AI Elements organizes components into four categories:

**Chatbot**: Attachments, Chain of Thought, Checkpoint, Confirmation, Context, Conversation, Inline Citation, Message, Model Selector, Plan, Prompt Input, Queue, Reasoning, Shimmer, Sources, Suggestion, Task, Tool

**Code**: Agent, Artifact, Code Block, Commit, Environment Variables, File Tree, JSX Preview, Package Info, Sandbox, Schema Display, Snippet, Stack Trace, Terminal, Test Results, Web Preview

**Voice**: Audio Player, Mic Selector, Persona, Speech Input, Transcription, Voice Selector

**Workflow**: Canvas, Connection, Controls, Edge, Node, Panel, Toolbar

---

## 5. Connecting to a Custom Hono Backend (Non-Vercel)

This is the most important section for our use case. AI Elements components work with `useChat` from `@ai-sdk/react`, and `useChat` connects to any HTTP endpoint — not just Vercel/Next.js.

### Frontend: useChat with Custom Endpoint

AI SDK 5/6 uses `DefaultChatTransport` to configure the backend URL:

```typescript
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'

const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({
    api: 'http://localhost:8080/api/chat',  // our Hono server
    headers: {
      'Authorization': `Bearer ${token}`,   // optional auth
    },
    credentials: 'include',                  // if using cookies
  }),
})
```

For dynamic values (e.g., refreshed tokens):

```typescript
transport: new DefaultChatTransport({
  api: 'http://localhost:8080/api/chat',
  headers: () => ({
    Authorization: `Bearer ${getAuthToken()}`,
    'X-Session-ID': getSessionId(),
  }),
  body: () => ({
    sessionId: getCurrentSessionId(),
  }),
})
```

### Backend: Hono Server Setup

```typescript
import { serve } from '@hono/node-server'
import { streamText, convertToModelMessages, UIMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Required for Vite dev server cross-origin requests
app.use('/api/*', cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))

app.post('/api/chat', async (c) => {
  const { messages }: { messages: UIMessage[] } = await c.req.json()

  const result = streamText({
    model: anthropic('claude-opus-4-6'),
    messages: convertToModelMessages(messages),
    system: 'You are a helpful assistant.',
  })

  // Returns the data stream format that useChat expects
  return result.toUIMessageStreamResponse()
})

// Enable reasoning
app.post('/api/chat/reasoning', async (c) => {
  const { messages }: { messages: UIMessage[] } = await c.req.json()

  const result = streamText({
    model: anthropic('claude-opus-4-6'),
    messages: convertToModelMessages(messages),
    sendReasoning: true,    // enables Reasoning component
  })

  return result.toUIMessageStreamResponse({ sendReasoning: true })
})

serve({ fetch: app.fetch, port: 8080 })
```

### Required Header for Custom Backend

When implementing a custom streaming endpoint from scratch (without `toUIMessageStreamResponse()`), the frontend requires this header:

```
x-vercel-ai-ui-message-stream: v1
```

Without this header, `useChat` won't recognize the stream format.

### Stream Protocol Details

The default data stream protocol uses Server-Sent Events (SSE) format. `toUIMessageStreamResponse()` handles all of this automatically. The stream supports:

- Text deltas (`type: 'text-delta'`)
- Reasoning blocks (`type: 'reasoning'`)
- Tool calls and results
- Custom data (`type: 'data-*'` pattern)
- Step tracking
- Error events
- Final `[DONE]` marker

For plain text streaming (simpler, no tool calls):

```typescript
// Frontend
import { TextStreamChatTransport } from 'ai'

transport: new TextStreamChatTransport({ api: '/api/chat' })

// Backend
return result.toTextStreamResponse()
```

---

## 6. Complete Integration Example (Vite + Hono + AI Elements)

### Full Chat Component

```tsx
// src/components/Chat.tsx
"use client";  // not needed in Vite, but harmless

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse, MessageToolbar, MessageActions, MessageAction } from '@/components/ai-elements/message'
import { PromptInput, PromptInputTextarea, PromptInputSubmit } from '@/components/ai-elements/prompt-input'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { useState } from 'react'

export function Chat() {
  const [input, setInput] = useState('')

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: 'http://localhost:8080/api/chat',
    }),
  })

  const handleSubmit = () => {
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      <Conversation className="flex-1 overflow-y-auto">
        <ConversationContent>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent>
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return <MessageResponse key={i}>{part.text}</MessageResponse>
                    case 'reasoning':
                      return (
                        <Reasoning
                          key={i}
                          isStreaming={status === 'streaming' && i === message.parts.length - 1}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      )
                    case 'tool-invocation':
                      return (
                        <div key={i} className="text-sm text-muted-foreground">
                          Tool: {part.toolInvocation.toolName}
                        </div>
                      )
                    default:
                      return null
                  }
                })}
              </MessageContent>
              {message.role === 'assistant' && (
                <MessageToolbar>
                  <MessageActions>
                    <MessageAction tooltip="Copy">...</MessageAction>
                  </MessageActions>
                </MessageToolbar>
              )}
            </Message>
          ))}
        </ConversationContent>
      </Conversation>

      <PromptInput
        onSubmit={handleSubmit}
        className="border-t p-4"
      >
        <PromptInputTextarea
          value={input}
          placeholder="Type a message..."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <PromptInputSubmit
          status={status === 'streaming' ? 'streaming' : 'ready'}
          disabled={!input.trim()}
        />
      </PromptInput>
    </div>
  )
}
```

---

## 7. Non-Next.js Adaptation Notes

The official AI Elements docs assume Next.js App Router, but the components themselves are framework-agnostic React. Key adaptations for Vite/React:

1. **Remove `"use client"`** directives — not needed in Vite (or leave them, they're ignored)
2. **CORS**: Hono backend needs `cors()` middleware for `localhost:5173` → `localhost:8080` requests
3. **API routes**: Use Hono/Express instead of `app/api/chat/route.ts`
4. **No `maxDuration`**: That's a Vercel Edge config; not needed for local Hono
5. **Path aliases**: Must configure both `tsconfig.json` and `vite.config.ts` (Next.js does this automatically)
6. **Absolute API URL**: Use full URL `http://localhost:8080/api/chat` in dev (or proxy via Vite's `server.proxy`)

### Vite Dev Server Proxy (alternative to CORS)

Instead of CORS middleware, configure a proxy in `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
```

Then use `/api/chat` (relative URL) in `DefaultChatTransport` — same as Next.js convention.

---

## 8. Package Summary

```bash
# Core setup
npm install tailwindcss @tailwindcss/vite
npm install ai @ai-sdk/react @ai-sdk/anthropic

# shadcn/ui (via CLI, not npm)
npx shadcn@latest init -t vite

# AI Elements (via CLI, not npm)
npx ai-elements@latest add conversation message prompt-input reasoning

# Hono backend
npm install hono @hono/node-server
npm install @hono/cors  # or use hono/cors built-in
```

---

## Sources

- [AI Elements GitHub](https://github.com/vercel/ai-elements)
- [AI Elements Component Docs](https://elements.ai-sdk.dev)
- [AI Elements DeepWiki Installation](https://deepwiki.com/vercel/ai-elements/2.1-installation)
- [shadcn/ui Vite Installation](https://ui.shadcn.com/docs/installation/vite)
- [Tailwind CSS v4 Vite Installation](https://tailwindcss.com/docs/installation)
- [AI SDK Transport Docs](https://ai-sdk.dev/docs/ai-sdk-ui/transport)
- [AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [AI SDK Hono Example](https://ai-sdk.dev/examples/api-servers/hono)
- [LogRocket AI Elements Tutorial](https://blog.logrocket.com/vercel-ai-elements/)
- [npm: ai-elements](https://www.npmjs.com/package/ai-elements)
