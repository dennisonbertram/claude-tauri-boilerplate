# UX Stories: Agent Profiles & Configuration

Topic: Agent Profiles & Configuration  
App Context: Claude Tauri Boilerplate -- Desktop AI coding assistant with git workspace management

---

## STORY-001: Create New Agent Profile

**Type**: short
**Topic**: Agent Profiles & Configuration
**Persona**: Developer (Claude Code user building specialized agents)
**Goal**: Create a new agent profile from scratch with a memorable name and icon
**Preconditions**: User is in Agent Builder view; no profile is selected

### Steps
1. Click "New agent profile" button (+) in sidebar header → Empty new profile form appears
2. User enters name "Code Review Bot" in General tab → Name field updates
3. Click color swatch, select red (#ef4444) → Color bar in sidebar reflects change
4. Type emoji "🔍" in Icon field → Profile icon updates in sidebar
5. Click Save button (Cmd+S) → Profile saved; success notification appears "Profile saved"

### Variations
- **Duplicate existing**: User right-clicks profile in sidebar → "Duplicate" menu item → Creates copy with suffix "Copy"
- **Template-based**: Create profiles for common workflows: code-review, documentation, testing, debugging

### Edge Cases
- Empty name: Save button disabled with tooltip "Name is required"
- Rapid saves: Notification auto-dismisses after 2.5s
- Unsaved changes: Selecting another profile prompts "You have unsaved changes. Leave without saving?"

---

## STORY-002: Configure Profile Metadata

**Type**: short
**Topic**: Agent Profiles & Configuration
**Persona**: Organization manager (setting up team defaults)
**Goal**: Add description and set profile as default for all new sessions
**Preconditions**: Profile "Code Review Bot" is selected in editor

### Steps
1. In General tab, enter description "Specialized code review agent with strict standards" → Text field updates
2. Checkbox "Default Profile" is visible below description
3. Check the "Default Profile" checkbox → Checkbox fills; "default" badge appears in sidebar next to name
4. Save → Profile marked as default; all new sessions without explicit profile selection use this one
5. Create new chat session → Profile selector shows "Code Review Bot" highlighted by default

### Variations
- **Multiple defaults**: Only one profile can be default; switching another to default removes flag from previous
- **Default indicator**: Badge persists in sidebar to visually signal the active default

### Edge Cases
- No description: Description field is optional; can be left blank
- Changing profile**: If user changes default profile, previous default no longer shows badge

---

## STORY-003: Configure System Prompt

**Type**: medium
**Topic**: Agent Profiles & Configuration
**Persona**: AI architect (fine-tuning agent behavior)
**Goal**: Set a custom system prompt and enable/disable Claude Code prompt injection
**Preconditions**: Profile is selected; Prompt tab is visible

### Steps
1. Click Prompt tab → Large textarea with system prompt editor appears
2. User pastes multi-line custom system prompt: "You are a strict code reviewer. Focus on security first..."
3. Checkbox "Use Claude Code Prompt" is checked by default → Can be unchecked
4. If checked, system prompt is prepended with standard Claude Code instructions
5. In description: "Includes standardized code environment capabilities"
6. User unchecks → Standard prompt injection disabled; only custom prompt is used
7. Save → Changes persisted; next chat using this profile applies new prompt

### Variations
- **Override mode**: Custom prompt always included; whether to also include standard instructions is user choice
- **Prompt length**: Large prompts (50k char limit) supported with inline validation

### Edge Cases
- Dangerously long prompts: Truncated at 50,000 chars with warning "Prompt exceeds max length"
- Empty prompt: Allowed; uses only standard Claude Code instructions if flag is checked

---

## STORY-004: Select Model & Effort Level

**Type**: short
**Topic**: Agent Profiles & Configuration
**Persona**: Cost-conscious developer (optimizing token usage)
**Goal**: Configure model selection and thinking budget for the profile
**Preconditions**: Profile is selected; Model tab is open

### Steps
1. Model dropdown shows "claude-3-5-sonnet-20241022" (default)
2. Click dropdown → List of available Claude models: opus, sonnet, haiku variants
3. Select "claude-3-opus-4-6" → Model field updates
4. Effort level selector (4 options): low, medium, high, max
5. Select "high" effort → Thinking budget field shows 10000 tokens (default for high)
6. User manually edits budget to 15000 tokens → Field updates; save button becomes active
7. Save → Profile saved with new model and thinking budget

### Variations
- **Preset efforts**: Each effort level has pre-set thinking budget; manual edit overrides
- **Model availability**: Available models depend on account subscription; some marked as "limited" or "beta"

### Edge Cases
- Model downgrade: Warning if switching from expensive to cheap model: "Dropping from Opus to Sonnet may reduce quality"
- Extreme budgets: Budget validated (min 0, reasonable max enforced)

---

## STORY-005: Configure Tool Permissions

**Type**: medium
**Topic**: Agent Profiles & Configuration
**Persona**: Security officer (restricting dangerous tool access)
**Goal**: Set permission mode and whitelist/blacklist specific tools
**Preconditions**: Profile is selected; Tools tab open

### Steps
1. Permission Mode section shows 4 options:
   - "Default" (ask for permission on risky operations)
   - "Plan" (create plan first, then ask)
   - "Accept Edits" (auto-accept file edits, ask for others)
   - "Bypass Permissions" (skip all prompts — red warning)
2. Select "Plan" mode → Description updates
3. Tool allowlist/denylist section shows available tools: Read, Write, Edit, Bash, Glob, Grep, etc.
4. User clicks tool radio → Three states: allow (green), block (red), default (gray)
5. Set Bash to "block" → Tool appears in blocked tools list
6. Set Write to "allow" → Tool appears in allowed list
7. Save → Profile saved; chat enforces these tool restrictions

### Variations
- **Toggle view**: Switch between visual toggles and raw JSON textarea for power users
- **Permission inheritance**: Profile restrictions can be overridden per session if user has sufficient permission scope

### Edge Cases
- Conflicting rules: A tool can't be both allow and block; last action wins
- Default tools**: Some tools (Read, Glob) safe by default; others (Bash, Write) risky require explicit allow

---

## STORY-006: Configure MCP Servers

**Type**: long
**Topic**: Agent Profiles & Configuration
**Persona**: DevOps engineer (integrating Model Context Protocol servers)
**Goal**: Add, configure, and test MCP server connections
**Preconditions**: Profile is selected; Integrations tab open

### Steps
1. MCP Integrations tab shows list of configured servers (empty initially)
2. Click "Add Server" button → Form appears: Name, Command, Arguments, Environment Variables
3. Fill form:
   - Name: "git-tools"
   - Command: "/usr/local/bin/npx"
   - Arguments: "mcp-server-git"
   - Env Vars: KEY=GITHUB_TOKEN, VALUE=***
4. Form renders as JSON preview: `{ mcpServers: { "git-tools": { command, args, env } } }`
5. Add another server: "memory-server" with command "python3 /opt/memory-server.py"
6. Click Save → Both servers configured; JSON is persisted in profile
7. In next chat session with this profile:
   - Chat system discovers and connects to both MCP servers
   - Tools from servers become available in tool list

### Variations
- **JSON editor**: Toggle to raw JSON textarea for manual editing of complex configurations
- **Server validation**: Form validates command is executable; red error if command not found
- **Env secrets**: Environment variable values masked/hidden for security; decrypted only at runtime

### Edge Cases
- Invalid JSON**: If user edits JSON directly and syntax is wrong, red error banner appears
- Unreachable server**: Runtime warning if server fails to start (but not fatal)
- Command not found**: Form shows error "Command not found" if executable doesn't exist

---

## STORY-007: Visual Hook Editor (XY Flow Canvas)

**Type**: long
**Topic**: Agent Profiles & Configuration
**Persona**: Power user (automating multi-step workflows)
**Goal**: Create event-driven automations using visual node-based editor
**Preconditions**: Profile is selected; Automations tab open; canvas view (not JSON)

### Steps
1. Automations tab shows toggle "View: Canvas | JSON" (default Canvas)
2. Canvas displays XY Flow editor with grid background, zoom controls, minimap
3. Node Palette on left shows trigger, condition, action node types
4. Drag "SessionStart" trigger from palette onto canvas → Node appears
5. Drag "Command" action node onto canvas → Node with "Execute Command" label
6. Connect trigger → action → Red "requires trigger" error clears; blue connection line appears
7. Click action node → Panel on right shows config:
   - Command: "git status"
   - Timeout: 30 (seconds)
8. Add condition node: "Check if workspace is dirty"
9. Route: SessionStart → Condition → Command → Executes only if condition true
10. Save → Canvas state is compiled to hooks JSON; validation succeeds

### Variations
- **Supported actions**: Command (shell), HTTP (POST/GET), Prompt (LLM inference), Agent (invoke subagent)
- **Multiple matchers**: One trigger can match multiple condition groups
- **Error handling**: Unconnected nodes show yellow warning; unsupported hook types show red error

### Edge Cases
- Dangerous actions**: Command/HTTP hooks require user confirmation ("This profile contains executable code")
- Circular connections**: Canvas prevents cycles; edge doesn't connect if it would create loop
- Large canvases**: 200 node limit enforced; minimap helps navigate
- JSON fallback**: If canvas can't parse JSON, show "Invalid hook JSON" and offer JSON editor

---

## STORY-008: Configure Sandbox Environment

**Type**: short
**Topic**: Agent Profiles & Configuration
**Persona**: Security-conscious user (isolating tool execution)
**Goal**: Enable Docker sandbox for isolated tool execution
**Preconditions**: Profile is selected; Sandbox tab open

### Steps
1. Sandbox info box explains: "A sandbox runs your agent's tools in an isolated environment"
2. Preset buttons: None, Node.js, Python 3, Custom JSON
3. Click "Node.js" → Sandbox JSON is populated with Node.js Docker image config
4. Preview shows: `{ sandbox: { type: "docker", container: { image: "node:20-slim", volumes: [...] } } }`
5. User clicks "Custom JSON" → Can edit raw JSON configuration
6. User modifies volumes: add `/workspace:/data` mount
7. Save → Sandbox config persisted; tools in chat will execute inside this container

### Variations
- **Preset configs**: Easy one-click setup for common runtimes
- **Custom volumes**: Advanced users can mount multiple paths, configure resource limits
- **No sandbox**: Selecting "None" clears sandbox JSON; tools run directly on system

### Edge Cases
- Invalid image**: User types non-existent Docker image; warning but doesn't block save
- Missing Docker**: Runtime error if Docker not available (not caught in editor)
- Complex configs**: Allows arbitrary YAML/JSON for advanced Docker setups

---

## STORY-009: Profile Selector in Chat

**Type**: short
**Topic**: Agent Profiles & Configuration
**Persona**: Chat user (switching agent behaviors mid-session)
**Goal**: Select a profile before starting a new chat to configure behavior
**Preconditions**: User is in Chat view, no session is active

### Steps
1. Welcome screen shows: "Select a profile to get started"
2. ProfileSelector component shows horizontal pill buttons:
   - "Default" (always available, uses system default profile)
   - "Code Review Bot" (selected by icon 🔍 and name)
   - "Documentation Agent"
   - "+ New" button to create ad-hoc profile
3. Click "Code Review Bot" → Pill highlights with primary background
4. Start typing in input → New chat session created with selected profile
5. Chat inherits all profile settings: system prompt, tools, MCP servers, sandbox, hooks
6. Switch to different profile in profile selector → (mid-session switching not yet supported; grayed out)

### Variations
- **Default fallback**: If no profile selected, Default profile is used
- **Profile badges**: Show "default" badge on default profile for clarity
- **Create inline**: "+ New" button could open quick profile creator (future)

### Edge Cases
- No profiles**: Only "Default" option available
- Profile deleted**: If selected profile is deleted elsewhere, gracefully fall back to Default

---

## STORY-010: Delete Profile with Confirmation

**Type**: short
**Topic**: Agent Profiles & Configuration
**Persona**: Cleanup-focused user (removing old profiles)
**Goal**: Delete an unused profile with safety confirmation
**Preconditions**: Profile "Code Review Bot" is selected in editor

### Steps
1. Click "Delete" button in editor header (red destructive button)
2. Button text changes to "Confirm Delete"; tooltip warns "This action cannot be undone"
3. User clicks "Confirm Delete" again → Profile is deleted from database
4. Editor clears; profile list updates in sidebar (no longer visible)
5. If deleted profile was default, system automatically promotes next profile to default
6. No longer available in chat profile selector

### Variations
- **Sidebar menu**: Right-click profile in sidebar → "Delete" option (also shows menu)
- **Undo window**: (Future) Short grace period to undo before hard delete
- **Busy state**: If other sessions are using this profile, show warning before deletion

### Edge Cases
- Last profile**: Prevent deletion if this is the only profile (or only non-default)
- Confirmation timeout**: Confirmation state auto-clears after 3 seconds; user must click again
- Default profile**: Deleting default profile auto-promotes another to default

---

## STORY-011: Import/Export Profile Configuration

**Type**: medium
**Topic**: Agent Profiles & Configuration
**Persona**: Team lead (sharing configurations)
**Goal**: Export profile as JSON file for sharing or backup
**Preconditions**: Profile is selected

### Steps
1. Advanced tab includes "Export Profile" button
2. Click button → Profile data downloaded as `{profile-name}.json` file
3. JSON structure includes all settings: name, icon, color, system prompt, model, tools, hooks, MCP, sandbox
4. Share file with teammate
5. Teammate opens Agent Builder and clicks "Import Profile"
6. File picker opens → Select JSON file
7. Import dialog shows: "Import profile 'Code Review Bot'?" → User confirms
8. Profile is created with imported settings (gets new ID; doesn't overwrite existing)

### Variations
- **Clipboard**: Could copy profile as JSON to clipboard instead of download
- **Collaborative**: Profiles could be shared via URL (future feature)

### Edge Cases
- Incompatible versions**: Import warns if JSON format is from different app version
- Duplicate names**: If importing profile with same name, new profile gets suffix "Import {timestamp}"
- Invalid JSON**: Import fails with clear error message

---

## STORY-012: Manage Advanced Settings

**Type**: medium
**Topic**: Agent Profiles & Configuration
**Persona**: Power user (controlling execution limits and environment)
**Goal**: Set max turns, budget limits, and working directory
**Preconditions**: Profile is selected; Advanced tab open

### Steps
1. Advanced tab shows multiple sections:
   - Max Turns: Number input (default 0 = unlimited)
   - Budget Limits: Max USD spend (default 0 = unlimited)
   - Working Directory (cwd): Text input, shows `/workspace` or custom path
   - Additional Directories: Multi-line list of accessible paths
   - Settings Sources: List of where settings come from (profile, default, workspace)
2. User sets Max Turns to 10 → Tooltip explains "Chat will auto-stop after 10 turns"
3. User sets Max Budget to 5.00 USD → Tooltip "This session will stop after spending $5"
4. User enters cwd: `/home/user/projects/my-app` → Path is validated at runtime
5. Add additional directory: `/data/shared` → Textarea updates
6. Save → Limits are enforced in chat execution

### Variations
- **Subagents config**: agentsJson field for defining team members (advanced)
- **Cost tracking**: Current session cost visible in chat; warned if approaching budget limit

### Edge Cases
- Invalid path**: cwd validation doesn't happen until runtime (or lazy validate)
- Budget exceeded**: Session stops mid-turn; message shows "Budget limit exceeded"
- Turn limit reached**: Auto-stop happens gracefully; user notified

---
