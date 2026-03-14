# simple-ai.dev Research

**Date:** 2026-03-14
**Source:** https://www.simple-ai.dev/
**GitHub:** https://github.com/Alwurts/simple-ai
**Author:** Alwurts

---

## What Is simple-ai.dev?

simple-ai is an **open-source shadcn-style registry** of AI-focused UI components, copy-paste app blocks, and React Flow workflow templates for building AI-native React/Next.js applications. It is NOT an npm library you install — it is a component registry that copies source code directly into your project via the shadcn CLI (identical philosophy to shadcn/ui itself).

**Key characteristics:**
- Copy-paste ownership model (you own and customize the code)
- Built on top of shadcn/ui (requires it as a prerequisite)
- Deeply integrated with the Vercel AI SDK (`useChat`, `streamText`, `UIMessage`)
- TypeScript throughout
- MIT licensed, 744 GitHub stars, 84 forks (as of research date)
- Monorepo with a `cli/` package (`create-simple-ai`) and `docs/` package (documentation + registry)

**Three main categories:**
1. **UI Components** - Individual chat UI primitives
2. **Blocks** - Full application sections (multi-file, includes API routes)
3. **Workflows** - React Flow-based visual agent builders

---

## Installation Pattern

### Prerequisites

1. Set up shadcn/ui in your project first
2. Follow shadcn/ui's standard initialization

### Adding Components

All components use the shadcn CLI with the `@simple-ai/` scope:

```bash
npx shadcn@latest add @simple-ai/chat-message
npx shadcn@latest add @simple-ai/chat-input
npx shadcn@latest add @simple-ai/chat-message-area
# etc.
```

Each install command automatically:
- Copies component source files into your project
- Installs required npm dependencies
- Adds any required shadcn/ui sub-components

---

## All Components (UI Layer)

### 1. `chat-message`

**What it is:** Fully composable component for displaying individual chat messages with rich features.

**Install:** `npx shadcn@latest add @simple-ai/chat-message`

**Sub-components exported:**
- `ChatMessage` - Root wrapper container
- `ChatMessageAvatar` - Avatar display
- `ChatMessageAvatarImage` / `ChatMessageAvatarFallback` - Avatar variants
- `ChatMessageContainer` - Content wrapper
- `ChatMessageHeader` - Header with author + timestamp
- `ChatMessageAuthor` - Author name display
- `ChatMessageContent` - Message body
- `ChatMessageMarkdown` - Markdown rendering within message
- `ChatMessageActions` - Action buttons container
- `ChatMessageAction` - Individual action button (copy, like, etc.)
- `ChatMessageThread` - Thread display
- `ChatMessageThreadReplyCount` - Reply counter
- `ChatMessageThreadTimestamp` - Thread timestamp
- `ChatMessageThreadAction` - Thread interaction button

**Type system:** Messages accept `UIMessage` type from AI SDK. Supports generic metadata typing for custom member profiles, avatars, thread data.

**Usage pattern:**
```tsx
<ChatMessage message={message}>
  <ChatMessageAvatar>
    <ChatMessageAvatarFallback>AI</ChatMessageAvatarFallback>
  </ChatMessageAvatar>
  <ChatMessageContainer>
    <ChatMessageHeader>
      <ChatMessageAuthor>Assistant</ChatMessageAuthor>
    </ChatMessageHeader>
    <ChatMessageContent>
      <ChatMessageMarkdown content={message.content} />
    </ChatMessageContent>
    <ChatMessageActions>
      <ChatMessageAction>Copy</ChatMessageAction>
    </ChatMessageActions>
  </ChatMessageContainer>
</ChatMessage>
```

---

### 2. `chat-input`

**What it is:** TipTap-based rich text editor with mention support and auto-height adjustment.

**Install:** `npx shadcn@latest add @simple-ai/chat-input`

**Dependencies added:** TipTap editor packages

**Sub-components exported:**
- `ChatInput` - Root container managing state and context
- `ChatInputEditor` - TipTap editor instance
- `ChatInputMention` - Registers mention types with render prop pattern
- `ChatInputSubmitButton` - Adapts to loading/streaming states (shows stop button during streaming)
- `ChatInputGroupAddon` - Layout container for additional UI elements

**Key hook:** `useChatInput`
- Returns: `value`, `parsed` (content string + mention arrays), `handleSubmit()`, `mentionConfigs`
- Supports multiple mention trigger characters (`@`, `/`, custom)

**Basic usage:**
```tsx
const { value, onChange, handleSubmit } = useChatInput({
  onSubmit: (parsed) => {
    // parsed.content = text string
    // parsed.mentions = array of mentioned items
    append({ role: "user", content: parsed.content });
  }
});

return (
  <ChatInput onSubmit={handleSubmit} value={value} onChange={onChange}>
    <ChatInputEditor placeholder="Type a message..." />
    <ChatInputSubmitButton />
  </ChatInput>
);
```

**Features:**
- Enter to submit, Shift+Enter for newline
- Built-in streaming state (shows stop button when `isLoading`)
- Mention support for users, files, agents (e.g., `@weather-agent`)

---

### 3. `chat-message-area`

**What it is:** Smart auto-scrolling container for message lists. Handles the classic "scroll to bottom unless user scrolled up" problem correctly.

**Install:** `npx shadcn@latest add @simple-ai/chat-message-area`

**Dependencies added:** `use-stick-to-bottom`

**Sub-components:**
- `ChatMessageArea` - Root scrollable container
- `ChatMessageAreaContent` - Inner content wrapper
- `ChatMessageAreaScrollButton` - "Scroll to bottom" button (appears only when not at bottom)

**ChatMessageAreaScrollButton props:**
- `alignment`: `"left" | "right" | "center"` (default: right)

**Smart auto-scroll behavior:**
- Auto-scrolls to new messages only when user is at the bottom
- Disables auto-scroll when user scrolls up to review history
- Re-engages when user scrolls back down
- Pauses on touch while finger is on screen

**Usage:**
```tsx
<ChatMessageArea>
  <ChatMessageAreaContent className="px-4 py-8 space-y-4">
    {messages.map(m => <ChatMessage key={m.id} message={m} />)}
  </ChatMessageAreaContent>
  <ChatMessageAreaScrollButton />
</ChatMessageArea>
```

---

### 4. `chat-suggestions`

**What it is:** Composable clickable prompt suggestions for empty/onboarding states.

**Install:** `npx shadcn@latest add @simple-ai/chat-suggestions`

**Sub-components:**
- `ChatSuggestions` - Root container
- `ChatSuggestionsHeader` - Header wrapper
- `ChatSuggestionsTitle` - Title text
- `ChatSuggestionsDescription` - Subtitle/description text
- `ChatSuggestionsContent` - Container for suggestion buttons
- `ChatSuggestion` - Individual clickable prompt button

**Usage:**
```tsx
<ChatSuggestions>
  <ChatSuggestionsHeader>
    <ChatSuggestionsTitle>Try these prompts:</ChatSuggestionsTitle>
    <ChatSuggestionsDescription>Click to get started</ChatSuggestionsDescription>
  </ChatSuggestionsHeader>
  <ChatSuggestionsContent>
    <ChatSuggestion onClick={() => append({ role: "user", content: "What can you help me with?" })}>
      What can you help me with?
    </ChatSuggestion>
    <ChatSuggestion onClick={() => append({ role: "user", content: "Summarize this document" })}>
      Summarize this document
    </ChatSuggestion>
  </ChatSuggestionsContent>
</ChatSuggestions>
```

---

### 5. `markdown-content`

**What it is:** Memoized markdown renderer optimized for streaming content (avoids unnecessary re-renders).

**Install:** `npx shadcn@latest add @simple-ai/markdown-content`

**Dependencies added:** `react-markdown`, `marked`

**Key prop:**
- `id` (string) - required for memoization key
- `content` (string) - markdown string to render

**Supported features:**
- Bold, italic, strikethrough
- Headings h1–h6
- Ordered/unordered/nested/task lists
- Inline code and syntax-highlighted code blocks
- Tables
- Blockquotes (single and nested)
- Images and links
- Horizontal rules

**Streaming optimization:** Uses memoized blocks internally. Only re-renders modified sections as streaming content grows — critical for performance during long AI responses.

**Usage:**
```tsx
<MarkdownContent id={message.id} content={message.content} />
```

---

### 6. `jsx-renderer`

**What it is:** Dynamic JSX string renderer for AI-generated UI (generative UI). Renders JSX code strings as actual React components with error boundary protection.

**Install:** `npx shadcn@latest add jsx-renderer`

**Dependencies added:** `react-jsx-parser`, `react-error-boundary`

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `jsx` | string | JSX string to render |
| `components` | Record | Component map available in the JSX |
| `state` | string | "interactive" \| "disabled" \| "streaming" \| "error" \| "read-only" |
| `fixIncompleteJsx` | boolean | Auto-closes unclosed tags during streaming (default: true) |
| `onError` | function | Error callback |

**Usage:**
```tsx
<JsxRenderer
  jsx={aiGeneratedJsx}
  components={{ Button, Card, Input }}
  state="interactive"
  fixIncompleteJsx={true}
/>
```

**Primary use case:** AI generates JSX code strings, you render them live. The `app-01` block demonstrates this for a generative UI chat pattern.

---

### 7. `tool-invocation`

**What it is:** Collapsible display component for showing tool call inputs and outputs in chat.

**Install:** `npx shadcn@latest add @simple-ai/tool-invocation`

**Dependencies added:** `lucide-react`

**Sub-components:**
- `ToolInvocation` - Root container
- `ToolInvocationHeader` - Header section
- `ToolInvocationName` - Tool name with state indicator icon
- `ToolInvocationContentCollapsible` - Collapsible content section
- `ToolInvocationRawData` - Formatted data display (arguments, results, errors)

**States:** `"input-available"` (executing), `"output-available"` (complete), `"output-error"` (failed)

**Usage pattern (within message rendering):**
```tsx
{message.toolInvocations?.map(tool => (
  <ToolInvocation key={tool.toolCallId}>
    <ToolInvocationHeader>
      <ToolInvocationName
        name={tool.toolName}
        type={tool.state === "result" ? "output-available" : "input-available"}
        isError={false}
      />
    </ToolInvocationHeader>
    <ToolInvocationContentCollapsible title="Arguments">
      <ToolInvocationRawData data={tool.args} />
    </ToolInvocationContentCollapsible>
    {tool.state === "result" && (
      <ToolInvocationContentCollapsible title="Result">
        <ToolInvocationRawData data={tool.result} />
      </ToolInvocationContentCollapsible>
    )}
  </ToolInvocation>
))}
```

---

### 8. `model-selector`

**What it is:** Dropdown for selecting AI models across multiple providers.

**Install:** `npx shadcn@latest add model-selector`

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `value` | `Model` | Currently selected model |
| `onChange` | `(value: Model) => void` | Selection handler |
| `disabledModels` | `Model[]` | Models to disable |

**Supported models (hardcoded defaults):**
- OpenAI: `gpt-4o`, `gpt-4o-mini`
- Groq: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `deepseek-r1-distill-llama-70b`
- DeepSeek: `deepseek-chat`

Note: Claude/Anthropic models are NOT in the default list. Since this is copy-paste code, you add them manually after installation.

**Usage:**
```tsx
const [model, setModel] = useState<Model>("gpt-4o");

<ModelSelector value={model} onChange={setModel} />
```

---

### 9. `reasoning` (additional component)

**What it is:** AI reasoning display with streaming support. Shows chain-of-thought reasoning in a collapsible/expandable panel.

**Install:** `npx shadcn@latest add @simple-ai/reasoning`

Supports streaming state (reasoning appearing live as the model thinks), then collapses when complete.

---

## Blocks (Full Application Sections)

Blocks are multi-file complete implementations including API routes, state management, and full UI layouts.

### Chat Blocks

| Block | Install | Description |
|-------|---------|-------------|
| `chat-01` | `npx shadcn add @simple-ai/chat-01` | Basic full-page chat interface |
| `chat-02` | `npx shadcn add @simple-ai/chat-02` | Chat in a sidebar panel |
| `chat-03` | `npx shadcn add @simple-ai/chat-03` | Chat in a popover/floating window (bottom-right) |
| `chat-04` | `npx shadcn add @simple-ai/chat-04` | Multi-agent chat with agent selection and sidebar nav |

### App Blocks

| Block | Install | Description |
|-------|---------|-------------|
| `app-01` | `npx shadcn add @simple-ai/app-01` | Generative UI — AI writes JSX, you render it live |
| `app-02` | `npx shadcn add @simple-ai/app-02` | Persona generator with structured outputs (Zod schemas) |
| `app-03` | Not confirmed | Additional app block |

### Workflow Blocks

| Block | Install | Description |
|-------|---------|-------------|
| `workflow-01` | `npx shadcn add @simple-ai/workflow-01` | Full visual workflow builder (React Flow canvas + chat sidebar) |
| `flow-chain` | Not confirmed | Chain workflow pattern |
| `flow-routing` | Not confirmed | Routing/branching workflow |
| `flow-parallelization` | Not confirmed | Parallel execution pattern |
| `flow-orchestrator` | Not confirmed | Orchestrator-workers pattern |

---

## Workflow / React Flow Components

Separate from chat components — these are React Flow node types for visual workflow building.

### Workflow Node Types

| Node | Description |
|------|-------------|
| **Start Node** | Entry point — receives initial user message |
| **Agent Node** | AI processing unit — configurable model, system prompt, tools, max steps, output format |
| **If-Else Node** | Conditional routing using CEL (Common Expression Language) |
| **Wait Node** | Pause execution for specified duration (seconds/minutes/hours) |
| **End Node** | Terminates an execution path |
| **Note Node** | Documentation annotation, non-executable |

### React Flow UI Components

| Component | Install | Description |
|-----------|---------|-------------|
| `editable-handle` | `npx shadcn add @simple-ai/editable-handle` | Dynamic add/edit/remove handles on nodes |
| `generate-text-node` | In registry | AI text generation node for canvas |
| `prompt-crafter-node` | In registry | Prompt template builder node |
| `resizable-node` | In registry | Nodes that can be resized by dragging |
| `status-edge` | In registry | Edges with execution state visualization |
| `text-input-node` | In registry | User text input node |
| `visualize-text-node` | In registry | Display text output on canvas |

### Workflow Architecture Pattern

Each node type is split into three files:
```
my-node.shared.ts    # Zod schemas + TypeScript types (shared client/server)
my-node.client.tsx   # React Flow canvas component + editor panel UI
my-node.server.ts    # Backend execution logic
```

Workflows are serializable data — save to database, load from database, execute programmatically or visually.

### Workflow Patterns Supported

1. **Chain** — Sequential steps where each validates/depends on previous output
2. **Routing** — Analyzes input and routes to specialized agents (content type → correct agent)
3. **Parallelization** — Spawns multiple agents simultaneously, aggregates results
4. **Orchestrator-Workers** — Coordinator analyzes task and dispatches to specialist agents

---

## How Components Connect to Vercel AI SDK

The entire library is designed around the Vercel AI SDK:

### Client Side (`useChat` hook)
```tsx
import { useChat } from "ai/react";

const { messages, input, handleInputChange, handleSubmit, isLoading, stop, append } = useChat({
  api: "/api/chat",
});
```

### Server Side (`streamText`)
```tsx
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = await streamText({
    model: openai("gpt-4o"),
    messages,
  });
  return result.toDataStreamResponse();
}
```

### Component Integration Pattern
All components consume `UIMessage` from `"ai"` package. The chat-message component is typed to accept `UIMessage` directly:
```tsx
{messages.map((message) => (
  <ChatMessage key={message.id} message={message as UIMessage} />
))}
```

### Agent Registry Pattern (chat-04)

Multi-agent routing uses a registry file:
```typescript
// lib/ai/agents/agents-registry.ts
export const agentsRegistry = {
  "weather-agent": { ... },
  "search-agent": { ... },
};
```

Users trigger agents via `@mention` in the chat input. The `ChatInputMention` component handles this:
```tsx
<ChatInputMention
  trigger="@"
  items={Object.keys(agentsRegistry)}
/>
```

---

## Structural Patterns for Chat UI

### Full-Page Chat Structure (chat-01 pattern)
```
<Layout>
  <Sidebar>  {/* session list, nav */}
  <Main>
    <Header>
      <ModelSelector />
    </Header>
    <ChatMessageArea>
      <ChatMessageAreaContent>
        {messages.length === 0 && <ChatSuggestions />}
        {messages.map(m => (
          <ChatMessage message={m}>
            <ChatMessageMarkdown />
            {m.toolInvocations?.map(t => <ToolInvocation />)}
          </ChatMessage>
        ))}
      </ChatMessageAreaContent>
      <ChatMessageAreaScrollButton />
    </ChatMessageArea>
    <ChatInput>
      <ChatInputEditor />
      <ChatInputSubmitButton />
    </ChatInput>
  </Main>
</Layout>
```

### Sidebar Chat (chat-02 pattern)
- Main content area on left
- Collapsible chat sidebar on right
- Controlled by sidebar open/close state

### Popover Chat (chat-03 pattern)
- Fixed position button in bottom-right corner
- Opens as floating card overlay
- Doesn't interrupt main content

### Multi-Agent Chat (chat-04 pattern)
- Left sidebar: agent list + session history
- Main area: chat with agent identity shown in messages
- Mention agents in input to route messages

---

## Comparison to AI SDK Elements (elements.ai-sdk.dev)

| Aspect | simple-ai.dev | AI SDK Elements |
|--------|--------------|-----------------|
| **Maintained by** | Community (Alwurts) | Vercel (official) |
| **Install method** | `npx shadcn add @simple-ai/...` | `npx shadcn add https://elements.ai-sdk.dev/api/registry/...` |
| **Philosophy** | Copy-paste, you own the code | Copy-paste, same model |
| **Component depth** | More components, richer composition | Fewer but more official |
| **Workflow/Agent UI** | React Flow visual builders included | No workflow builder |
| **Blocks** | Full app sections (multi-file) | Component-level only |
| **AI SDK version** | AI SDK v4 (`useChat` from `"ai/react"`) | AI SDK v4 |
| **Model support** | OpenAI/Groq/DeepSeek defaults | Provider-agnostic |
| **TipTap editor** | Yes (chat-input) | No (basic textarea) |
| **Streaming markdown** | Memoized blocks | Standard |
| **Generative UI** | JSX renderer included | Not included |
| **React Flow** | Fully integrated | Not included |
| **Stars** | 744 | Newer, fewer |

**Key takeaway:** simple-ai is significantly more feature-rich and opinionated for chat/agent UI. AI SDK Elements is leaner and more official. For a Tauri desktop app, simple-ai provides more ready-to-use patterns.

---

## Patterns to Steal for Claude-Tauri Boilerplate

### High-Value Patterns

**1. ChatMessageArea auto-scroll logic**
Use the `use-stick-to-bottom` package directly or copy the component. The "only auto-scroll if user is at the bottom" behavior is essential for usable streaming chat.

**2. ChatInput with TipTap**
Far superior to a plain `<textarea>`. Provides:
- Mention support for switching Claude models (`@claude-3-5-sonnet`, `@claude-opus`)
- Shift+Enter newlines
- Streaming stop button integrated into submit area

**3. ChatMessage composable structure**
The sub-component pattern (Avatar, Container, Header, Content, Actions) is exactly right for a boilerplate — consumers customize at any level.

**4. ToolInvocation display**
Claude's tool use needs UI. This component handles the input-available → output-available → output-error state machine well.

**5. Multi-agent routing pattern (chat-04)**
Even for a single-Claude-model app, the agent registry pattern is useful for routing to different system prompts or tools.

**6. Workflow node architecture (.shared/.client/.server)**
If the boilerplate ever includes visual workflow building, this three-file pattern per node type is clean and maintainable.

**7. Persona/structured output block (app-02)**
Demonstrates Zod schema + `streamObject` from AI SDK — a common Claude use case.

### Direct Usage

Since all components are copy-paste, you can:
1. Install: `npx shadcn@latest add @simple-ai/chat-message-area @simple-ai/chat-message @simple-ai/chat-input @simple-ai/markdown-content @simple-ai/tool-invocation`
2. Modify `model-selector` to include `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-3-5`
3. Replace `@ai-sdk/openai` with `@ai-sdk/anthropic` in API routes
4. The UI components themselves are provider-agnostic

### Tauri-Specific Considerations

- All components are client-side React — compatible with Tauri's webview
- The server-side blocks (`/api/chat` routes) need to be rewritten as Tauri commands or proxied through a local server
- `useChat` by default targets `/api/chat` — in Tauri you either run a local HTTP server or use a custom `fetch` override to call Tauri commands
- The React Flow workflow components work fine in Tauri webview (no server needed for the canvas itself)

---

## Key Dependencies Summary

| Package | Purpose |
|---------|---------|
| `shadcn/ui` | Base component system (prerequisite) |
| `ai` / `@ai-sdk/react` | Vercel AI SDK (`useChat`, `UIMessage`) |
| `@ai-sdk/openai` | OpenAI provider (swap for `@ai-sdk/anthropic`) |
| `@xyflow/react` | React Flow for workflow canvas |
| `zustand` | State management in workflow blocks |
| `zod` | Schema validation for structured outputs |
| `@tiptap/react` | Rich text editor for ChatInput |
| `use-stick-to-bottom` | Auto-scroll logic for ChatMessageArea |
| `react-markdown` + `marked` | Markdown rendering |
| `react-jsx-parser` | Dynamic JSX rendering (app-01) |
| `react-error-boundary` | Error handling for JSX renderer |
| `lucide-react` | Icons throughout |

---

## Sources

- [simple-ai.dev](https://www.simple-ai.dev/) - Main site
- [GitHub: Alwurts/simple-ai](https://github.com/Alwurts/simple-ai) - Source code
- [simple-ai.dev/docs](https://www.simple-ai.dev/docs) - Documentation
- [simple-ai.dev/blocks/chat](https://www.simple-ai.dev/blocks/chat) - Chat blocks
- [simple-ai.dev/ai-agents](https://www.simple-ai.dev/ai-agents) - Agent builder
- [simple-ai.dev/ai-workflows](https://www.simple-ai.dev/ai-workflows) - Workflow builder
- [alwurts.com/content/software/simple-ai](https://www.alwurts.com/content/software/simple-ai) - Author's description
