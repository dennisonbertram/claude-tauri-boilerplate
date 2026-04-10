# Connector Rollout Plan

## Feature

Create a pragmatic rollout order for the open connector backlog so the team can ship the highest-value integrations first without fragmenting auth, storage, or the desktop UI.

## Why

The connector backlog spans low-risk cloud APIs, local-native integrations, and high-risk security-sensitive systems. A rollout plan keeps the work aligned with the current MVP architecture:

- desktop frontend for provider status and user-facing actions
- server sidecar for provider adapters and normalization
- shared types for common payloads
- auth/session/storage flow for tokens, state nonces, and local persistence

## Recommended Priority

### Phase 1: Shared foundations and low-risk wins

Ship the connectors that reuse existing seams or have the clearest official APIs.

- Google family: Gmail, Calendar, Drive, Contacts
- Plaid finance flow
- Weather polish / exposure of the already-implemented connector

### Phase 2: Local knowledge and file-style surfaces

Add sources that map cleanly into a normalized search/read/write model.

- Notes: Notion, Obsidian, Apple Notes if needed
- Tasks: Todoist, Apple Reminders
- Storage: Google Drive, Dropbox, iCloud Drive / local files
- Bookmarks / read-later

### Phase 3: Messaging and social

Prefer official bot/OAuth APIs and keep provider adapters isolated.

- Slack, Telegram, Discord
- Bluesky first for social
- X / LinkedIn only if access and pricing are acceptable

### Phase 4: Sensitive local-native connectors

Keep these local-only or macOS-specific where appropriate, with stronger permission boundaries.

- iMessage / SMS
- Apple Health / HealthKit
- Photos
- Password manager
- HomeKit / Home automation

### Phase 5: Highest-risk or most policy-sensitive items

Treat these as follow-up work once the shared model is stable.

- WhatsApp
- Amazon order tracking
- Uber / Lyft / travel history
- Shopping / delivery automation
- Crypto wallet actions

## Acceptance Criteria

- The connector backlog is grouped into implementation phases with clear dependencies.
- Each phase names the repo seam it should use first.
- High-risk connectors are explicitly separated from low-risk API work.
- The rollout order explains which connectors should share auth, storage, or normalized payloads.
- The plan is easy to use as a handoff for future implementation tickets.

## Checklist

- [x] Review the open connector backlog and group issues by shared implementation pattern.
- [x] Identify the current repo seams for Google, Plaid, weather, and the MCP/connector bridge.
- [x] Add a rollout plan doc with a phased implementation order.
- [ ] Use this plan to create or update issue-specific implementation tickets for the next build wave.
- [ ] Revisit the plan after the first connector phase lands and adjust the remaining order if needed.
