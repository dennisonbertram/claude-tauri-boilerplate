# WhatsApp Connector Research

**Issue**: #373
**Date**: 2026-03-25
**Status**: Research Complete

---

## 1. Executive Summary

A WhatsApp connector for the desktop app is feasible via two fundamentally different paths: the **official WhatsApp Cloud API** (Business-oriented, Meta-hosted, per-message pricing) or the **unofficial WhatsApp Web protocol** via libraries like Baileys or whatsapp-web.js (personal account, QR-code auth, free but ToS-violating). A critical policy change from Meta effective January 15, 2026 **bans general-purpose AI chatbots** from the WhatsApp Business Platform, which directly impacts any Cloud API approach that positions itself as an AI assistant. The unofficial/Web protocol path avoids this policy but carries account-ban risk. Given the app's nature as a personal desktop tool (not a business SaaS), the **Baileys-based approach is the pragmatic recommendation**, with Cloud API as an optional "bring your own Business API key" path for enterprise users.

---

## 2. API Reference

### Official: WhatsApp Cloud API (Meta)

- **Endpoint**: `https://graph.facebook.com/v21.0/{phone_number_id}/messages`
- **Auth**: Bearer token (System User token or OAuth via Facebook Login for Business)
- **Rate limits**: 80 messages/second (Business tier), 1,000 recipients/day default
- **Pricing** (post July 2025): Per-message pricing (PMP). Service conversations free. Utility templates free within 24h customer service window. Marketing templates ~$0.02-0.08/msg depending on country.
- **Key constraint**: Requires a Meta Business account, verified business, and a dedicated phone number. Cannot use your personal WhatsApp number.
- **AI policy**: As of Jan 15, 2026, general-purpose AI assistants are **banned** from the Business Platform. Only task-specific bots for existing business services are permitted.

### Unofficial: WhatsApp Web Multi-Device Protocol

- **Protocol**: Noise protocol (Signal-based E2E encryption), WebSocket to WhatsApp servers
- **Auth**: QR code scan from phone, then persistent session keys stored locally
- **Rate limits**: Implicit (too many messages = temp ban). No official documentation.
- **Pricing**: Free (uses personal WhatsApp account)
- **Key constraint**: Reverse-engineered protocol; no stability guarantees. WhatsApp can break it with server-side changes at any time.

### Third-Party Hosted: GreenAPI, Evolution API

- **GreenAPI**: REST API wrapper around WhatsApp Web protocol. Freemium ($0-15/mo). Hosted service.
- **Evolution API**: Open-source self-hosted WhatsApp gateway using Baileys under the hood. Docker-based.

---

## 3. Existing MCP Servers

### lharries/whatsapp-mcp (Python + Go, 3.2k+ stars)

- **Architecture**: Go bridge (whatsmeow library) + Python MCP server
- **Tools**: `search_contacts`, `list_messages`, `send_message`, `send_file`, `send_audio_message`, `download_media`
- **Auth**: QR code scan via terminal
- **Storage**: Local SQLite database for message history
- **Pros**: Most mature, active community, media support, privacy-first (local storage)
- **Cons**: Python + Go dependencies; cannot embed in a TypeScript/Bun server process

### jlucaso1/whatsapp-mcp-ts (TypeScript + Baileys)

- **Architecture**: Pure TypeScript using `@whiskeysockets/baileys`
- **Tools**: `search_contacts`, `list_messages`, `list_chats`, `get_chat`, `get_message_context`, `send_message`
- **Auth**: QR code displayed in terminal
- **Pros**: Same language as our stack; directly reusable patterns
- **Cons**: Fewer features than lharries version; no media send/receive tools yet

### FelixIsaac/whatsapp-mcp-extended (Fork of lharries, 41 tools)

- **Extended tools**: Reactions, group management, polls, presence tracking, newsletters
- **Demonstrates**: The full scope of what's possible with the Web protocol

### msaelices/whatsapp-mcp-server (Python + GreenAPI)

- **Architecture**: Python FastMCP server using GreenAPI as backend
- **Pros**: Simple, hosted infrastructure
- **Cons**: Dependency on third-party paid service; Python

---

## 4. Recommended Implementation

### Primary Path: Baileys-based In-Process Connector

Use `@whiskeysockets/baileys` directly within the Bun server process, following the existing `ConnectorDefinition` pattern.

**Architecture:**

```
apps/server/src/connectors/whatsapp/
  index.ts          # ConnectorDefinition (category: 'communication', requiresAuth: true)
  tools.ts          # Tool definitions using sdk tool() helper
  api.ts            # Baileys wrapper: connection, auth state, message send/receive
  auth.ts           # QR code generation, session persistence
  store.ts          # Local message cache (SQLite via bun:sqlite)
  types.ts          # WhatsApp-specific types
  __tests__/
    tools.test.ts
    api.test.ts
    store.test.ts
```

**Auth Flow:**

1. User enables WhatsApp connector in settings
2. Server generates QR code via Baileys `WASocket`
3. QR code sent to frontend via existing WebSocket/SSE channel
4. User scans QR with phone camera
5. Baileys receives auth credentials, persisted to `~/.claude-tauri/whatsapp-auth/`
6. Subsequent launches use stored credentials (no re-scan needed unless session expires)

**Why Baileys over Cloud API as primary:**

- Desktop app is personal-use, not a business SaaS
- No Meta Business account requirement
- No per-message costs
- The Jan 2026 AI chatbot ban makes Cloud API legally risky for this use case
- Baileys is actively maintained (7.9k stars, regular releases through 2026)
- TypeScript native -- fits our stack perfectly

### Secondary Path (Optional): Cloud API "BYOK" Mode

For users who have a WhatsApp Business account and want to use the official API:

- Accept a user-provided access token + phone number ID in connector settings
- Use simple fetch() calls to the Graph API (no library needed)
- Mark clearly in UI that this requires a Meta Business account
- Respect template message requirements for business-initiated conversations

---

## 5. Tool Definitions

### Core Tools (MVP)

| Tool | Description | Annotations |
|------|-------------|-------------|
| `whatsapp_list_chats` | List recent chats with last message preview, sorted by activity | `readOnlyHint: true` |
| `whatsapp_search_contacts` | Search contacts by name or phone number | `readOnlyHint: true` |
| `whatsapp_list_messages` | Get message history for a chat with pagination | `readOnlyHint: true` |
| `whatsapp_send_message` | Send a text message to a contact or group | `readOnlyHint: false` |
| `whatsapp_get_chat_info` | Get details about a specific chat (group info, participants) | `readOnlyHint: true` |

### Extended Tools (Phase 2)

| Tool | Description |
|------|-------------|
| `whatsapp_send_media` | Send image, video, document, or audio file |
| `whatsapp_download_media` | Download media from a received message |
| `whatsapp_react` | React to a message with an emoji |
| `whatsapp_reply` | Reply to a specific message (quoted reply) |
| `whatsapp_search_messages` | Full-text search across all chats |
| `whatsapp_create_group` | Create a new group chat |
| `whatsapp_group_manage` | Add/remove participants, update group settings |

### Tool Schema Example

```typescript
const sendMessageTool = tool(
  'whatsapp_send_message',
  'Send a text message to a WhatsApp contact or group. Requires a JID (phone@s.whatsapp.net for contacts, id@g.us for groups).',
  {
    jid: z.string().describe('Recipient JID (e.g. "15551234567@s.whatsapp.net" or group ID)'),
    message: z.string().describe('Message text to send'),
    quoted_message_id: z.string().optional().describe('Message ID to reply to (quoted reply)'),
  },
  async (args) => {
    // Implementation using Baileys sock.sendMessage()
  },
  {
    annotations: {
      title: 'Send WhatsApp Message',
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }
);
```

---

## 6. Testing Plan

### Unit Tests (bun:test)

- **Store tests**: SQLite message cache CRUD operations, search, pagination
- **Tool input validation**: Zod schema validation for all tools
- **Message formatting**: Ensure outgoing messages are properly structured
- **Auth state**: Session persistence and restoration logic

### Integration Tests (with mocked Baileys)

- **Mock `makeWASocket`**: Return a fake socket that records sent messages
- **Connection lifecycle**: Test QR code generation, connection, disconnection, reconnection
- **Message receive flow**: Simulate incoming messages via event emitter
- **Error handling**: Network failures, expired sessions, invalid JIDs

### Manual Testing

- **QR code flow**: Verify end-to-end auth in desktop app
- **Message send/receive**: Confirm delivery via a test WhatsApp number
- **Media**: Test image/audio send and receive with a real account
- **Group operations**: Test with a test group

### Testing Safety

- Use a **dedicated test phone number** (prepaid SIM) -- never test with primary WhatsApp account
- Implement rate limiting in test harness to avoid triggering WhatsApp anti-spam
- All integration tests should use mocked Baileys by default; real-connection tests gated behind `WHATSAPP_INTEGRATION_TEST=1` env var

---

## 7. Security & Privacy

### Data Storage

- All message data stored locally in `~/.claude-tauri/whatsapp-store.db` (SQLite)
- Auth credentials stored in `~/.claude-tauri/whatsapp-auth/` (Baileys auth state)
- No message data sent to external servers (beyond WhatsApp's own servers)
- Messages only sent to Claude when explicitly accessed via tools (user controls which chats the AI sees)

### Encryption

- Baileys implements the Signal protocol (E2E encryption) -- messages are encrypted in transit
- Local storage is unencrypted (same security model as WhatsApp Desktop app itself)
- Consider optional encryption-at-rest for auth credentials using OS keychain

### Access Control

- Connector requires explicit user enablement in settings
- QR code auth requires physical access to the linked phone
- Consider a confirmation dialog before sending messages ("Claude wants to send a message to X. Allow?")
- Rate limit outgoing messages to prevent AI from spamming contacts

### Privacy Considerations

- The AI assistant has access to message history -- users must understand this
- Implement configurable chat filters (e.g., only allow AI to see specific chats)
- Log all AI-initiated message sends for user auditability

---

## 8. Watchouts & Risks

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Account ban** | WhatsApp bans accounts using unofficial APIs | Use dedicated number; implement rate limiting; follow "human-like" behavior patterns |
| **Protocol breakage** | WhatsApp server updates can break Baileys overnight | Pin Baileys version; monitor WhiskeySockets GitHub for breaking changes; design graceful degradation |
| **Meta AI chatbot ban (Cloud API)** | Policy explicitly bans general-purpose AI assistants on Business Platform | Primary path uses Web protocol (not subject to Business Platform ToS); Cloud API path is opt-in BYOK |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Session expiry** | Linked device sessions expire after ~14 days of phone inactivity | Detect expired session; prompt user to re-scan QR |
| **Multi-device conflicts** | WhatsApp limits linked devices to 4 | Document this limitation; handle "device limit reached" error |
| **Message delivery failures** | Network issues, blocked contacts, rate limits | Implement retry with exponential backoff; surface errors to user |
| **Baileys maintenance** | Library could become unmaintained | Monitor repo health; have fallback plan (Evolution API, fork) |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Legal liability** | Unofficial API use violates WhatsApp ToS | This is a personal desktop tool, not a commercial SaaS; risk is account-level, not legal |
| **EU regulatory changes** | Meta's AI chatbot ban being challenged by EU/Brazil regulators | Monitor; may actually open up Cloud API path in future |

### The "Nuclear" Scenario

WhatsApp could implement device attestation or certificate pinning that makes all unofficial clients impossible. This has not happened in 5+ years of Baileys existence, likely because it would also break WhatsApp Web itself, but it remains theoretically possible.

---

## 9. Dependencies

### Required (MVP)

| Package | Version | Purpose | Size |
|---------|---------|---------|------|
| `@whiskeysockets/baileys` | `^6.x` | WhatsApp Web protocol implementation | ~2MB |
| `link-preview-js` | peer dep | Link preview generation (Baileys peer dep) | ~200KB |
| `qrcode` | `^1.5` | QR code generation for auth flow | ~100KB |

### Already Available

| Package | Purpose |
|---------|---------|
| `zod` | Tool input validation (already in project) |
| `bun:sqlite` | Local message storage (built into Bun) |
| `@anthropic-ai/claude-agent-sdk` | `tool()` helper and `createSdkMcpServer()` |

### Optional (Phase 2)

| Package | Purpose |
|---------|---------|
| `sharp` | Image thumbnail generation for media tools |
| `fluent-ffmpeg` | Audio format conversion for voice messages |

---

## 10. Estimated Complexity

### Phase 1: MVP (Core messaging) -- ~3-4 days

| Component | Effort | Notes |
|-----------|--------|-------|
| Baileys integration + auth flow | 1.5 days | QR code generation, session persistence, reconnection |
| Core tools (5 tools) | 1 day | list_chats, search_contacts, list_messages, send_message, get_chat_info |
| Local message store | 0.5 days | SQLite cache with bun:sqlite |
| Tests | 0.5-1 day | Unit tests with mocked Baileys |
| Frontend: QR code UI in settings | 0.5 days | Display QR, show connection status |

### Phase 2: Extended features -- ~2-3 days

| Component | Effort | Notes |
|-----------|--------|-------|
| Media tools (send/receive/download) | 1 day | Image, video, document, audio support |
| Group management tools | 0.5 days | Create, manage participants, settings |
| Message reactions + replies | 0.5 days | Emoji reactions, quoted replies |
| Full-text search | 0.5 days | FTS5 on SQLite message store |
| Additional tests | 0.5 days | Coverage for new tools |

### Phase 3: Cloud API BYOK (Optional) -- ~1-2 days

| Component | Effort | Notes |
|-----------|--------|-------|
| Cloud API client (fetch-based) | 0.5 days | Simple REST wrapper |
| Settings UI for token/phone ID | 0.5 days | Input fields + validation |
| Template message support | 0.5 days | Required for business-initiated messages |

### Total: ~6-9 days across all phases

**Recommendation**: Ship Phase 1 first, gather user feedback, then proceed to Phase 2. Phase 3 is only worth building if there is explicit user demand for Business API support.

---

## Appendix: Key References

- [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp) -- Most popular WhatsApp MCP server (Python + Go)
- [jlucaso1/whatsapp-mcp-ts](https://github.com/jlucaso1/whatsapp-mcp-ts) -- TypeScript/Baileys MCP server (closest to our stack)
- [FelixIsaac/whatsapp-mcp-extended](https://github.com/FelixIsaac/whatsapp-mcp-extended) -- Extended fork with 41 tools
- [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) -- Core WhatsApp Web library (7.9k stars, actively maintained)
- [WhatsApp Cloud API Docs](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started) -- Official Meta documentation
- [Meta AI Chatbot Ban Policy](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/) -- TechCrunch coverage
- [WhatsApp API vs Unofficial Tools Risk Analysis](https://www.bot.space/blog/whatsapp-api-vs-unofficial-tools-a-complete-risk-reward-analysis-for-2025) -- Comprehensive risk comparison
- [WhatsApp Cloud API Pricing Updates](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/) -- July 2025 per-message pricing
- [EU Commission vs Meta (AI Chatbot Ban)](https://techcrunch.com/2026/01/13/brazil-orders-meta-to-suspend-policy-banning-third-party-ai-chatbots-from-whatsapp/) -- Regulatory pushback
