# UX Review: Section 3 - Hooks, MCP, Sandbox, Advanced Tabs

**Reviewed:** 2026-03-19
**Reviewer:** Claude Code (automated UX audit via Playwright)
**Target:** Code Reviewer agent profile, tabs: Hooks, MCP, Sandbox, Advanced
**Also tested:** General tab Save flow, ESC behavior

---

## Screenshots Taken

| File | Contents |
|------|----------|
| `docs/investigations/screenshots/04-code-reviewer-general-tab.png` | General tab baseline |
| `docs/investigations/screenshots/09-hooks-tab-clean.png` | Hooks tab - JSON view |
| `docs/investigations/screenshots/10-hooks-canvas-view.png` | Hooks - canvas/node editor, first render attempt |
| `docs/investigations/screenshots/11-hooks-tab-correct.png` | Hooks - JSON view correct render |
| `docs/investigations/screenshots/12-hooks-canvas-clicked.png` | Hooks - Canvas view with node palette visible |
| `docs/investigations/screenshots/15-mcp-tab.png` | MCP tab |
| `docs/investigations/screenshots/17-sandbox-tab-correct.png` | Sandbox tab |
| `docs/investigations/screenshots/18-advanced-tab.png` | Advanced tab |
| `docs/investigations/screenshots/20-save-button-enabled.png` | Save button enabled with unsaved changes |
| `docs/investigations/screenshots/21-after-esc.png` | After pressing ESC |
| `docs/investigations/screenshots/22-after-save-attempt.png` | After save attempt - shows state corruption |

---

## Issues Found

### CRITICAL

---

**[CRITICAL-1] Tab clicks trigger sidebar profile navigation / deselection**

- **Severity:** Critical
- **Location:** All tabs — Hooks, MCP, Sandbox, Advanced
- **Description:** Clicking certain tabs using Playwright's `getByRole('tab')` locator or `element.click()` via JS injection causes the profile to deselect (showing "No profile selected" state) or navigate entirely to the Chat view. This happened reproducibly across multiple attempts. The root cause appears to be that event delegation on the tab bar is interfering with click events being interpreted as sidebar item selections. Mouse wheel events on the Hooks Canvas also triggered profile deselection. Only clicking by raw mouse coordinates (via `page.mouse.click(x, y)`) reliably selects tabs. **A user clicking tabs normally in Electron/Tauri may or may not experience the same bug depending on how the OS bridges click events**, but the instability is real — several interaction paths caused navigation away from the profile.
- **Recommendation:** Audit tab click event handlers. Ensure `e.stopPropagation()` is called on tab clicks. The event bubbling chain from tab → tablist → profile editor panel → sidebar item button is clearly broken.

---

**[CRITICAL-2] Typing into a field coordinates incorrectly — form data corrupted across profiles**

- **Severity:** Critical
- **Location:** General tab, Name/Description fields
- **Description:** When clicking at calculated center-of-element coordinates for the Description field (based on `getBoundingClientRect`), input was received by a different element (the Name field) on another profile context. This caused the Name field to receive text meant for Description, corrupting the "Code Reviewer" profile name to blank/"Untitled Profile" and also populating a "New Agent Profile" with unintended content ("My Test Agent", "A test agent for UX review"). This reveals a possible coordinate-space mismatch between the DOM-reported bounding rect and the actual rendered position — potentially caused by CSS transforms, a scaled canvas, or a scrolled parent container that isn't accounted for in `getBoundingClientRect`.
- **Recommendation:** Investigate whether the agent profile editor panel is rendered inside a CSS `transform: scale()` or a scrolled container that shifts visual coordinates from DOM-reported coordinates.

---

**[CRITICAL-3] Clicking "Canvas" button in Hooks tab triggers Save state / navigates to Prompt tab**

- **Severity:** Critical
- **Location:** Hooks tab → Canvas button
- **Description:** Multiple attempts to click the "Canvas" button using both Playwright selectors and JS `.click()` resulted in: (a) the active tab jumping from Hooks to Prompt, (b) the profile's orange "unsaved changes" dot appearing, and (c) the Save button becoming enabled without any intentional user change. Only clicking Canvas via raw mouse coordinates at `(440, 114)` successfully toggled to the Canvas view. Even then, the profile showed the "Confirm Delete" state in the header, indicating stale state from a prior interaction leaked through.
- **Recommendation:** The Canvas/JSON toggle buttons must be isolated from the form's dirty-state detection. A view toggle should not mark the form as modified.

---

**[CRITICAL-4] Unsaved profile state ("New Agent Profile") silently created during navigation**

- **Severity:** Critical
- **Location:** Sidebar / Agent Profiles list
- **Description:** During testing, a "New Agent Profile" entry appeared in the sidebar without any user intent to create one. It persisted across profile switches and accumulated stale/incorrect data. Clicking around the editor with any misrouted events can silently create new profiles. After navigation, this phantom profile disappeared from the sidebar without confirmation or explanation.
- **Recommendation:** New profile creation must require an explicit, deliberate action. The "+" button should be the only way to initiate creation. Profile creation should not be triggered by event bubbling or misrouted clicks.

---

### HIGH

---

**[HIGH-1] Tab underline indicator renders on wrong tab**

- **Severity:** High
- **Location:** Tab bar (all tabs)
- **Description:** After navigating to the MCP tab (screenshot: `15-mcp-tab.png`), the active underline indicator was visually rendering under the "Prompt" tab text, not "MCP". The correct tab was functionally selected (aria-selected=true on MCP), but the CSS active indicator was misaligned. This is a visual regression that directly misleads users about where they are.
- **Recommendation:** The tab active indicator is likely absolutely positioned and relies on a `left` offset that is not recalculated when tabs are added/removed or when the profile editor is mounted. Switch to a CSS approach using `aria-selected` to drive the indicator (e.g., `[aria-selected="true"]::after`).

---

**[HIGH-2] ESC does not revert unsaved changes**

- **Severity:** High
- **Location:** General tab, any edited field
- **Description:** After modifying the Name field and pressing ESC, the changes were NOT reverted. The profile remained showing "Untitled Profile" with the orange dirty indicator. Instead, ESC appeared to move keyboard focus (it switched the active view to Prompt tab). Users reasonably expect ESC to either revert a focused input to its saved value or at minimum do nothing — not change the active tab.
- **Recommendation:** Implement ESC on focused inputs to blur the input and revert value to last-saved state. Do not use ESC to trigger tab navigation.

---

**[HIGH-3] Hooks tab: Raw JSON as the primary (default) interface for a visual concept**

- **Severity:** High
- **Location:** Hooks tab
- **Description:** The Hooks tab opens by default in JSON editing mode, showing a raw JSON object with keys like `"PreToolUse"`, `"matcher"`, `"hooks"`, `"type": "command"`. There is no plain-language explanation of what hooks do, what problem they solve, or when a user would want them. The helper text — "Define hooks that run before/after tool use, at session start/end, or on notifications. Uses the Claude Code hooks format." — mentions "Claude Code hooks format" as if that is a known standard the user should already understand.
- **Recommendation:** The Canvas view (visual node editor) should be the default. The JSON view should be an "Expert mode" toggle. Add a brief explanation: "Hooks let you run custom commands automatically when the agent starts, stops, or uses a tool." Link to documentation.

---

**[HIGH-4] MCP tab: Entirely raw JSON, no guidance for new users**

- **Severity:** High
- **Location:** MCP tab
- **Description:** The MCP tab shows only a raw JSON editor labeled "MCP Servers JSON" with an example configuration containing `"command": "npx"`, `"-y"`, `"@my/mcp-server"`, and `"API_KEY": "..."`. The abbreviation "MCP" (Model Context Protocol) is never expanded anywhere on the screen. A new user has no idea what this does, why they need it, or how to get started. The helper text says "Each server provides additional tools and context" — which is accurate but assumes the user already knows what MCP servers are.
- **Recommendation:**
  - Expand the acronym: "MCP (Model Context Protocol) Servers"
  - Add 1-2 sentence explanation: "MCP servers extend your agent with additional capabilities, like web search, database access, or custom tools."
  - Add a "Browse available servers" link or at minimum link to documentation
  - Consider a form-based UI for adding servers (name, command, args, env vars) instead of raw JSON

---

**[HIGH-5] Sandbox tab: No explanation of what "sandbox" means or why a user would want it**

- **Severity:** High
- **Location:** Sandbox tab
- **Description:** The Sandbox tab shows a raw JSON editor labeled "Sandbox JSON" pre-filled with a Docker container config (`"type": "docker"`, `"image": "node:20"`, `"volumes": ["/workspace:/workspace"]`). The helper text says "Sandboxes provide isolated execution environments (e.g., Docker containers) for running tools safely." This is technically accurate but completely inaccessible to non-DevOps users. Terms like "Docker", "image", "volumes", and container paths are all technical infrastructure concepts.
- **Recommendation:**
  - Add a plain-language intro: "A sandbox runs your agent's tools in an isolated environment, preventing them from affecting your computer directly."
  - Offer preset options (e.g., "None", "Node.js container", "Python container", "Custom") before showing raw JSON
  - The raw JSON should be a fallback for custom configurations, not the primary UI

---

**[HIGH-6] Advanced tab: "Agents JSON" field hides a major capability**

- **Severity:** High
- **Location:** Advanced tab → Agents JSON
- **Description:** The Advanced tab contains an "Agents JSON" section pre-filled with a sub-agent definition (name, description, model, tools). This is a significant capability — defining specialized sub-agents for a profile — but it is buried at the bottom of the Advanced tab as raw JSON with no discoverability. The feature description "Configure sub-agents available to this profile. Defines a team of specialized agents..." is clear, but the placement in Advanced and the JSON-only interface makes it invisible to most users.
- **Recommendation:** Sub-agent configuration deserves its own tab or at minimum a prominent section in the profile editor. This is as important a concept as "Tools" or "Prompt" and should not be in Advanced.

---

**[HIGH-7] Delete button requires double-click but provides no visual state feedback**

- **Severity:** High
- **Location:** Profile editor header → Delete button
- **Description:** The Delete flow uses a two-step confirmation: first click changes the button text to "Confirm Delete". However during testing, this state became stuck — the button read "Confirm Delete" even after navigating between tabs, switching profiles, and performing other actions. The confirmation state did not reset when the user navigated away. This means a user could navigate away, come back, and accidentally confirm a delete they initiated earlier.
- **Recommendation:** The confirmation state should time out after ~3 seconds or reset immediately when the user navigates away from the profile or switches tabs.

---

### MEDIUM

---

**[MEDIUM-1] Tab ordering places developer features before common user tasks**

- **Severity:** Medium
- **Location:** Tab bar
- **Description:** Current tab order: General → Prompt → Model → Tools → **Hooks → MCP → Sandbox → Advanced**. The last four tabs are increasingly developer-focused. This is reasonable, but "Hooks" and "MCP" are arguably more common configuration tasks than "Sandbox" and should arguably precede it. More importantly, the ordering doesn't match a new user's mental model of "what do I configure first?" — which is likely: name/description, then behavior (prompt), then capabilities (tools/MCP), then automation (hooks), then infrastructure (sandbox/advanced).
- **Recommendation:** Consider: General → Prompt → Model → Tools → MCP → Hooks → Sandbox → Advanced. Or alternatively, group the last four into a "Technical" section rather than individual tabs.

---

**[MEDIUM-2] Hooks Canvas view: Node palette labels use internal event names**

- **Severity:** Medium
- **Location:** Hooks tab → Canvas view
- **Description:** The node palette TRIGGERS section lists: `SessionStart`, `SessionEnd`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `UserPromptSubmit`, `PreCompact`, `Notification`. These are internal event names (likely the same strings used in the JSON schema). A user building hooks without prior knowledge of Claude Code's event model cannot determine from these names when they fire, what data they carry, or how to use them. There are no descriptions, no tooltips, and no documentation links.
- **Recommendation:** Add descriptive subtitles under each trigger node: e.g., "PreToolUse — Runs before any tool call". Add a help icon (?) on each node type that opens a tooltip or modal with usage details.

---

**[MEDIUM-3] Hooks Canvas: Rendering artifact visible on initial load**

- **Severity:** Medium
- **Location:** Hooks tab → Canvas view (screenshot: `12-hooks-canvas-clicked.png`)
- **Description:** When the Canvas view first loads, a visual artifact appears in the canvas area — a dark rectangle inside a gray rectangle with a white vertical stripe, overlapping what appears to be an existing "PreToolUse → Bash → command" node. This is likely a React Flow rendering issue where the initial viewport or node positions are calculated before the canvas container is fully sized.
- **Recommendation:** Trigger a `fitView()` call after the canvas mounts and its container dimensions are known.

---

**[MEDIUM-4] Export JSON button is disabled but there is no explanation why**

- **Severity:** Medium
- **Location:** Hooks tab → JSON view → "Export JSON" button
- **Description:** The "Export JSON" button is present but disabled. There is no tooltip, label, or explanation for why it is disabled. A user might assume their configuration cannot be exported, or that the feature is broken.
- **Recommendation:** Add a tooltip: "Save the profile first to export". Or enable the export button always and export the current (unsaved) state.

---

**[MEDIUM-5] Advanced tab: Working Directory and Additional Directories use file path placeholders with no picker**

- **Severity:** Medium
- **Location:** Advanced tab
- **Description:** The "Working Directory (cwd)" field shows placeholder `/path/to/project` and "Additional Directories" shows example paths. There is no file system browser/picker button to help users select actual paths. On a desktop Tauri app, this is a missed opportunity — a folder picker dialog should be available.
- **Recommendation:** Add a folder picker button (📁) next to each path field.

---

**[MEDIUM-6] Save success has no confirmation feedback**

- **Severity:** Medium
- **Location:** Profile editor header → Save button
- **Description:** When a save completes (assuming it works correctly), the only indication is that the Save button becomes disabled again and the orange dot disappears. There is no toast, success message, or any other acknowledgment that the save succeeded. For a user who is new to the interface, this may leave them uncertain whether anything happened.
- **Recommendation:** Show a brief toast notification: "Profile saved" that auto-dismisses after 2 seconds.

---

**[MEDIUM-7] "Setting Sources" in Prompt tab contains developer-facing path syntax**

- **Severity:** Medium
- **Location:** Prompt tab → Setting Sources
- **Description:** The Setting Sources checkboxes show labels like `Project settings (.claude/)` and `User settings (~/.claude/)` with filesystem path syntax. These labels expose internal implementation details and are confusing to non-technical users who do not know what `.claude/` or `~/.claude/` means.
- **Recommendation:** Use friendlier labels: "Project settings (local to this project)", "User settings (your personal defaults)", "Global settings", "Managed settings". The paths can be shown as secondary text or in a tooltip for users who need them.

---

**[MEDIUM-8] Sort Order field is exposed in General tab**

- **Severity:** Medium
- **Location:** General tab → Sort Order
- **Description:** The "Sort Order" field with its numeric spinner is shown in the General tab for all users. Manually entering sort order numbers is a developer/admin workflow — most users would expect to reorder profiles via drag-and-drop in the sidebar. The field is also labeled with "Lower numbers appear first in the sidebar" which reveals the implementation detail rather than the user intent.
- **Recommendation:** Move Sort Order to the Advanced tab or implement drag-to-reorder in the sidebar and remove this field entirely.

---

### LOW

---

**[LOW-1] "Hooks" tab name gives no hint of what it does**

- **Severity:** Low
- **Location:** Tab bar
- **Description:** "Hooks" is a developer term that non-technical users will not understand. A user building an agent profile for the first time will see: General, Prompt, Model, Tools, **Hooks**, MCP, Sandbox, Advanced — and have no idea what "Hooks" means or whether they need it.
- **Recommendation:** Rename to "Automations" or "Triggers" with the tab. Or keep "Hooks" but add a subtitle in the tab content header area explaining: "Hooks — Automate actions triggered by agent events".

---

**[LOW-2] "MCP" tab name is an unexplained acronym**

- **Severity:** Low
- **Location:** Tab bar
- **Description:** "MCP" in the tab bar is not explained. Even on the tab's content page, the acronym is not spelled out in the tab or section header.
- **Recommendation:** Rename the tab "Integrations" or expand to "MCP Servers" to at least hint at the content.

---

**[LOW-3] Color field shows hex value and swatch but no color picker**

- **Severity:** Low
- **Location:** General tab → Color field
- **Description:** The Color field shows a colored swatch and a hex text input (`#6366f1`). A user who wants to change the color must know to type a hex value. Clicking the swatch does not open a color picker.
- **Recommendation:** Make the swatch clickable and open a native color picker dialog.

---

**[LOW-4] Icon field shows the emoji twice (preview + input)**

- **Severity:** Low
- **Location:** General tab → Icon field
- **Description:** The Icon field shows the current emoji (🔍) as a standalone display element AND the same emoji inside the text input field. The emoji is rendered twice in close proximity which looks redundant. The helper text says "Enter an emoji character" but there is no picker or guidance.
- **Recommendation:** Show only the input field with the emoji inside it. Or if you want a preview, clearly separate it visually. Consider adding an emoji picker button.

---

**[LOW-5] "Managed settings" checkbox label has no explanation**

- **Severity:** Low
- **Location:** Prompt tab → Setting Sources
- **Description:** "Managed settings" is the only label in Setting Sources without a path or clarifying parenthetical. Users cannot know what "managed" means in this context — is it managed by an admin? By the app? By Claude?
- **Recommendation:** Add a clarifying note: "Managed settings (enterprise/admin controlled)" or equivalent.

---

**[LOW-6] Advanced tab: "Agents JSON" label is ambiguous**

- **Severity:** Low
- **Location:** Advanced tab
- **Description:** The section is called "Agents JSON" — but the profile being edited is itself an agent. This name implies configuration of *other* agents, which is correct, but the naming is confusing at first read.
- **Recommendation:** Rename to "Sub-agents JSON" or "Team Configuration" to clarify the relationship.

---

**[LOW-7] No empty state for Hooks Canvas when no hooks are configured**

- **Severity:** Low
- **Location:** Hooks tab → Canvas view
- **Description:** When no hooks are configured, the Canvas view shows an empty gray canvas with no prompt, no instructions, and no "get started" CTA. A user switching to Canvas view with an empty hooks config sees nothing actionable.
- **Recommendation:** Show an empty state in the canvas: "Drag triggers from the palette to get started" with a simple illustrative diagram.

---

## Positives

1. **Canvas (node editor) concept is excellent** — The visual node palette with Triggers → Conditions → Actions is a genuinely good UX pattern for configuring hooks. When it works, it makes a developer concept approachable. The node types (SessionStart, PreToolUse, etc.) are clear categories.

2. **JSON/Canvas toggle for hooks** — Offering both a visual editor and raw JSON mode respects both novice and expert users. The JSON mode is useful for power users who want to copy/paste from documentation.

3. **Helper text exists on most fields** — Every significant field has a short description below it. The descriptions are technically accurate and helpful for developers.

4. **Save button dirty-state indicator (orange dot)** — The orange dot on the profile header when there are unsaved changes is a good pattern. It's visible and consistent.

5. **Advanced tab content is genuinely "advanced"** — Working Directory, Max Turns, Max Budget, and Agents JSON are all legitimately advanced settings. The Advanced tab appropriately groups infrastructure-level configuration.

6. **Delete confirmation two-step** — Requiring a second click to confirm delete is correct pattern. The button text change to "Confirm Delete" is clear.

7. **Tab bar has all major configuration domains** — General, Prompt, Model, Tools, Hooks, MCP, Sandbox, Advanced covers the full configuration space of an agent profile. No obvious gaps in the taxonomy.

8. **MCP server example JSON is realistic** — The placeholder JSON in MCP tab shows a real-world pattern (`npx`, `@my/mcp-server`, env vars) that matches how MCP servers are actually configured, which is helpful for developers.

---

## Summary of Most Critical Issues

| Priority | Issue | Impact |
|----------|-------|--------|
| #1 | Tab clicks cause profile deselection / navigation loss | Users cannot reliably navigate between tabs |
| #2 | JS `.click()` on tabs deselects profile | Automation/testing instability symptom of underlying event bug |
| #3 | Canvas button click marks form as dirty / navigates away | Core feature of Hooks is broken |
| #4 | ESC does not revert changes, navigates to different tab instead | Destroys user expectation |
| #5 | Delete confirmation state does not reset on navigation | Accidental deletion risk |
| #6 | All of Hooks, MCP, Sandbox default to raw JSON with no onboarding | Major accessibility barrier for non-developer users |
