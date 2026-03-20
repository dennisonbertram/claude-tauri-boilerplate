# Agent Profile Builder — Master UX Review

*Date: 2026-03-19 | Reviewed by: Claude (Playwright-based exhaustive testing)*
*Source sections: Landing/General, Prompt/Model/Tools, Hooks/MCP/Sandbox/Advanced, Create New Profile*

---

## Executive Summary

The Agent Profile Builder has a solid structural foundation — the 8-tab layout covers the right configuration space, the unsaved-changes indicator is well-implemented, and the visual design language is consistent. However, the app is **not shippable in its current state**. There are at least 6 critical bugs that cause data loss or core flow failures through completely normal user interactions: tab navigation silently creates phantom profiles, the Delete confirmation has no cancel or timeout (allowing accidental permanent deletion), newly created profiles are not auto-selected, and save failures are silent. A test session of normal navigation destroyed all profiles irreversibly. Beyond bugs, the app presents raw JSON as the primary interface for Hooks, MCP, and Sandbox — concepts that are already technically demanding — with no onboarding or progressive disclosure. The overall grade is **D+ (critical bugs, major UX gaps)**: promising architecture, unshippable execution.

---

## Critical Bugs — Fix Immediately (Data Loss / Broken Core Flows)

### 1. Tab Clicks Silently Create Phantom "New Agent Profile" Entries

**Location:** All tabs — tab bar click handlers
**What Happens:** Clicking any tab (Prompt, Model, Tools, etc.) on an existing profile silently creates a new unsaved "New Agent Profile" entry in the sidebar. Each tab click can create another ghost entry. These phantoms persist in the sidebar alongside real profiles.
**Impact:** Confusing sidebar state; triggers BUG-2 (silent auto-save failure); cascades into BUG-3 (data loss). Users cannot tell real profiles from ghost entries.
**Fix:** Audit the `onClick` handler on tab components — it appears to be calling a `createProfile()` side effect. Tab switching must never trigger profile creation. Add `e.stopPropagation()` on all tab click handlers.

---

### 2. Auto-Save on Tab Switch Fails Silently (No Error Shown to User)

**Location:** Tab navigation — auto-save on switch
**What Happens:** Navigating between tabs triggers a silent auto-save attempt. If validation fails (e.g., empty name on a ghost profile), a console error fires (`Failed to save profile: Error: Validation failed` / `400 Bad Request`) but the user sees nothing — no toast, no inline error, no visual change.
**Impact:** Data is silently lost with no recovery path. The user has no idea something went wrong.
**Fix:** Either (a) remove auto-save on tab switch entirely and require explicit Save, or (b) always show a toast/snackbar on save failure. Never fail silently.

---

### 3. Tab Navigation Can Permanently Destroy Real Profiles (Data Loss)

**Location:** Tab navigation cascade (BUG-1 + BUG-2 combined)
**What Happens:** The cascade of phantom profile creation (BUG-1) plus silent auto-save failure (BUG-2) can result in the original profile being permanently deleted. Reproduced multiple times: after multiple tab clicks, the sidebar showed "No agent profiles yet" and after page reload the profile was gone — not recoverable.
**Impact:** Catastrophic — users lose their work through normal navigation with no warning and no undo.
**Fix:** Fix BUG-1 and BUG-2 above. Add server-side soft-delete with a recovery window. Add confirmation dialogs before any destructive operation.

---

### 4. Delete Confirmation Has No Cancel, No Timeout, No Escape Dismissal — Causes Mass Data Loss

**Location:** Profile editor header — Delete button
**What Happens:** Clicking Delete switches the button to "Confirm Delete" state. There is no Cancel button, no timeout, no Escape dismissal, and no click-outside-to-dismiss. The "Confirm Delete" state persists indefinitely across tab switches and profile navigation. During testing, this stuck state caused all profiles to be permanently deleted because the confirmation remained live while other UI interactions occurred.
**Impact:** Users can accidentally confirm a delete they initiated earlier, with no recovery. A full test session ended with "No agent profiles yet" — all profiles gone, no undo.
**Fix:** Add a "Cancel" button next to "Confirm Delete". Auto-reset after 3–5 seconds. Dismiss on Escape or any click outside. Use a modal dialog with the profile name shown: "Delete 'Code Reviewer'? This cannot be undone."

---

### 5. New Profile Is Not Auto-Selected After Creation

**Location:** "+" (New agent profile) button
**What Happens:** Clicking "+" creates a new profile entry in the sidebar but does not select or navigate to it. The main content panel stays blank ("No profile selected") or continues showing the previously selected profile. A new user clicking "+" has no idea anything happened.
**Impact:** Core creation flow is broken. New users cannot complete the most fundamental action in the app.
**Fix:** After creating a new profile, immediately select it in the sidebar and auto-focus the Name field so the user can begin editing. This is standard behavior for all list+detail UIs (VS Code, Xcode, Linear, Notion).

---

### 6. Unsaved New Profile Silently Discarded on Navigation

**Location:** New (unsaved) profile — any navigation away
**What Happens:** A newly created, unsaved profile is silently discarded when the user clicks any tab or sidebar item while a different profile is active in the editor. No warning dialog, no auto-save, no recovery mechanism. Profile disappears from the sidebar with zero feedback.
**Impact:** Users lose work they just created. Combined with BUG-5, new users may create a profile, not see it selected, click around, and find it has vanished.
**Fix:** Show a "Unsaved changes — Save or Discard?" dialog when navigating away from any unsaved form. Or immediately persist new profiles as drafts (with defaults) on creation so navigation cannot destroy them.

---

### 7. Save Failure Is Silent — No Validation Error Shown on Empty Name

**Location:** General tab — Save button with empty Name field
**What Happens:** Clicking Save with an empty name field produces no visible error. No inline error under the Name field, no toast, no red border, no focus return. The only indication of failure is the app silently switching tabs and a console error (`Failed to save profile: Error: Validation`) invisible to users. The Save button is NOT disabled when Name is empty.
**Impact:** Users cannot understand why their save did not work. They may repeatedly attempt to save with no feedback.
**Fix:** Disable Save when Name is empty, OR show an inline validation error ("Name is required") immediately. On save failure: show a toast, highlight the field in red, scroll to it, and focus it.

---

### 8. Tools Tab Content Clipped — Right Edge Overflows Viewport

**Location:** Tools tab — both textareas
**What Happens:** The "Allowed Tools" and "Disallowed Tools" textareas and their labels extend beyond the visible viewport. Helper text is cut off mid-sentence. This is a layout overflow bug — content is inaccessible without horizontal scrolling, which is not indicated.
**Impact:** Core Tools tab functionality is visually broken. Users cannot read the full helper text or interact normally with the textareas.
**Fix:** Fix the panel layout to properly constrain content to the viewport width. The inner container needs `max-width: 100%` or correct flex/overflow constraints.

---

## High Priority — Core UX Broken

### 1. Tab Active Indicator Renders on Wrong Tab (CSS Visual Regression)

**Location:** Tab bar — all tabs
**What Happens:** After navigating to some tabs (e.g., MCP), the active underline indicator visually renders under a different tab (e.g., "Prompt"), even though the correct tab is functionally selected (`aria-selected=true`). The accessibility tree simultaneously showed `tab "Sandbox" [active]` and `tab "Prompt" [selected]` — split-brain tab state.
**Impact:** Users cannot tell which tab they are on. Any changes they make may appear to be going to the wrong place.
**Fix:** Drive the active indicator via `aria-selected` CSS: `[aria-selected="true"]::after`. Ensure tab selection, CSS active state, and rendered content are all driven from a single source of truth.

---

### 2. New Profile Opens on Wrong Tab (Prompt Instead of General)

**Location:** After clicking sidebar item to select a new profile
**What Happens:** When a new profile is created and then selected from the sidebar, it opens on the Prompt tab instead of the General tab. The General tab is where the user must go first to set the profile name.
**Impact:** New users land on a system prompt textarea without knowing they need to name their profile first. The critical first step is hidden.
**Fix:** Always open a new (unsaved) profile on the General tab with the Name field auto-focused.

---

### 3. Clicking Sidebar Profile Restores Arbitrary Last-Viewed Tab

**Location:** Sidebar profile selection
**What Happens:** Clicking a profile in the sidebar restores whichever tab was last active for that profile. A user can click "Code Reviewer" and land on the Sandbox tab with no context.
**Impact:** Disorienting — users are dropped into arbitrary advanced tabs with no breadcrumb.
**Fix:** Always navigate to the General tab when selecting a profile from the sidebar, or document and communicate the tab memory behavior clearly.

---

### 4. False "Unsaved" State — Orange Dot Appears on Tab Switch Without User Edits

**Location:** Profile editor header — dirty state indicator
**What Happens:** The orange dot (unsaved changes indicator) appears as soon as tabs are switched, even when no data has been changed by the user. This is a false dirty state.
**Impact:** Users are constantly anxious about changes that don't exist. They will either save unnecessarily or learn to ignore the indicator — causing them to miss real unsaved changes.
**Fix:** Only set the dirty flag when actual form field values change from their persisted state. Tab navigation must not trigger dirty state.

---

### 5. ESC Does Not Revert Unsaved Changes — Navigates to Different Tab Instead

**Location:** General tab — any edited field
**What Happens:** After modifying the Name field and pressing ESC, changes are NOT reverted. Instead, ESC moves keyboard focus and can switch the active tab (e.g., to Prompt tab). The profile remains showing the modified name with the orange dirty indicator.
**Impact:** Destroys the universal ESC = cancel/undo expectation. Users who press ESC expecting to undo a mistake will instead navigate to a different tab, potentially losing context.
**Fix:** ESC on a focused input should blur the input and revert its value to the last-saved state. Do not use ESC to trigger tab navigation.

---

### 6. Delete Button — Equal Visual Weight to Save, No Confirmation Modal

**Location:** Profile editor header
**What Happens:** The Delete button is styled in solid red at the same size as Save, positioned directly adjacent to it in the header. Confirmation uses an inline state change (button text becomes "Confirm Delete") rather than a modal. There is no profile name shown in the confirmation.
**Impact:** High accidental deletion risk. Users exploring the interface may click Delete without intending to. The confirmation mechanism is insufficient and easy to dismiss accidentally.
**Fix:** Move Delete out of the primary header actions — put it at the bottom of the General tab with a separator, or in a "..." overflow menu. Use a modal confirmation that names the profile: "Delete 'Code Reviewer'? This cannot be undone."

---

### 7. Header Shows Wrong Profile Name Mid-Session

**Location:** Profile editor header
**What Happens:** After clicking a tab, the header can switch from the correct profile name (e.g., "Code Reviewer") to "Untitled Profile" or "New Agent Profile," even though the correct profile is highlighted in the sidebar. The panel content may correspond to a completely different profile than the sidebar selection.
**Impact:** Users cannot tell which profile they are editing. Changes may be written to the wrong profile.
**Fix:** The selected profile in the sidebar must stay in lock-step with the panel header and content. Fix the state management so sidebar selection and panel content always reference the same profile object.

---

### 8. Tools Tab — Raw Text Input for Tool Names With No Discovery

**Location:** Tools tab — Allowed Tools and Disallowed Tools textareas
**What Happens:** Users must manually type tool names as raw strings ("Read", "Glob", "Grep", "Bash", "Write") into textareas. There is no list of available tools, no descriptions, and no validation if a name is misspelled (e.g., "read" vs "Read"). A user who types "FileRead" gets no error.
**Impact:** Non-technical users cannot use this tab at all. Even technical users must guess or look up tool names. There is no way to know if a tool configuration is valid before saving.
**Fix:** Replace raw textareas with a visual checklist of all available tools, each with a 1-line description. Allow power users to toggle to raw text mode. Add autocomplete/typeahead at minimum.

---

### 9. Hooks Tab — Raw JSON Is the Default View

**Location:** Hooks tab
**What Happens:** The Hooks tab opens by default in JSON editing mode showing raw keys like `"PreToolUse"`, `"matcher"`, `"hooks"`, `"type": "command"`. No plain-language explanation of what hooks do. Helper text references "Claude Code hooks format" as if it is a known standard.
**Impact:** Non-developer users are immediately blocked. The visual Canvas editor exists but is hidden behind a toggle.
**Fix:** Make Canvas view the default. Move JSON view behind an "Expert mode" toggle. Add a brief intro: "Hooks let you run custom commands automatically when the agent starts, stops, or uses a tool."

---

### 10. Canvas Button in Hooks Tab Triggers Dirty State and Tab Navigation

**Location:** Hooks tab — Canvas/JSON toggle button
**What Happens:** Clicking the "Canvas" button causes the active tab to jump (to Prompt), the orange unsaved-changes dot to appear, and the Save button to become enabled — all without any intentional user data change. Only clicking by raw mouse coordinates reliably opens Canvas.
**Impact:** The Canvas view — the more user-friendly view — is effectively inaccessible through normal interaction.
**Fix:** The Canvas/JSON toggle must be isolated from the form's dirty-state detection. A view toggle must never mark the form as modified or trigger tab navigation.

---

### 11. MCP Tab — Entirely Raw JSON With No Onboarding

**Location:** MCP tab
**What Happens:** The MCP tab shows only a raw JSON editor. The acronym "MCP" (Model Context Protocol) is never expanded anywhere on the screen. The helper text assumes the user knows what MCP servers are.
**Impact:** Non-developers have no way to use this tab. Even developers without MCP experience will be confused about where to start.
**Fix:** Expand the acronym. Add 1–2 sentence explanation: "MCP servers extend your agent with additional capabilities, like web search, database access, or custom tools." Add a form-based UI (name, command, args, env vars) instead of raw JSON. Add a "Browse available servers" link.

---

### 12. Sandbox Tab — Raw JSON With No Accessible Onboarding

**Location:** Sandbox tab
**What Happens:** Sandbox opens showing Docker container configuration JSON (`"type": "docker"`, `"image": "node:20"`, `"volumes"`) as the primary UI. "Docker", "image", "volumes" are all infrastructure concepts inaccessible to non-DevOps users.
**Impact:** Non-developers cannot use this tab. Users are given no understanding of why they would want a sandbox.
**Fix:** Add a plain-language intro: "A sandbox runs your agent's tools in an isolated environment." Offer preset options ("None", "Node.js container", "Python container", "Custom") before showing raw JSON. Make JSON a fallback, not the primary interface.

---

### 13. Color Field — Clicking Swatch Does Not Open Color Picker

**Location:** General tab — Color field
**What Happens:** Clicking the color swatch triggers a hidden `<input type="color">` which opens the OS native color picker — but in the Tauri/Electron environment it opens behind the window, is invisible, and does not return a value. From the user's perspective: nothing happens when clicking the color swatch. The only working interaction is typing a hex value directly.
**Impact:** The color field is functionally broken for users who do not know hex color codes. No affordance suggests raw hex input is the only path.
**Fix:** Replace the native `<input type="color">` with an in-window color picker component (a small popover with hue/saturation picker + hex/rgb inputs). This is a known Tauri webview limitation.

---

### 14. Model Tab — Missing Standard Parameters

**Location:** Model tab
**What Happens:** The Model tab has only 3 controls (model dropdown, Effort buttons, Thinking Budget slider) with approximately 60% of the panel area empty. Standard model parameters — Temperature, Max Tokens, Top-P — are absent with no explanation of whether they are managed automatically.
**Impact:** The tab looks unfinished. Advanced users expect to configure these parameters. The empty space implies features are missing.
**Fix:** Either add standard parameters (temperature, max output tokens) or explicitly communicate: "These parameters are managed automatically per-model." Remove the empty space either way.

---

### 15. Permission Mode Dropdown — Options Are Unexplained

**Location:** Tools tab — Permission Mode dropdown
**What Happens:** Permission Mode has 4 options: "Default", "Plan", "Accept Edits", "Bypass Permissions" — none explained. "Bypass Permissions" sounds alarming with no context.
**Impact:** Users cannot make an informed selection. "Bypass Permissions" may cause security concerns or misuse.
**Fix:** Add dynamic helper text below the dropdown that changes based on the selected option. Each mode needs at minimum a one-line explanation.

---

## Medium Priority — Significant Friction

### 1. Dead Space — Form Content Uses Only 40% of Viewport Width

**Location:** General tab — form content area (all tabs)
**What Happens:** The form content is hard-capped at ~562px wide (40% of a 1400px viewport), leaving ~526px (37.6%) as an empty black void to the right of every form field.
**Fix:** Remove the fixed max-width cap, or use a two-column layout. At minimum, use `max-w-2xl mx-auto` so empty space is centered rather than all sitting on the right.

---

### 2. No Unsaved Changes Warning on Navigation Away from Dirty Form

**Location:** Any tab with unsaved changes — navigating to another profile or section
**What Happens:** When unsaved changes exist (orange dot present), navigating to another sidebar item or nav section discards changes silently. There is no "You have unsaved changes — discard or save?" prompt.
**Fix:** Implement a navigation guard that shows a confirmation dialog when leaving a dirty form.

---

### 3. Sort Order Field Exposes Developer Internal

**Location:** General tab — Sort Order
**What Happens:** "Sort Order" shows a numeric spinner field. New users do not understand what a sort number means or that it controls sidebar position. There is no drag-to-reorder in the sidebar.
**Fix:** Remove Sort Order from the UI and implement drag-to-reorder handles on sidebar items. If keeping it, move to Advanced tab.

---

### 4. Setting Sources Checkboxes — Jargon Labels and No Explanation

**Location:** Prompt tab — Setting Sources section
**What Happens:** Four checkboxes labeled with filesystem path syntax: `Project settings (.claude/)`, `User settings (~/.claude/)`, `Global settings`, `Managed settings`. No explanation of what loading these settings does. "Managed settings" is particularly opaque.
**Fix:** Rewrite labels in plain language: "Project settings (local to this project)", "User settings (your personal defaults)". Add tooltip icons (?) for each. Rename "Managed settings" to "Organization settings (admin-controlled)".

---

### 5. Effort and Thinking Budget Tokens Are Unexplained and Disconnected

**Location:** Model tab — Effort section and Thinking Budget Tokens
**What Happens:** "Effort" (Low/Medium/High) has vague helper text ("Controls how much effort Claude puts into responses"). The relationship between Effort and Thinking Budget Tokens is completely unexplained — they look like two independent unrelated settings.
**Fix:** Explain concretely what Low/Medium/High maps to. Link Effort and Thinking Budget visually so it's clear they're related. Rename "Thinking Budget Tokens" to "Reasoning depth" or "Extended thinking budget".

---

### 6. "Include Claude Code system prompt" — Jargon and No Preview

**Location:** Prompt tab — checkbox
**What Happens:** The checkbox uses the term "prepended" and references "the built-in Claude Code system prompt" with no way to see what that prompt actually says.
**Fix:** Rephrase to plain English: "Include Claude's default coding assistant instructions (added before your prompt above)". Add a "Preview built-in prompt" expandable section.

---

### 7. Hooks Canvas — Node Palette Uses Internal Event Names With No Descriptions

**Location:** Hooks tab — Canvas view, node palette
**What Happens:** The TRIGGERS palette lists: `SessionStart`, `SessionEnd`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `UserPromptSubmit`, `PreCompact`, `Notification` — internal event names with no descriptions, no tooltips, no documentation links.
**Fix:** Add descriptive subtitles under each trigger node (e.g., "PreToolUse — Runs before any tool call"). Add a help icon (?) per node type.

---

### 8. Export JSON Button Disabled With No Explanation

**Location:** Hooks tab — JSON view
**What Happens:** The "Export JSON" button is present but disabled with no tooltip explaining why.
**Fix:** Add a tooltip: "Save the profile first to export." Or enable always and export current (unsaved) state.

---

### 9. Advanced Tab — No File Picker for Path Fields

**Location:** Advanced tab — Working Directory and Additional Directories
**What Happens:** Path fields show placeholders like `/path/to/project` with no folder picker button. On a desktop Tauri app, a system folder picker dialog should be available.
**Fix:** Add a folder picker button next to each path field (Tauri has a native file dialog API).

---

### 10. Save Success Has No Confirmation Feedback

**Location:** Profile editor header — Save button
**What Happens:** After a successful save, the only indicator is the Save button becomes disabled and the orange dot disappears. No toast, no success message, no acknowledgment.
**Fix:** Show a brief toast notification: "Profile saved" that auto-dismisses after 2 seconds.

---

### 11. Icon Field — Two Emoji Previews, No Picker

**Location:** General tab — Icon field
**What Happens:** The same emoji is displayed twice — once as a large standalone preview square, once inside the text input. It is unclear which reflects the saved value vs. the current input. There is no emoji picker, and some emoji categories render incorrectly.
**Fix:** Show a single live preview to the left of the text input. Remove the duplicate rendering inside the input. Add an emoji picker button (OS emoji panel trigger or curated grid picker). Validate and normalize emoji input.

---

### 12. Allowed vs. Disallowed Tools — Logic Interaction Undefined

**Location:** Tools tab
**What Happens:** Having both "Allowed Tools" AND "Disallowed Tools" is confusing. What happens if a tool appears in both? If Allowed is empty, does that mean all tools are allowed or none?
**Fix:** Make the logic explicit with a visible note. Better: replace with a single unified list with Allow/Block toggles per tool.

---

### 13. No Character Count on System Prompt Textarea

**Location:** Prompt tab — System Prompt textarea
**What Happens:** No character count, no token estimate, no max-length indicator for the system prompt textarea.
**Fix:** Add a character count below the textarea (e.g., "243 chars / ~61 tokens"). Add a typical range hint.

---

### 14. Sidebar — No Description Visible on Profile Items (Inconsistent)

**Location:** Sidebar — profile items
**What Happens:** Section 1 review found no description shown on sidebar items; Section 4 review found the description IS shown on some items. Behavior appears inconsistent across profiles.
**Fix:** Consistently show description as a subtitle line below the name in every sidebar item (truncated to 1 line). Ensure unsaved profiles also show a placeholder description.

---

### 15. Unsaved Changes Indicator Not Mirrored in Sidebar

**Location:** Profile editor header vs. sidebar items
**What Happens:** The orange dot appears in the editor header when changes are unsaved, but the sidebar item for that profile shows no corresponding indicator.
**Fix:** Mirror the unsaved indicator (orange dot or asterisk) on the sidebar list item.

---

### 16. Hooks Canvas — Rendering Artifact on Initial Load

**Location:** Hooks tab — Canvas view
**What Happens:** When Canvas view first loads, a visual artifact (dark rectangle inside gray rectangle with white stripe) appears overlapping an existing node. Likely a React Flow viewport calculation issue.
**Fix:** Trigger a `fitView()` call after the canvas mounts and its container dimensions are known.

---

### 17. Tab Order Doesn't Match User Mental Model

**Location:** Tab bar
**What Happens:** Current order: General → Prompt → Model → Tools → Hooks → MCP → Sandbox → Advanced. "MCP" (a common integration task) comes after "Hooks" (an automation/event task). The order doesn't guide users through configuration logically.
**Fix:** Consider: General → Prompt → Model → Tools → MCP → Hooks → Sandbox → Advanced. Or group the last four as a "Technical" collapsible section.

---

### 18. Sidebar Search/Filter Missing

**Location:** Agent Profiles sidebar
**What Happens:** No search or filter input for the profiles list. With more than ~10 profiles this will become difficult to navigate. The Conversations sidebar has a "Search sessions" field.
**Fix:** Add a search/filter input to the Agent Profiles sidebar, consistent with the Conversations panel.

---

## Low Priority — Polish

### 1. No Tooltip Labels on Left Nav Icons

**Location:** Left nav icon strip
**Fix:** Add tooltip labels on hover for all nav icons ("Chat", "Workspaces", "Teams", "Agents").

---

### 2. "AGENT PROFILES" Header — All-Caps Inconsistent With App Convention

**Location:** Sidebar section header
**Fix:** Change to "Agent Profiles" (sentence case) to match other sidebar headers.

---

### 3. Default Profile Has No Badge in Sidebar

**Location:** Sidebar profile items
**Fix:** Add a small "default" badge or star icon on the sidebar item of the profile with Default Profile checked.

---

### 4. Save Button — No Tooltip When Disabled

**Location:** Profile editor header — Save button
**Fix:** Add tooltip on the disabled Save button: "No unsaved changes."

---

### 5. No Help or Onboarding Element Anywhere in Agents Section

**Location:** Entire Agents section
**Fix:** Add a "?" help icon in the header that opens a popover explaining what agent profiles are and links to documentation.

---

### 6. Sidebar Context Menu Delete — No Confirmation

**Location:** Sidebar 3-dot context menu — Delete option
**Fix:** The sidebar context menu "Delete" must also trigger a confirmation dialog (same as the header Delete button).

---

### 7. No Keyboard Shortcut for Save (Cmd+S)

**Location:** Profile editor
**Fix:** Bind Cmd+S (macOS) / Ctrl+S (Windows/Linux) to the Save action.

---

### 8. "Hooks" Tab Name Is Opaque Jargon

**Location:** Tab bar
**Fix:** Rename to "Automations" or "Triggers". Or add a subtitle in the tab content header: "Hooks — Automate actions triggered by agent events."

---

### 9. "MCP" Tab Name Is an Unexplained Acronym

**Location:** Tab bar
**Fix:** Rename tab to "Integrations" or expand to "MCP Servers".

---

### 10. Thinking Budget Slider — No Track Fill, Missing Aria-Label

**Location:** Model tab — Thinking Budget Tokens slider
**Fix:** Use a filled track (active portion in accent color). The slider currently has `aria-label=null` — fix this accessibility violation.

---

### 11. Name Field Placeholder Is Not Instructional

**Location:** General tab — Name field
**What Happens:** Placeholder reads "My Agent Profile" — looks like a template value, not instructional text.
**Fix:** Change to "Enter profile name..."

---

### 12. Model Dropdown Exposes Raw API Model IDs

**Location:** Model tab — model selector
**What Happens:** Dropdown shows: "Haiku 4.5 (claude-haiku-4-5-20251001)" — raw API IDs are shown to end users.
**Fix:** Show only friendly names. Show API ID as secondary text or in a tooltip. Add brief capability descriptions.

---

### 13. Hooks Canvas — Empty State Has No CTA

**Location:** Hooks tab — Canvas view (empty)
**Fix:** Show an empty state: "Drag triggers from the palette to get started" with a simple illustrative diagram.

---

### 14. Profile Name in Sidebar — No Truncation Ellipsis

**Location:** Sidebar profile list items
**Fix:** Apply `text-overflow: ellipsis; overflow: hidden; white-space: nowrap` to profile names in sidebar items.

---

### 15. "Agents JSON" Label Is Ambiguous

**Location:** Advanced tab
**Fix:** Rename to "Sub-agents JSON" or "Team Configuration".

---

### 16. Tab Count — 8 Tabs Causes Cognitive Overload

**Location:** Tab bar
**What Happens:** 8 equally weighted tabs present immediate cognitive overload for first-time users. No progressive disclosure.
**Fix:** Group tabs: Basic (General, Prompt, Model) + "Advanced settings" expander containing the remaining tabs. Or use a two-level nav.

---

## Tab-by-Tab Summary

### General Tab
**What's there:** Name (required), Description, Icon (emoji), Color (hex), Default Profile (checkbox), Sort Order (numeric).
**Top 3 Issues:**
1. Color picker is broken (native picker opens behind the Tauri window)
2. Icon field shows same emoji twice and has no picker
3. Sort Order exposes developer internals
**Quick Fix:** Replace `<input type="color">` with an in-window color picker component. Show icon once. Move Sort Order to Advanced tab.

---

### Prompt Tab
**What's there:** System Prompt (resizable textarea), Include Claude Code system prompt (checkbox), Setting Sources (4 checkboxes).
**Top 3 Issues:**
1. No character/token count on the textarea
2. Setting Sources labels use filesystem path syntax (`~/.claude/`) instead of plain language
3. "Managed settings" has no explanation
**Quick Fix:** Add a character count. Rewrite Setting Sources labels to plain English. Add tooltips.

---

### Model Tab
**What's there:** Model selector dropdown, Effort (Low/Medium/High buttons), Thinking Budget Tokens (slider + number input).
**Top 3 Issues:**
1. ~60% of tab area is empty — implies missing features
2. "Effort" and "Thinking Budget" relationship is unexplained
3. Raw model API IDs exposed in dropdown
**Quick Fix:** Add explanation text linking Effort to Thinking Budget. Hide API IDs. Fill space with temperature/max tokens controls or contextual help.

---

### Tools Tab
**What's there:** Permission Mode (dropdown), Allowed Tools (textarea), Disallowed Tools (textarea).
**Top 3 Issues:**
1. Content clipped on right edge (layout overflow bug) — CRITICAL
2. Raw text input for tool names with no discovery or validation
3. Permission Mode options are unexplained
**Quick Fix:** Fix layout overflow immediately. Add dynamic helper text per Permission Mode. Replace textareas with a checklist of available tools.

---

### Hooks Tab
**What's there:** JSON/Canvas toggle, raw JSON editor (default), Canvas node editor (visual, secondary).
**Top 3 Issues:**
1. Raw JSON is the default view — accessibility barrier
2. Canvas button triggers dirty state and tab navigation (broken interaction)
3. Node palette uses internal event names with no descriptions
**Quick Fix:** Make Canvas the default view. Fix Canvas button event handling. Add descriptive subtitles to all node palette items.

---

### MCP Tab
**What's there:** "MCP Servers JSON" — a raw JSON editor with a placeholder showing an npx-based server config.
**Top 3 Issues:**
1. Acronym "MCP" never expanded on screen
2. No onboarding text explaining what MCP servers do
3. Raw JSON only — no form-based UI for adding servers
**Quick Fix:** Expand acronym. Add 2-sentence description. Add a "Browse available servers" link.

---

### Sandbox Tab
**What's there:** "Sandbox JSON" — raw JSON editor pre-filled with a Docker container configuration.
**Top 3 Issues:**
1. Docker/container jargon with no plain-language introduction
2. Raw JSON only — no preset options
3. No explanation of why a user would want a sandbox
**Quick Fix:** Add a plain-language intro. Add preset options (None, Node.js, Python, Custom) before showing JSON.

---

### Advanced Tab
**What's there:** Working Directory, Additional Directories, Max Turns, Max Budget, Agents JSON.
**Top 3 Issues:**
1. No folder picker for path fields (missed Tauri native capability)
2. "Agents JSON" label is ambiguous (could be confused with the current profile)
3. Sub-agent configuration deserves its own tab, not burial in Advanced
**Quick Fix:** Add folder picker buttons. Rename "Agents JSON" to "Sub-agents JSON". Consider promoting sub-agents to their own tab.

---

### Sidebar
**What's there:** "AGENT PROFILES" header with "+" button, profile list with emoji + name, 3-dot context menu on hover.
**Top 3 Issues:**
1. "AGENT PROFILES" all-caps inconsistent with app convention
2. No unsaved-changes indicator mirrored from the editor
3. No search/filter for profiles
**Quick Fix:** Change to title case. Mirror unsaved indicator. Add search input.

---

### Empty State ("No profile selected")
**What's there:** Robot icon, "No profile selected" heading, subtitle with instructions, no action button.
**Top 3 Issues:**
1. "Create a new one" is plain text, not a button
2. No direct CTA in the empty state itself
3. No onboarding guidance about what agent profiles are for
**Quick Fix:** Add a "Create New Profile" button directly in the empty state.

---

## Recommended Fix Order

### Sprint 1 — Critical Bugs (Must fix before any user testing)

1. Fix tab clicks creating phantom "New Agent Profile" entries (BUG-1)
2. Show an error toast/snackbar on any save failure — never fail silently (BUG-2)
3. Add server-side soft-delete with recovery window to prevent catastrophic data loss (BUG-3)
4. Add Cancel button, 3-second timeout, and Escape dismissal to Delete confirmation (BUG-4)
5. Auto-select and auto-focus Name field after new profile creation (BUG-5)
6. Add "Unsaved changes — Save or Discard?" navigation guard on dirty forms (BUG-6)
7. Validate Name field inline and disable Save when empty (BUG-7)
8. Fix Tools tab layout overflow — content clipped on right edge (BUG-8)

---

### Sprint 2 — High Priority UX (Makes the app minimally usable)

1. Fix tab active indicator rendering (drives CSS from `aria-selected`)
2. Always open new profiles on General tab with Name field focused
3. Always navigate to General tab when selecting a profile from sidebar
4. Fix false dirty state on tab switch (only mark dirty on actual value changes)
5. Implement ESC to revert focused field to last-saved value
6. Move Delete to bottom of General tab or overflow menu; use modal confirmation with profile name
7. Fix header showing wrong profile name (sidebar selection and panel must share a single source of truth)
8. Replace Tools textareas with a visual checklist of available tools
9. Make Hooks Canvas the default view; fix Canvas button event handling
10. Add MCP onboarding text, expand acronym, add form-based server entry UI
11. Add Sandbox preset options and plain-language intro
12. Replace Tauri color picker with an in-window color picker component

---

### Sprint 3 — Medium Polish (Makes the app good)

1. Fix dead space — remove max-width cap on form content area
2. Add character/token count to System Prompt textarea
3. Rewrite Setting Sources labels to plain English with tooltips
4. Add explanation linking Effort to Thinking Budget Tokens; add concrete value descriptions
5. Add folder picker buttons to Advanced tab path fields
6. Add "Profile saved" toast on successful save
7. Fix Icon field — single preview, add emoji picker button, fix multi-byte emoji rendering
8. Add dynamic helper text per Permission Mode option
9. Fix Hooks Canvas rendering artifact (call `fitView()` after mount)
10. Mirror unsaved-changes indicator on sidebar items
11. Add navigation guard for unsaved changes warning
12. Move Sort Order to Advanced tab; add drag-to-reorder to sidebar
13. Add search/filter to Agent Profiles sidebar

---

### Sprint 4 — Low Polish (Makes the app excellent)

1. Add tooltip labels to all left nav icons
2. Change "AGENT PROFILES" to "Agent Profiles" (sentence case)
3. Add "default" badge to sidebar item for the default profile
4. Add tooltip to disabled Save button
5. Add "?" help icon with onboarding popover in Agents section header
6. Ensure sidebar context menu Delete also shows confirmation dialog
7. Add Cmd+S / Ctrl+S keyboard shortcut for Save
8. Rename "Hooks" tab to "Automations" or add subtitle
9. Rename "MCP" tab to "Integrations" or "MCP Servers"
10. Fix Thinking Budget slider track fill and add `aria-label`
11. Add empty state CTA button in the "No profile selected" area
12. Fix model dropdown to hide raw API IDs; add capability descriptions
13. Add Hooks Canvas empty state with CTA
14. Apply text truncation ellipsis to sidebar profile name items
15. Rename "Agents JSON" to "Sub-agents JSON" in Advanced tab
16. Add "Default (currently: Haiku 4.5)" inline to model default option

---

## What's Working Well

1. **Unsaved changes indicator is excellent.** The orange dot in the header title is immediate and clearly signals dirty state. The Save button enabling in sync with the indicator is correct behavior.

2. **Context menu (3-dot) on sidebar hover is well-implemented.** The hover-reveal pattern keeps the sidebar clean. The Duplicate action is a thoughtful addition for creating similar profiles quickly.

3. **Required field asterisk is clear.** The red asterisk on "Name *" correctly signals required fields using a universally understood convention.

4. **Canvas (node editor) concept for Hooks is genuinely excellent.** The visual node palette with Triggers → Conditions → Actions is a strong UX pattern for configuring hooks. When it works, it makes a developer concept approachable.

5. **JSON/Canvas toggle for Hooks respects both novice and expert users.** Offering both views is the right philosophy — the execution just needs to make Canvas the default.

6. **Helper text exists for every field.** Each field and section has a short descriptive paragraph. This is good UX hygiene, even where the text needs improvement.

7. **Effort buttons (Low/Medium/High) are clean and scannable.** The segmented button control for Effort is visually clean and easy to understand as a three-way selection.

8. **System Prompt textarea supports vertical resizing.** `resize: vertical` is correctly set, giving users control over the textarea height.

9. **Thinking Budget has both a slider and a numeric input.** Having both controls is good UX: slider for approximate adjustment, number field for precise entry, visually adjacent.

10. **Permission Mode defaults to "Default" (safest option).** Security-first defaults are the right approach.

11. **MCP server placeholder JSON is realistic.** The placeholder JSON shows a real-world `npx @my/mcp-server` pattern with env vars — useful reference for developers.

12. **Delete confirmation two-step exists.** The intent (requiring a second deliberate action to delete) is correct. The execution (no cancel, no timeout, no modal) needs fixing but the pattern is right.

13. **Live header update as Name is typed.** The profile editor header updates in real-time as the user types — good reactive feedback.

14. **Advanced tab content is genuinely advanced.** Working Directory, Max Turns, Max Budget, and Agents JSON are legitimately advanced settings appropriately grouped.

15. **Tab bar has horizontal scroll fallback.** The tab bar uses `overflow-x-auto` so all 8 tabs are accessible even on narrower viewports — not obvious, but functional.

---

*Total unique issues: 8 Critical | 15 High | 18 Medium | 16 Low*
*Issues deduplicated across all 4 source sections.*
