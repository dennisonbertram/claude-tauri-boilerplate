# AI SDK Elements - Investigation Report

**Date**: 2026-03-14
**Sources**: elements.ai-sdk.dev, vercel/ai-elements GitHub, Context7, Vercel changelog, web search

---

## What Is AI SDK Elements?

AI Elements is an open-source React component library built on top of shadcn/ui, released by Vercel to accelerate development of AI-native applications. It replaces the older ChatSDK with a more flexible, composable set of UI building blocks.

Key attributes:
- Deep integration with the Vercel AI SDK (uses `useChat`, `streamText`, `convertToModelMessages`, etc.)
- Streaming, status states, and type safety built-in
- Built targeting React 19 (no `forwardRef` usage) and Tailwind CSS 4
- Installs component source code directly into your project (shadcn-style ownership model — you own the code)
- Components default to `@/components/ai-elements/` directory

GitHub: https://github.com/vercel/ai-elements
Docs: https://elements.ai-sdk.dev
Stats: ~1.8k stars, 220 forks, v1.9.0 latest, actively maintained by Vercel

---

## How It Relates to `useChat` / the Vercel AI SDK

AI Elements is the **UI layer** on top of the Vercel AI SDK. The SDK handles:
- State management and streaming (`useChat`, `streamText`)
- Model abstraction and provider routing
- Message parts, tool calls, reasoning, attachments

AI Elements handles:
- Rendering those message parts into React UI
- Streaming-aware display (e.g., `Reasoning` auto-opens during streaming, closes when done)
- Optimized streaming markdown rendering without re-parsing entire content on each chunk
- Tool call visualization with states (input-streaming, output-available, error, approval-requested, etc.)
- File attachments, model selection, voice, workflow canvas

The canonical backend pattern:
```typescript
import { streamText, UIMessage, convertToModelMessages } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: 'openai/gpt-4o',
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
```

For reasoning models, add `sendReasoning: true`:
```typescript
return result.toUIMessageStreamResponse({ sendReasoning: true });
```

---

## Installation and Setup

### Prerequisites
- Node.js 18+
- Next.js project with AI SDK installed
- shadcn/ui initialized
- Tailwind CSS (CSS Variables mode only)

### Installation Methods

**Option 1: AI Elements CLI (recommended)**
```bash
npx ai-elements@latest
```

**Option 2: shadcn CLI**
```bash
npx shadcn@latest add https://elements.ai-sdk.dev/api/registry/all.json
```

**Option 3: Individual components**
```bash
npx ai-elements@latest add <component-name>
# e.g.:
npx ai-elements@latest add message
npx ai-elements@latest add prompt-input
npx ai-elements@latest add conversation
```

### Critical CSS Setup
The `MessageResponse` component requires this CSS import — it will not work without it:
```css
@source "../node_modules/streamdown/dist/*.js";
```

### Environment Variable (Optional)
```
AI_GATEWAY_API_KEY=<your-key>
```

---

## Component Categories and Full Component List

### Chatbot Components
| Component | Purpose |
|-----------|---------|
| `Attachment` | File upload previews with remove controls |
| `ChainOfThought` | Displays multi-step reasoning chains |
| `Checkpoint` | Milestone/progress markers in conversations |
| `Confirmation` | User confirmation dialogs for tool actions |
| `Context` | Token usage, context window utilization, cost estimation |
| `Conversation` | Scrollable container for message history |
| `InlineCitation` | Source attribution inline in responses |
| `Loader` | Animated loading states during streaming |
| `Message` | Individual user or assistant message display |
| `ModelSelector` | Dropdown for switching AI models |
| `Plan` | Displays structured plans and task lists |
| `PromptInput` | Full-featured text input with attachments, model select, web search |
| `Queue` | Message and todo queue with attachments |
| `Reasoning` | Collapsible thinking display for reasoning models |
| `Response` | Formatted AI reply rendering |
| `Shimmer` | Text skeleton animation during streaming |
| `Sources` | Source attribution with expandable list |
| `Suggestion` | Quick-action suggestions in empty state |
| `Task` | Task completion tracking display |
| `Tool` | Tool/function call visualization with state |

### Code / Vibe-Coding Components
| Component | Purpose |
|-----------|---------|
| `Agent` | Agent status and execution display |
| `Artifact` | Code or document artifact display |
| `CodeBlock` | Syntax-highlighted code with copy button |
| `Commit` | Git commit display |
| `EnvironmentVariables` | Env var management display |
| `FileTree` | File system tree visualization |
| `JSXPreview` | Live JSX rendering |
| `PackageInfo` | NPM package information |
| `Sandbox` | Sandboxed code execution display |
| `SchemaDisplay` | JSON schema visualization |
| `Snippet` | Code snippet display |
| `StackTrace` | Error stack trace display |
| `Terminal` | Terminal output display |
| `TestResults` | Test run results display |
| `WebPreview` | Embedded web page preview |

### Voice Components
| Component | Purpose |
|-----------|---------|
| `AudioPlayer` | Audio playback controls |
| `MicSelector` | Microphone device selection |
| `Persona` | AI persona/avatar display |
| `SpeechInput` | Web Speech API voice input |
| `Transcription` | Speech-to-text output display |
| `VoiceSelector` | Voice/TTS selection |

### Workflow Components (powered by ReactFlow / @xyflow/react)
| Component | Purpose |
|-----------|---------|
| `Canvas` | ReactFlow canvas container |
| `Connection` | Workflow connection/edge display |
| `Controls` | Canvas zoom/pan controls |
| `Edge` | Connection between nodes |
| `Node` | Workflow graph node |
| `Panel` | Canvas overlay panel |
| `Toolbar` | Node toolbar |

### Utility Components
| Component | Purpose |
|-----------|---------|
| `Image` | AI-generated image display |
| `OpenInChat` | Opens messages in chat interface |

---

## Key Component APIs

### `<Message />`
```tsx
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction, MessageToolbar, MessageBranch } from '@/components/ai-elements/message';

<Message from="assistant">  {/* from: "user" | "assistant" | "system" */}
  <MessageContent>
    <MessageResponse
      parseIncompleteMarkdown={true}  // auto-fix broken markdown during streaming
      components={{}}                  // custom markdown renderers
      allowedImagePrefixes={["*"]}
      allowedLinkPrefixes={["*"]}
    >
      {markdownString}
    </MessageResponse>
  </MessageContent>
  <MessageToolbar>
    <MessageActions>
      <MessageAction tooltip="Copy" label="Copy message">
        <CopyIcon />
      </MessageAction>
    </MessageActions>
  </MessageToolbar>
</Message>
```

Supports branching (multiple response versions):
```tsx
<MessageBranch defaultBranch={0} onBranchChange={(i) => {}}>
  <MessageBranchContent>{/* active branch */}</MessageBranchContent>
  <MessageBranchSelector>
    <MessageBranchPrevious />
    <MessageBranchPage />
    <MessageBranchNext />
  </MessageBranchSelector>
</MessageBranch>
```

### `<Conversation />`
```tsx
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';

<Conversation className="h-[600px]">
  <ConversationContent>
    {messages.length === 0 ? (
      <ConversationEmptyState
        title="Welcome"
        description="Send a message to start"
        icon={<MessageSquareIcon />}
      />
    ) : (
      messages.map((msg, i) => <Message key={i} from={msg.role}>...</Message>)
    )}
  </ConversationContent>
  <ConversationScrollButton />
</Conversation>
```

### `<PromptInput />`
```tsx
import {
  PromptInput, PromptInputProvider, PromptInputTextarea, PromptInputFooter,
  PromptInputSubmit, PromptInputTools, PromptInputActionMenu,
  PromptInputActionMenuTrigger, PromptInputActionMenuContent,
  PromptInputActionAddAttachments, PromptInputButton, PromptInputSelect,
  usePromptInputAttachments, usePromptInputController,
} from '@/components/ai-elements/prompt-input';

<PromptInput
  onSubmit={({ text, files }) => { /* handle submit */ }}
  accept="image/*"
  multiple={true}
  globalDrop={true}          // accept drops anywhere on page
  maxFiles={5}
  maxFileSize={10_000_000}   // bytes
  onError={(code) => {}}     // "max_files" | "max_file_size" | "accept"
>
  <PromptInputHeader>
    {/* attachment previews go here */}
  </PromptInputHeader>
  <PromptInputBody>
    <PromptInputTextarea placeholder="Type..." />
  </PromptInputBody>
  <PromptInputFooter>
    <PromptInputTools>
      <PromptInputActionMenu>
        <PromptInputActionMenuTrigger />
        <PromptInputActionMenuContent>
          <PromptInputActionAddAttachments />
        </PromptInputActionMenuContent>
      </PromptInputActionMenu>
      <PromptInputButton tooltip={{ content: "Search", shortcut: "⌘K", side: "bottom" }}>
        <GlobeIcon />
      </PromptInputButton>
    </PromptInputTools>
    <PromptInputSubmit status={status} onStop={stop} />
  </PromptInputFooter>
</PromptInput>
```

Hooks:
- `usePromptInputAttachments()` — `{ files, add, remove, clear, openFileDialog }`
- `usePromptInputController()` — `{ textInput: { value, setInput, clear }, attachments }`
- `usePromptInputReferencedSources()` — `{ sources, add, remove, clear }`

`PromptInputSubmit` accepts a `status` prop matching AI SDK's `useChat` status values.

### `<Reasoning />`
```tsx
import { Reasoning, ReasoningTrigger, ReasoningContent, useReasoning } from '@/components/ai-elements/reasoning';

<Reasoning
  isStreaming={status === 'streaming' && isLastPart}  // auto-opens during stream, closes after
  defaultOpen={true}
  onOpenChange={(open) => {}}
  duration={42}  // seconds, optional override
>
  <ReasoningTrigger
    getThinkingMessage={(streaming, duration) =>
      streaming ? 'Thinking...' : `Thought for ${duration}s`
    }
  />
  <ReasoningContent>{reasoningText}</ReasoningContent>
</Reasoning>
```

Internal hook (use inside children):
```tsx
const { isStreaming, isOpen, setIsOpen, duration } = useReasoning();
```

### `<Tool />`
```tsx
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';

// Tool states: 'input-streaming' | 'input-available' | 'approval-requested' |
//              'approval-responded' | 'output-available' | 'output-error' | 'output-denied'

<Tool defaultOpen={false}>
  <ToolHeader
    title="Weather Lookup"
    type={part.type}        // e.g. "tool-call-weather"
    state={part.state}      // from AI SDK message part
  />
  <ToolContent>
    <ToolInput input={part.input} />
    <ToolOutput output={part.output} errorText={part.errorText} />
  </ToolContent>
</Tool>
```

### `<Context />`
```tsx
import { Context, ContextTrigger, ContextContent } from '@/components/ai-elements/context';

<Context
  maxTokens={128000}          // model's total context window
  usedTokens={42000}          // tokens consumed so far
  usage={languageModelUsage}  // from AI SDK's usage object
  modelId="openai:gpt-4o"    // for cost calculation via tokenlens
>
  <ContextTrigger />
  <ContextContent />
</Context>
```

Displays: context window utilization bar, token breakdown (input/output/reasoning/cache), and cost estimate in USD.

### `<Canvas />` (Workflow)
```tsx
import { Canvas, Controls, Panel, Node, Edge } from '@/components/ai-elements/*';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';

<Canvas nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}>
  <Controls />
  <Panel position="top-left">...</Panel>
</Canvas>
```

Requires `@xyflow/react` as a dependency.

---

## Complete Chat Application Pattern

```tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { Conversation, ConversationContent, ConversationScrollButton, ConversationEmptyState } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse, MessageActions, MessageAction, MessageToolbar } from '@/components/ai-elements/message';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Loader } from '@/components/ai-elements/loader';
import { Sources, SourcesTrigger, SourcesContent, Source } from '@/components/ai-elements/sources';
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion';

export default function ChatApp() {
  const { messages, sendMessage, status, stop, reload } = useChat({ api: '/api/chat' });

  const handleSubmit = ({ text, files }) => {
    if (!text && !files?.length) return;
    sendMessage({ text: text || 'Sent with attachments', files });
  };

  return (
    <div className="flex h-screen flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 && (
            <ConversationEmptyState title="How can I help?" description="Ask anything" />
          )}

          {messages.map((message) => (
            <div key={message.id}>
              {/* Sources (web search) */}
              {message.role === 'assistant' && message.parts.filter(p => p.type === 'source-url').length > 0 && (
                <Sources>
                  <SourcesTrigger count={message.parts.filter(p => p.type === 'source-url').length} />
                  {message.parts.filter(p => p.type === 'source-url').map((part, i) => (
                    <SourcesContent key={i}>
                      <Source href={part.url} title={part.url} />
                    </SourcesContent>
                  ))}
                </Sources>
              )}

              {/* Message parts */}
              {message.parts.map((part, i) => {
                const isStreamingThisPart = status === 'streaming' && i === message.parts.length - 1 && message.id === messages.at(-1)?.id;

                switch (part.type) {
                  case 'text':
                    return (
                      <Message key={i} from={message.role}>
                        <MessageContent>
                          <MessageResponse>{part.text}</MessageResponse>
                        </MessageContent>
                        {message.role === 'assistant' && (
                          <MessageToolbar>
                            <MessageActions>
                              <MessageAction tooltip="Regenerate" onClick={reload}>...</MessageAction>
                            </MessageActions>
                          </MessageToolbar>
                        )}
                      </Message>
                    );
                  case 'reasoning':
                    return (
                      <Reasoning key={i} isStreaming={isStreamingThisPart}>
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  case 'tool-call':
                  case 'tool-result':
                    return (
                      <Tool key={i}>
                        <ToolHeader type={part.type} state={part.state} />
                        <ToolContent>
                          <ToolInput input={part.input} />
                          <ToolOutput output={part.output} errorText={part.errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  default: return null;
                }
              })}
            </div>
          ))}

          {status === 'submitted' && <Loader />}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {messages.length === 0 && (
        <Suggestions>
          <Suggestion suggestion="Explain React hooks" onClick={(s) => sendMessage({ text: s })} />
        </Suggestions>
      )}

      <PromptInput onSubmit={handleSubmit} globalDrop multiple>
        <PromptInputTextarea placeholder="Type your message..." />
        <PromptInputFooter>
          <div />
          <PromptInputSubmit status={status} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
```

---

## Examples Showcased on the Site

| Example | Description |
|---------|-------------|
| **Chatbot** | Full chat UI with reasoning, sources, attachments, model selection |
| **IDE** | VS Code-like interface with file tree, terminal, code artifacts |
| **v0 Clone** | Generative UI builder with artifact and web preview |
| **Workflow Builder** | ReactFlow-based AI agent workflow editor |

---

## How It Relates to Our Project (Claude Agent SDK + Streaming)

This project (claude-tauri-boilerplate) uses the Claude AI API with streaming responses in a Tauri/React app. AI Elements is highly relevant:

1. **MessageResponse + streaming**: The `MessageResponse` component is optimized for streaming markdown — it handles incremental updates without re-parsing the full content, which is exactly what we need for Claude's streamed responses.

2. **Reasoning display**: Claude's extended thinking (when enabled) produces reasoning parts. The `Reasoning` component handles this perfectly — auto-opens during streaming, auto-closes when done, shows elapsed time.

3. **Tool call visualization**: Claude uses tool calls for agent functionality. The `Tool` component visualizes all tool states (`input-streaming`, `output-available`, `output-error`, approval flows).

4. **PromptInput**: The `PromptInput` component is far more capable than a basic textarea — it handles attachments, model selection, keyboard shortcuts, drag-and-drop, and integrates with `useChat`'s `status` prop for submit/stop state.

5. **Streaming via SSE**: AI SDK now uses Server-Sent Events as the standard streaming protocol — natively supported everywhere, debuggable in browser devtools. Our Tauri app's fetch/stream approach would integrate naturally.

6. **Not Next.js-specific**: While docs focus on Next.js, the components are React components that could work in a Tauri/Vite/React setup. The main consideration is the API route pattern — we'd adapt that to our backend.

### Potential Integration Path
1. Install shadcn/ui and configure Tailwind CSS 4 in the Tauri app
2. Use `npx ai-elements@latest add message conversation prompt-input reasoning tool` to pull in components
3. Wire `useChat` from `@ai-sdk/react` to our Claude API endpoint (or use the SDK's `streamText` with our Tauri IPC layer)
4. Replace any custom message/input components with AI Elements equivalents

### Caveats
- Requires React 19 and Tailwind CSS 4
- Components are installed as source code (shadcn model) — not imported from npm
- `MessageResponse` requires the streamdown CSS source import to render correctly
- Workflow/Canvas components require `@xyflow/react` as an additional dependency
- Voice components use Web Speech API (browser-only, available in Tauri's webview)

---

## Summary of Tech Stack
- **React 19** — no forwardRef
- **Tailwind CSS 4** — CSS Variables mode required
- **shadcn/ui** — base component primitives
- **streamdown** — streaming markdown renderer (used by MessageResponse)
- **@xyflow/react** — ReactFlow for Canvas/workflow components
- **tokenlens** — token cost calculation (used by Context component)
- **Radix UI** — collapsibles, hover cards, etc. (via shadcn)
- **@ai-sdk/react** — `useChat`, `useCompletion` hooks
- **ai** — `streamText`, `convertToModelMessages`, `UIMessage` types

---

## Sources
- [AI Elements homepage](https://elements.ai-sdk.dev/)
- [AI Elements docs](https://elements.ai-sdk.dev/docs)
- [GitHub: vercel/ai-elements](https://github.com/vercel/ai-elements)
- [Vercel changelog: Introducing AI Elements](https://vercel.com/changelog/introducing-ai-elements)
- [Vercel Academy: AI Elements](https://vercel.com/academy/ai-sdk/ai-elements)
- [shadcn/ui AI components](https://www.shadcn.io/ai)
- [Inkeep: Build chat UIs with AI Elements](https://docs.inkeep.com/talk-to-your-agents/vercel-ai-sdk/ai-elements)
- [InfoQ: Vercel Releases AI Elements](https://www.infoq.com/news/2025/08/vercel-ai-sdk/)
- Context7: /vercel/ai-elements (344-475 code snippets, High reputation, Benchmark 88.9)
