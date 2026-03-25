Here’s the blunt review: the proposal has a solid core idea, but it’s mixing three different problems into one abstraction:

- connector registration/integration management
- per-session tool activation
- tool/provider implementation strategy

Those should not be modeled at the same level.

The most valuable part is **per-session activation state**.  
The most questionable part is the new global `connectors` registry table as proposed.

---

# 1. Architecture Review

## What is sound

The high-level pattern is directionally correct:

1. **Global pool of available integrations**
2. **Per-session activation state**
3. **Query-time resolution into Claude SDK options**

That matches how Claude-style connector systems generally work and fits your current architecture well because:

- sessions already exist in SQLite
- profiles already override SDK options
- SDK options are constructed per request anyway
- MCP lifecycle is already delegated to the SDK

So yes: **resolving active tools/connectors at query time is the right architectural seam**.

---

## What is over-engineered

The proposal’s **3-layer model becomes too abstract too early**, especially the `connectors` table trying to unify:

- OAuth integrations
- MCP server references
- builtin tools
- tool metadata cache
- global enablement
- UI identity

That’s too many concerns in one table.

You do **not** currently have a true connector platform. You have:

- MCP servers
- some app-native integrations (`/api/google`, `/api/linear`, maybe GitHub)
- builtin Claude SDK tools controlled by allowed/disallowed tool lists and profile config

Those are not equivalent operationally.

### The overreach
The proposal acts as if all of these can be normalized into one universal “connector” object. In practice:

- MCP servers are configuration objects passed to SDK
- OAuth integrations are credentials + app-managed APIs
- builtin tools are SDK/tool policy, not external connectors

Those should maybe be unified in the **UI layer**, but not necessarily in the **storage/model layer**.

---

## What is missing architecturally

### A. Clear precedence rules
You need a deterministic merge order across:

- managed/global MCP config
- session connector toggles
- agent profile MCP/tool config
- request-level overrides
- permission mode / hooks / allowedTools / disallowedTools

Right now the proposal says:

> Agent profiles override session connectors

That’s too vague. Override what exactly?

You need a formal merge strategy like:

1. **Managed restrictions** always apply
2. **Profile explicit additions/removals** apply next
3. **Session activation** selects from allowed pool
4. **Request-time overrides** only narrow, never broaden
5. Final result becomes `mcpServers`, `allowedTools`, `disallowedTools`

Without that, behavior will be confusing and bugs will be hard to reason about.

---

### B. Distinction between “availability” and “activation”
This is the key missing conceptual split.

For each integration/tool source, you need to track separately:

- **Configured**: exists in settings / credentials present
- **Healthy**: can actually connect right now
- **Eligible**: allowed by workspace/profile/policy
- **Active for session**: user toggled on for this session
- **Actually included in current query**: after final merge and validation

The proposal collapses these too much.

---

### C. Tool identity stability
The proposal assumes connector → tool list can be cached and filtered. That may not be stable enough.

With MCP:

- tool names may change when server version changes
- some servers expose dynamic tools
- some tool names may not be known until connection
- names are namespaced as `mcp__server__tool`, but exact inventory may drift

So a cached `tool_names` JSON field is operationally fragile if used for enforcement rather than just display.

---

## Recommended architecture

A simpler and stronger architecture:

### Keep three different concepts:

#### 1. Integration Sources
Existing sources of tools/integrations:
- global MCP servers from `.mcp.json`
- app-native OAuth integrations (Google, Linear, GitHub)
- profile-defined MCP servers
- builtin Claude tools

#### 2. Session Activation State
A table storing what the user wants active for a session:
- source type
- source key
- enabled

This is the important new persistent state.

#### 3. Query-Time Resolver
A pure function/service that computes:
- final MCP server map
- final allowed/disallowed tools
- final metadata returned to UI

That resolver should be the single source of truth.

That gives you the product behavior you want without forcing a universal connector abstraction into the DB too early.

---

# 2. Data Model Critique

## Proposed schema review

### `connectors`
```sql
CREATE TABLE connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  type TEXT NOT NULL,
  oauth_provider TEXT,
  oauth_connected INTEGER DEFAULT 0,
  mcp_server_name TEXT,
  tool_names TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);
```

This is doing too much and is not well normalized.

## Problems

### A. `oauth_connected` is derived state
That should not live here unless this table is the canonical credentials store, which it isn’t.

If Google/Linear auth already lives elsewhere, `oauth_connected` becomes duplicated and can go stale.

### B. `tool_names` is denormalized and unstable
Storing tool names as JSON is okay for cache/display, but not okay as authoritative control state.

If you use it to build `allowedTools`/`disallowedTools`, you risk:
- stale names
- wrong filtering after server upgrade
- mismatch between UI and execution reality

### C. `mcp_server_name` is a weak foreign key
It references a name inside `.mcp.json`, not a relational table. That’s okay pragmatically, but then don’t pretend this is normalized relational data.

### D. `type` combines incompatible entities
`oauth | mcp | builtin` is too coarse and hides implementation differences that matter.

### E. `enabled` is ambiguous
Does global `enabled=0` mean:
- hide from UI?
- disallow use?
- disconnect credentials?
- suppress from session toggles?
- disable by policy?

Needs a better name like `globally_enabled` or `available`.

---

## `session_connectors`
```sql
CREATE TABLE session_connectors (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, connector_id)
);
```

This is the strongest part of the proposal, but only if `connector_id` points to something stable.

If connector registry remains fuzzy, this table inherits that fuzziness.

---

## `connector_defaults`
```sql
CREATE TABLE connector_defaults (
  connector_id TEXT PRIMARY KEY REFERENCES connectors(id) ON DELETE CASCADE,
  enabled_by_default INTEGER NOT NULL DEFAULT 1
);
```

This table is probably unnecessary.

You can fold default enablement into either:
- the connector/integration source itself, or
- a user settings JSON blob

A whole table for one boolean per connector is likely overkill unless you expect:
- per-workspace defaults
- per-profile defaults
- policy tiers

Right now this is premature.

---

## Better schema options

## Option A: Minimal, pragmatic
Keep no `connectors` table yet.

Add only:

```sql
CREATE TABLE session_tool_sources (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,   -- 'mcp_global' | 'oauth_google' | 'oauth_linear' | 'builtin' | 'profile_mcp'
  source_key TEXT NOT NULL,    -- e.g. server name, provider id, builtin namespace
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, source_type, source_key)
);
```

Then resolve available sources dynamically from:
- `.mcp.json`
- auth status from integration services
- builtin tool definitions
- profile config

This is much simpler and probably enough for v1.

---

## Option B: If you really want a registry
Use a narrower registry table and make it explicit that it is a UI catalog, not the source of truth for credentials/tools:

```sql
CREATE TABLE integration_catalog (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('mcp', 'oauth', 'builtin')),
  key TEXT NOT NULL,             -- stable logical key, e.g. 'google-drive', 'linear', 'agentation'
  display_name TEXT NOT NULL,
  icon TEXT,
  globally_enabled INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(kind, key)
);
```

And:

```sql
CREATE TABLE session_integrations (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL REFERENCES integration_catalog(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, integration_id)
);
```

But again: this should not be the credentials store and should not be the authoritative tool inventory.

---

# 3. Integration Concerns

## Query-time resolution is correct
Yes, this is the right place to apply per-session state.

Your backend already builds the SDK options per request. That means:
- no need to mutate global state
- no need to maintain long-lived connector activation in memory
- no need to restart the sidecar

That’s good.

---

## But the exact proposed filtering logic is shaky

### Problem 1: `disallowedTools` based on cached inactive connector tool names
This is risky.

If a connector is inactive, the safer approach is:
- **do not include its MCP server in `mcpServers` at all**

That is stronger and cleaner than trying to blacklist all its tools by name.

For MCP connectors:
- activation should primarily control whether the server is passed in `mcpServers`

For builtin or app-native tools:
- then tool name filtering makes sense

### Problem 2: `allowedTools` can become brittle
Using `allowedTools` as a whitelist is dangerous unless you fully know the complete desired tool set, including builtin Claude tools and profile-specified tools.

You can easily break expected behavior by accidentally excluding:
- standard file tools
- bash/edit tools
- future SDK-added tools
- profile-required tools

Use `allowedTools` only if you are intentionally running in a restrictive mode.

For most cases:
- prefer **source selection** for MCP
- use `disallowedTools` only for explicit denials
- leave builtin Claude tools alone unless the user/profile explicitly filters them

---

## Race conditions / state issues

### A. Mid-stream toggles
You already noted “changes apply on next message.” Good. Make that explicit in both API and UI.

Do not allow toggles to mutate an in-flight query.  
A request should snapshot all effective connector state at stream start.

### B. Session creation and default inheritance
If connector defaults are copied into session state on creation, watch for races:
- user creates session
- settings/defaults change before first message
- what should happen?

Recommendation:
- either explicitly materialize defaults on session creation
- or lazily resolve defaults until first explicit override

Be consistent.

### C. MCP config drift
A session may reference an MCP server that later disappears from `.mcp.json`.

Need defined behavior:
- mark as unavailable in UI
- ignore at query time
- return warning metadata to frontend

### D. OAuth availability drift
A session may have Gmail enabled, but token expired.

Need final resolver to distinguish:
- enabled by user
- unavailable due to auth failure

The frontend should see both.

---

## Strong recommendation
Build a resolver function like:

```ts
resolveEffectiveTooling({
  sessionId,
  profileId,
  requestOverrides,
  workspaceId
}): {
  mcpServers: Record<string, McpServerConfig>;
  allowedTools?: string[];
  disallowedTools?: string[];
  connectorState: ResolvedConnectorState[];
  warnings: string[];
}
```

This should be the only path used by `/api/chat` and by connector-status endpoints.

---

# 4. OAuth vs MCP Connectors

## The proposal is half-right

Yes, they should be treated differently operationally.

That is the correct instinct.

### Why they are different
MCP connectors:
- are SDK-managed tool providers
- typically activated by including server config in `mcpServers`

OAuth connectors:
- are app-managed integrations
- may not be SDK tools at all unless you expose them through your own MCP bridge or tool layer
- require credential lifecycle, refresh, scopes, consent, error handling

So **do not force them into the same backend execution model** unless you intentionally build an abstraction layer.

---

## But they should be unified in the UX and policy model
Users don’t care whether Gmail is:
- native app integration
- internal tool adapter
- MCP-backed server

They care about:
- connected?
- enabled for this chat?
- what can it access?
- why isn’t it working?

So:

- **separate execution implementation**
- **unify session activation UX**

That’s the right split.

---

## Best practical approach

### Short term
Treat only MCP servers as true session-togglable “connectors” in v1.

For Google/Linear:
- either expose them as session-scoped context/data sources only
- or keep them outside connector toggles until you have a real tool invocation model for them

Because right now, based on your architecture summary, Google/Linear appear to be app APIs and context injectors, not necessarily Claude SDK tools in the same way MCP tools are.

If they are not actually exposed to Claude as tools, calling them “connectors” in the same toggle panel is misleading.

---

## Long term
If you want true unification, the cleanest architecture is:
- wrap app-native integrations behind internal MCP servers or an equivalent tool-provider interface

Then all connectors become “tool providers” with a common activation contract.

Until then, keep implementation distinctions explicit.

---

# 5. Deferred/Lazy Loading

## The proposal is too hand-wavy here

The suggested `<system-reminder>` approach is not something you can just invent on top of the Claude Agent SDK and expect real lazy tool loading to happen.

If the SDK itself supports deferred tool loading internally, that’s one thing.  
But from your app’s point of view, you only control:
- which MCP servers you pass
- which tools you allow/disallow
- prompt construction

A prompt reminder does **not** cause the SDK to dynamically connect a server later unless the SDK has a first-class mechanism for that.

### Important distinction
- **Prompt-level hinting** is not **actual deferred registration**
- The model cannot call tools that the runtime has not registered

So unless the Claude Agent SDK supports:
- dynamic tool discovery during a session, or
- a ToolSearch/deferred-registration mechanism you can explicitly invoke,

your proposed lazy loading is mostly a UX fiction.

---

## What is feasible now

### Feasible v1
Lazy loading at the **turn boundary**, not mid-turn.

Meaning:
- user enables connector for session
- next message includes that connector’s MCP server
- current in-flight turn doesn’t have it

That is realistic.

### Feasible v1.5
Selective server activation:
- only connect enabled MCP servers
- don’t include the rest

That already gives major context/tool-surface reduction.

### Not clearly feasible from current architecture
True on-demand loading of individual tool descriptions during a single query turn.

Unless the SDK explicitly supports it, don’t design around it.

---

## Better recommendation
Drop “deferred/lazy loading” from the initial design.

Replace it with:
- **session-level activation only**
- maybe later **profile-level suggested connectors**
- maybe much later **SDK-supported deferred tool registration**, if confirmed possible

Do not invent prompt hacks for a runtime capability you don’t control.

---

# 6. Migration Path

## The good part
The phased rollout is generally incremental enough.

## The issue
Phase 3 and 4 depend on assumptions not validated yet.

---

## Review by phase

### Phase 1: Add session connector state + API, existing MCP servers become connectors
Good, but simplify it further:
- don’t add a full connector registry table yet unless necessary
- just add session activation records for MCP server names

This is the best first milestone.

### Phase 2: Add toggle UI in composer
Good. This is a natural step after backend resolution exists.

### Phase 3: Add OAuth connectors
This is where risk jumps significantly.

Why:
- OAuth lifecycle is very different
- “connected account” does not equal “tool available to SDK”
- likely requires deeper product and runtime changes than implied

This should be its own design phase, not just a straightforward extension.

### Phase 4: Deferred loading
This should not be a planned phase until SDK capability is confirmed.

Right now it is speculative.

---

## Better migration plan

### Phase 1
Per-session activation for **global MCP servers only**

### Phase 2
Integrate with chat query resolver and session UI; emit connector/tool metadata in `session:init`

### Phase 3
Add profile/session merge semantics and conflict resolution

### Phase 4
Evaluate app-native integrations as “session-scoped data/tool providers”
- only after deciding whether they become internal tools, MCP wrappers, or remain context injectors

### Phase 5
Explore deferred loading only if SDK/runtime supports it

That’s safer and more honest.

---

# 7. Missing Considerations

A lot of important operational details are missing.

## A. Conflict resolution

What if:
- profile enables server A
- session disables server A
- request override enables server A again

Who wins?

Define precedence explicitly.

---

## B. Tool name collisions / duplicate capabilities

Even with namespacing, users may see:
- two GitHub servers
- duplicate “search” tools
- profile-defined MCP plus global MCP for same service

Need rules for:
- duplicate server names
- same logical connector from multiple sources
- deduped display names vs actual runtime IDs

---

## C. Unavailable/invalid connector handling

Need explicit UX/backend states:
- configured but missing
- auth expired
- server executable missing
- connection timeout
- invalid `.mcp.json`
- profile references nonexistent connector

Right now proposal assumes happy path.

---

## D. Session fork semantics

You already support session fork. What happens to session connector state on fork?

Likely:
- copy session connector state to child session

That needs to be explicit.

---

## E. Export/import semantics

If sessions can be exported/imported:
- do connector states export too?
- should they?
- should imported sessions preserve activation state if local environment differs?

---

## F. Auditability / explainability

When user asks “why didn’t Claude use Gmail?” you need inspectable state:
- Gmail connected? yes/no
- enabled for this session? yes/no
- blocked by profile? yes/no
- token expired? yes/no
- not included in current turn? yes/no

Without a resolver/debug payload, support will be painful.

---

## G. Tool permission interplay

Your app already has:
- permission mode
- allowed/disallowed tools
- hooks
- sub-agents

Session connector toggles are only one layer. Need to define how they interact.

Example:
- connector enabled for session
- tool denied by profile disallowedTools
- what should UI show? “enabled but restricted”?

You need a richer state model than on/off.

---

## H. Security boundaries

Especially for OAuth connectors:
- what scopes are granted?
- can session toggle narrow scope?
- is data source access constrained by workspace/session?
- do credentials leak across workspaces?

The proposal doesn’t address this.

---

## I. Performance / process churn

If every turn starts/stops multiple MCP servers because toggles changed, there may be startup overhead.

Need to understand SDK behavior:
- does it reconnect every query?
- does resume preserve MCP state?
- does passing same `mcpServers` repeatedly incur repeated process startup?

If expensive, you may need to optimize UX expectations.

---

## J. Frontend state synchronization

The UI needs to distinguish:
- saved session connector state
- effective state for next message
- actual state of in-flight message snapshot

Otherwise users will think a toggle affected the current answer when it didn’t.

---

## K. Builtin tools

Proposal includes builtin tools as connectors. I think that’s a mistake for v1.

Users expect connectors to mean external services.  
Don’t overload the concept with Bash/Edit/Read unless you are intentionally building an advanced “tool policy editor.”

Keep builtin tool control in profiles/settings, not the connector panel.

---

# 8. Alternative Approaches

## Alternative 1: Minimal MCP-only session toggles
This is the best simplification.

### Add:
- `session_mcp_servers(session_id, server_name, enabled)`

### Behavior:
- load global `.mcp.json`
- for a given session, choose enabled subset
- pass only that subset to `query().options.mcpServers`

### UI:
- replace `McpStatusPill` with session-scoped MCP picker

### Benefits:
- very small schema change
- no connector registry
- no OAuth complexity
- directly maps to existing runtime

This likely gets you 70–80% of the value.

---

## Alternative 2: Session tool policy without connector abstraction
If your real need is tool control, model it directly.

Add:
- `session_tool_policies(session_id, tool_pattern, state)`

Examples:
- `mcp__github__* = enabled`
- `mcp__slack__delete_message = disabled`

This aligns more closely with Claude Code permission patterns.

Downside:
- not as simple for mainstream UX
- harder to present in UI
- depends on known tool names

Good for advanced mode, not primary UX.

---

## Alternative 3: UI-unified, backend-separate
Show one “Connectors” UI, but persist separately:

- session MCP activation table
- app-native integration settings elsewhere
- builtin tool policies in profile/settings

Then have a resolver produce a unified frontend view model.

This is probably the best medium-term architecture.

Users see one panel.  
Backend does not force false unification.

---

# Bottom-line Recommendations

## Do now
1. **Do not build the full `connectors` registry table yet**
2. **Add per-session activation for MCP servers only**
3. **Resolve active MCP servers at query time**
4. **Pass only active servers in `mcpServers`; avoid tool-name filtering for MCP where possible**
5. **Define strict precedence rules with profiles/request overrides**
6. **Snapshot effective connector state at stream start**

## Do not do yet
1. Don’t unify OAuth, MCP, and builtin tools into one backend model
2. Don’t rely on cached `tool_names` for enforcement
3. Don’t promise deferred/lazy loading unless SDK support is confirmed
4. Don’t add `connector_defaults` as a table unless you truly need persistent per-connector defaults now

## If you want a clean v1
Use this schema:

```sql
CREATE TABLE session_mcp_servers (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  server_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, server_name)
);
```

Optionally add a simple user settings JSON for defaults.

Then implement:

- `GET /api/sessions/:id/mcp-servers`
- `PUT /api/sessions/:id/mcp-servers/:name`
- query-time merge into `mcpServers`

That is the simplest architecture that matches your current system and avoids premature platform-building.

If you want, I can turn this into a **recommended revised design doc** with:
- simplified schema
- precedence rules
- resolver pseudocode
- API shape
- phased implementation plan.
