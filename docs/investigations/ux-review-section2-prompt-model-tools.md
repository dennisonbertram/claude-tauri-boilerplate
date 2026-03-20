# UX Review: Section 2 - Prompt, Model, Tools Tabs

**Reviewer:** Claude (automated UX audit via Playwright)
**Date:** 2026-03-19
**Profile tested:** Code Reviewer (Agent Profiles section)
**App URL:** http://localhost:1420

---

## Screenshots Taken

All screenshots are in `.claude/browser-artifacts/`:

| File | Description |
|------|-------------|
| `page-2026-03-19T21-22-44-626Z.png` | Agents section first opened — Code Reviewer in sidebar |
| `page-2026-03-19T21-22-58-742Z.png` | Code Reviewer General tab (baseline) |
| `page-2026-03-19T21-31-43-536Z.png` | Prompt tab — full view (Code Reviewer) |
| `01-prompt-tab-header-tabs.png` | Prompt tab — tab bar + header zoomed |
| `02-prompt-system-prompt-textarea.png` | Prompt tab — System Prompt label + textarea zoomed |
| `03-prompt-textarea-resize-handle.png` | Prompt tab — textarea resize handle corner |
| `04-prompt-helper-text.png` | Prompt tab — helper text below textarea |
| `05-prompt-include-checkbox.png` | Prompt tab — Include Claude Code system prompt checkbox |
| `06-prompt-setting-sources.png` | Prompt tab — Setting Sources section |
| `page-2026-03-19T21-32-54-077Z.png` | Model tab — full view (Code Reviewer) |
| `07-model-tab-full.png` | Model tab — full page screenshot |
| `08-model-selector-zoomed.png` | Model tab — model selector dropdown zoomed |
| `09-model-effort-section.png` | Model tab — Effort Low/Medium/High buttons |
| `10-model-thinking-budget.png` | Model tab — Thinking Budget Tokens slider + input |
| `10b-model-helper-text.png` | Model tab — helper text |
| `page-2026-03-19T21-34-40-786Z.png` | Tools tab — full view (Code Reviewer) |
| `11-tools-tab-full.png` | Tools tab — full page screenshot |
| `12-tools-permission-mode.png` | Tools tab — Permission Mode section zoomed |
| `13-tools-allowed-tools.png` | Tools tab — Allowed Tools textarea zoomed |
| `14-tools-disallowed-tools.png` | Tools tab — Disallowed Tools textarea zoomed |

---

## CRITICAL BUGS FOUND DURING TESTING

> These are not just UX issues — they are functional bugs discovered during navigation that must be fixed before any UX polish.

### BUG-1 [CRITICAL]: Tab clicks create phantom "New Agent Profile" entries

**What happens:** When clicking any tab (Prompt, Model, Tools, etc.) on an existing profile, the app silently creates a new unsaved "New Agent Profile" entry in the sidebar. This happens on every tab click.

**Evidence:** After clicking Prompt tab on Code Reviewer, a "New Agent Profile" appeared in the sidebar. After clicking it again, a second one appeared. The sidebar ended up with 2 "New Agent Profile" ghost entries alongside the real profile.

**Impact:** Confusing — user sees extra profiles they didn't create. Worse: these ghost profiles attempt auto-save and fail (see BUG-2).

**Recommendation:** Tab switching must never trigger profile creation. Investigate the `onClick` handler on tab components — it appears to be calling a `createProfile()` side effect.

---

### BUG-2 [CRITICAL]: Auto-save on tab switch triggers validation failure silently

**What happens:** When navigating between tabs, the app silently attempts to auto-save the profile. If validation fails (e.g., on an unsaved/empty profile), a console error fires but the user sees nothing:

```
[ERROR] Failed to save profile: Error: Validation failed
    at Module.updateAgentProfile (agent-profile-api.ts:32)
    at AgentProfileEditor.tsx:94
[ERROR] Failed to load resource: 400 (Bad Request) @ /api/agent-profiles/{id}
```

**Impact:** Data is silently lost. The user has no idea something went wrong.

**Recommendation:** Either (a) don't auto-save on tab switch — use explicit Save only, or (b) show a toast/snackbar on save failure. Never fail silently.

---

### BUG-3 [CRITICAL]: Data loss — original Code Reviewer profile was permanently destroyed

**What happens:** The cascade of tab-clicking bugs (BUG-1 + BUG-2) destroyed the original Code Reviewer profile during testing. After multiple tab clicks, the sidebar showed "No agent profiles yet" and after a page reload, Code Reviewer was gone permanently — not even showing in the chat profile selector.

**Impact:** Users can accidentally delete their own profiles through normal navigation. This is catastrophic.

**Recommendation:** Add confirmation dialogs before any destructive operation. Implement undo/history or at minimum server-side soft-delete with recovery.

---

### BUG-4 [HIGH]: Header shows "Untitled Profile" / wrong profile name mid-session

**What happens:** After clicking a tab, the header sometimes switches from "Code Reviewer" to "Untitled Profile" or "New Agent Profile", even though Code Reviewer is visually highlighted in the sidebar. The panel content may correspond to a completely different profile than the sidebar selection.

**Impact:** User cannot tell which profile they are editing. Any changes made go to the wrong profile.

**Recommendation:** The selected profile in the sidebar must stay in lock-step with the panel header. Fix the state management so sidebar selection and panel content always refer to the same profile object.

---

### BUG-5 [HIGH]: Unsaved indicator (orange dot) appears immediately on tab switch, even without user edits

**What happens:** The orange dot next to the profile name in the header (indicating unsaved changes) appears as soon as you switch tabs, even if no data was changed. This is a false "dirty" state.

**Impact:** Users will constantly be prompted/anxious about unsaved changes that don't exist. They may click Save unnecessarily, or worse, ignore real unsaved changes because the indicator cried wolf.

**Recommendation:** Only set the dirty flag when actual form field values change, not on tab navigation.

---

## Issues Found

### PROMPT TAB

---

**Issue P-1** | Severity: High | Location: Prompt tab — textarea
**Description:** The System Prompt textarea has a fixed minimum height of 200px but `maxHeight: none`. On a short viewport or when the profile panel is small, the textarea takes up a disproportionate amount of space. With only ~165px of vertical space remaining below, the Setting Sources checkboxes get crammed together. The textarea height is also non-obvious to expand.
**Evidence (DOM):** `min-height: 200px`, `height: 200px`, `resize: vertical`. The resize handle is a tiny 3x3 pixel grip at the bottom-right corner.
**Recommendation:** Set a larger initial height (300-400px), add explicit min/max bounds visible to users, and consider a drag-to-expand affordance with visual guidance.

---

**Issue P-2** | Severity: High | Location: Prompt tab — textarea
**Description:** No character count indicator. System prompts can easily reach thousands of tokens. There is no feedback on how long the current prompt is, what the maximum length is, or how many tokens it consumes. A new user has no idea if their 10-line prompt is "normal" or will break the model.
**Recommendation:** Add a character count (e.g., "243 chars / ~61 tokens") below the textarea. Add a visible max-length or at least a "typical range" hint.

---

**Issue P-3** | Severity: High | Location: Prompt tab — textarea
**Description:** The placeholder text says `"You are a helpful assistant..."` which is generic and completely wrong for a Code Reviewer profile. A new user creating a Code Reviewer sees this placeholder and has no idea what a good code review system prompt looks like.
**Recommendation:** Either (a) use a role-specific placeholder that fits the profile name/description, or (b) provide example templates or a "load example prompt" button that inserts a good starting prompt based on the profile type. The current placeholder actively misleads the user.

---

**Issue P-4** | Severity: Medium | Location: Prompt tab — "Include Claude Code system prompt" checkbox
**Description:** The checkbox is pre-checked but the term "Claude Code system prompt" is opaque jargon for a non-technical user. What IS the built-in Claude Code system prompt? How long is it? Does it conflict with what I write?
**The helper text says:** "When enabled, the built-in Claude Code system prompt is prepended to your custom system prompt."
**Problem:** "Prepended" is a developer term. The user doesn't know if the built-in prompt will override their instructions, complement them, or reduce their effective token limit.
**Recommendation:** Rephrase to plain English: "Include Claude's default coding assistant instructions (added before your prompt above)". Add a "Preview built-in prompt" expandable section or link so users can see what they're inheriting.

---

**Issue P-5** | Severity: Medium | Location: Prompt tab — Setting Sources section
**Description:** Four checkboxes: "Project settings (.claude/)", "User settings (~/.claude/)", "Global settings", "Managed settings". All are unchecked by default. Problems:
- "Project settings (.claude/)" — what project? The user hasn't selected a project in this context.
- "Managed settings" — what does "managed" mean? Managed by whom?
- No explanation of what loading these settings actually does — does it merge config files? Override the prompt? Add more tools?
- The distinction between "Global settings" and "User settings" is unclear without reading docs.
**Recommendation:** Add tooltip icons (?) next to each checkbox label with a 1-sentence explanation. Rewrite "Managed settings" to "Organization settings (admin-controlled)" or similar.

---

**Issue P-6** | Severity: Low | Location: Prompt tab — Setting Sources section
**Description:** The section label "Setting Sources" and its subtitle "Select which configuration sources to include when using this profile" are functional but completely technical. A non-developer user doesn't think in terms of "configuration sources."
**Recommendation:** Rename to "Load additional settings from" or "Include settings from". The current heading sounds like a database concept, not a user preference.

---

**Issue P-7** | Severity: Low | Location: Prompt tab — general layout
**Description:** The lower half of the Prompt tab (below the Setting Sources section) is empty black space. On a 1920x1080 screen, roughly 40% of the tab area is wasted. This makes the page feel unfinished and suggests content might be missing.
**Recommendation:** If there's no additional content planned, either reduce the panel height or add contextual help content (e.g., prompt-writing tips, links to documentation, example prompts for code review).

---

### MODEL TAB

---

**Issue M-1** | Severity: Critical | Location: Model tab — entire tab
**Description:** The Model tab has only 3 controls (model dropdown, effort buttons, thinking budget slider) with ~60% of the panel area completely empty. This makes the tab feel unfinished and raises questions: Where is Temperature? Where is Max Tokens? Where is Top-P? These are standard model parameters that every other LLM tool exposes.
**Evidence (DOM inspection):** Confirmed only 3 interactive controls exist: one `<select>`, three effort `<button>` elements, one `<input type="range">`, and one `<input type="number">`.
**Recommendation:** Either add standard parameters (temperature, max output tokens, top-p, frequency penalty) or explicitly communicate that these are managed automatically per-model. The empty space implies missing features.

---

**Issue M-2** | Severity: High | Location: Model tab — model selector dropdown
**Description:** The model dropdown shows model IDs in parentheses: "Sonnet 4.6 (claude-sonnet-4-6)", "Opus 4.6 (claude-opus-4-6)", "Haiku 4.5 (claude-haiku-4-5-20251001)". The raw API model IDs (e.g., `claude-haiku-4-5-20251001`) are exposed to end users. Non-technical users don't know what these mean and they create visual clutter.
**Available options confirmed:** Default (use session model), Sonnet 4.6, Opus 4.6, Haiku 4.5.
**Recommendation:** Show only the friendly names in the dropdown label. The model ID can be shown as secondary text or in a tooltip. Also add brief descriptions: "Opus 4.6 — Most capable, slower", "Haiku 4.5 — Fastest, lightweight".

---

**Issue M-3** | Severity: High | Location: Model tab — Effort section
**Description:** "Effort" (Low/Medium/High) is an abstraction with no explanation of what it actually controls. The helper text says "Controls how much effort Claude puts into responses. Higher effort uses more tokens." This is vague. Does "effort" affect temperature? Max tokens? Number of reasoning steps? The relationship to "Thinking Budget Tokens" below it is completely unexplained — if I set Effort to High, does that change the token budget? Are they independent or linked?
**Recommendation:** Either (a) explain concretely what Low/Medium/High map to (e.g., "Low = fast mode, ~2K tokens; High = extended thinking, ~10K tokens"), or (b) link Effort and Thinking Budget Tokens visually so it's clear they're related. Currently they look like two separate unrelated settings.

---

**Issue M-4** | Severity: High | Location: Model tab — Thinking Budget Tokens
**Description:** "Thinking Budget Tokens" is developer jargon. A non-technical user does not know what "extended thinking" means, what a "token" is, or why 10,000 vs 50,000 matters. The slider range (1,000–100,000) with a step of 1,000 is very wide with no contextual markers (e.g., "Recommended for code review: 15,000").
**The aria-label is null** — the slider has no accessible name, which is also an accessibility violation.
**Recommendation:** Rename to "Reasoning depth" or "Extended thinking budget". Add markers or presets on the slider. Add a note like "Higher values allow more complex reasoning but cost more and take longer." Fix the missing aria-label for accessibility.

---

**Issue M-5** | Severity: Medium | Location: Model tab — Default option
**Description:** The default selection is "Default (use session model)". This is not a model name — it's a meta-option. A new user doesn't know what the "session model" is. The helper text says "Override the model used when this profile is active. Leave empty to use the session default." This creates a chicken-and-egg confusion: the session model is set at the bottom status bar (currently "Haiku 4.5"), but there's no visible link between the profile model override and the session model.
**Recommendation:** Show the current session model inline: "Default (currently: Haiku 4.5)" so users understand exactly what they'll get if they don't override.

---

**Issue M-6** | Severity: Low | Location: Model tab — Thinking Budget slider visual
**Description:** The slider thumb is positioned at roughly the 10% mark visually (10,000 out of 100,000) but appears as a white dot near the left edge of a grey track. There's no fill color on the active portion of the track, making it hard to read the current value at a glance. The numeric input field to the right provides the exact value but is disconnected visually from the slider.
**Recommendation:** Use a filled track (active portion in accent color) and ensure the number input and slider stay in visual sync with connecting layout treatment.

---

### TOOLS TAB

---

**Issue T-1** | Severity: Critical | Location: Tools tab — entire concept
**Description:** The Tools tab requires users to manually type tool names as raw strings ("Read", "Glob", "Grep", "Bash", "Write") into textareas. A non-technical user has NO IDEA what these are. There is no list of available tools to choose from, no descriptions of what each tool does, and no validation feedback if you type a tool name wrong.
**Example problem:** A user who wants their Code Reviewer to read files but not write them would need to know that "Read" and "Glob" and "Grep" are the correct tool names. If they type "read" (lowercase) or "FileRead" — does it work? There's no indication.
**Recommendation:** Replace raw text areas with a visual checklist of all available tools, each with a 1-line description (e.g., "Read — Read file contents", "Bash — Execute shell commands"). Optionally allow power users to toggle to raw text mode.

---

**Issue T-2** | Severity: Critical | Location: Tools tab — content clipped on right
**Description:** The Tools tab content is clipped — the right edge of both textareas is cut off by the viewport. The "Allowed Tools" and "Disallowed Tools" label text and textarea edges extend beyond the visible area. This is a layout overflow bug.
**Evidence:** In the screenshot, "Restrict the agent to only these tools. One tool name per line. Leave empty to allow..." is cut off at "allow" — the rest of the sentence is hidden.
**Recommendation:** Fix the panel layout to properly constrain content to the viewport width. The panel needs `max-width: 100%` or proper flex constraints.

---

**Issue T-3** | Severity: High | Location: Tools tab — Permission Mode dropdown
**Description:** Permission Mode has 4 options: "Default", "Plan", "Accept Edits", "Bypass Permissions". None of these are explained.
- What does "Plan" mode do?
- What does "Accept Edits" mean — does Claude auto-accept its own edits?
- "Bypass Permissions" sounds alarming — what does it bypass?
The only hint is the helper text "Ask for permission on risky operations" which only applies to "Default".
**Recommendation:** Add a helper text that changes dynamically based on the selected option. Each mode needs at minimum a one-line explanation shown below the dropdown when selected.

---

**Issue T-4** | Severity: High | Location: Tools tab — Allowed vs Disallowed concept
**Description:** Having both "Allowed Tools" AND "Disallowed Tools" is confusing. What happens if a tool appears in both lists? What if Allowed is empty — does that mean all tools are allowed, or no tools are allowed? The helper text for Allowed Tools says "Leave empty to allow all tools" which partially answers this, but the interaction between the two lists is undefined.
**Recommendation:** Make the logic explicit: add a note like "If Allowed Tools is not empty, only those tools are available. Disallowed Tools then further restricts from that set." Better yet, replace this with a single unified list with Allow/Block toggles per tool.

---

**Issue T-5** | Severity: High | Location: Tools tab — no tool discovery
**Description:** There is no way for a user to know what tools exist to type into these fields. The placeholder shows 3 examples (Read, Glob, Grep / Bash, Write) but these are clearly just examples, not an exhaustive list. There is no "browse available tools" button, no documentation link, no autocomplete.
**Recommendation:** Add an autocomplete/typeahead to the textareas that shows available tool names as the user types. Or add a "Browse tools" button that opens a panel with all available tools.

---

**Issue T-6** | Severity: Medium | Location: Tools tab — monospace font for tool names
**Description:** Both tool textareas use a monospace font (`ui-monospace, SFMono-Regular...`) which makes them look like code editors. While technically appropriate, this creates a cognitive barrier for non-technical users who may think this is a programming field requiring syntax they don't know.
**Recommendation:** If keeping text input, use a normal sans-serif font with a simple "one item per line" UX. If switching to checkboxes (recommended), font becomes irrelevant.

---

**Issue T-7** | Severity: Medium | Location: Tools tab — "tools" jargon not explained for non-technical users
**Description:** The entire Tools tab uses "tool" as a term without explaining what a tool is in the context of an AI agent. To a regular user, "tools" could mean anything. There's no onboarding text that says "Tools are capabilities Claude can use during a conversation — like reading files, running commands, or searching the web."
**Recommendation:** Add an introductory sentence at the top of the Tools tab: "Tools are actions Claude can perform during a conversation. Allowed Tools restricts Claude to only these capabilities. Disallowed Tools explicitly blocks specific capabilities."

---

## Cross-Tab Issues

---

**Issue X-1** | Severity: High | Location: All tabs — "Save" button behavior
**Description:** The Save button is disabled when there are no changes (correctly), but after switching tabs it shows as "unsaved" (orange dot) even when nothing was changed (see BUG-5 above). Additionally, there is no indication of when data was last saved. Users cannot tell if their changes were saved successfully.
**Recommendation:** Show a "Saved" timestamp or "All changes saved" confirmation after successful save. Use a green checkmark state on the Save button to indicate success.

---

**Issue X-2** | Severity: High | Location: All tabs — tab bar truncation
**Description:** With 8 tabs (General, Prompt, Model, Tools, Hooks, MCP, Sandbox, Advanced), the tab bar overflows on narrower windows. On an 800px-wide panel, "Advanced" is cut off or the scrolling is not obvious. There's no visual indication that more tabs exist off-screen.
**Recommendation:** Either (a) reduce the number of tabs by grouping related settings (Model + Tools could be "Behavior"), or (b) add visible scroll indicators (arrows) on the tab bar when it overflows, or (c) use a vertical sidebar tab layout that doesn't overflow.

---

**Issue X-3** | Severity: Medium | Location: All tabs — Delete button color
**Description:** The "Delete" button in the header is styled in red (`Delete` — prominent destructive red). This is visually correct for the action, but it's positioned directly next to the "Save" button with equal visual weight, making it easy to accidentally click. There's no confirmation dialog shown (testing observed immediate deletion attempts).
**Recommendation:** Either move Delete to a less prominent location (e.g., a "..." overflow menu), add a confirmation dialog ("Are you sure you want to delete 'Code Reviewer'? This cannot be undone."), or use a less prominent style (text link instead of button).

---

**Issue X-4** | Severity: Medium | Location: Agent Profiles sidebar
**Description:** The sidebar shows two "New Agent Profile" ghost entries created during normal tab navigation (due to BUG-1). These ghost entries use a robot emoji icon (🤖) which is different from the magnifying glass (🔍) that Code Reviewer uses. Users can't distinguish real profiles from ghosts.
**Recommendation:** Fix BUG-1. Until then, unsaved profiles should show with a clear "(unsaved)" tag and a lighter style to distinguish them from saved profiles.

---

## Positives

1. **Helper text exists for every section.** Each field and section has a small descriptive paragraph below it. This is good UX hygiene even if the text needs improvement.

2. **Effort buttons (Low/Medium/High) are clear UI.** The segmented button control for Effort is visually clean and easy to understand as a three-way selection. "Medium" being the default is a reasonable choice.

3. **Model dropdown has a "Default" option.** Allowing users to leave the model at the session default (rather than forcing an explicit selection) is good UX — it reduces required decisions.

4. **Textarea resize handle works correctly.** The System Prompt textarea supports vertical resizing (confirmed: `resize: vertical`), which is the right behavior for multi-line input.

5. **"Include Claude Code system prompt" checkbox is pre-checked.** This is a sensible default — most users would want the built-in behavior. It's good that the more capable state is the default rather than requiring an opt-in.

6. **Thinking Budget Tokens has both a slider AND a numeric input.** Having both controls is good UX: the slider for approximate adjustment, the number field for precise entry. They are visually adjacent which is correct.

7. **Tab bar is horizontally scrollable.** The tab bar uses `overflow-x-auto` and `scrollbar` CSS, so all 8 tabs are accessible even on narrower viewports. It's not obvious (no scroll arrows) but it works.

8. **Permission Mode dropdown defaults to "Default".** The safest mode is the default, which is correct security-first thinking.

9. **Disallowed Tools textarea has a clear example.** "Bash, Write" as placeholder examples are recognizable as potentially dangerous tools, which helps users understand the use case.

---

## Summary of Issue Counts

| Severity | Count |
|----------|-------|
| Critical bugs (data loss / crashes) | 3 |
| Critical UX | 3 |
| High | 10 |
| Medium | 6 |
| Low | 3 |
| **Total** | **25** |

---

## Most Critical Issue

**BUG-3 (Data Loss):** Tab navigation destroys saved profiles. The cascade of BUG-1 (phantom profile creation on tab click) + BUG-2 (silent auto-save validation failure) results in the original Code Reviewer profile being permanently deleted. This was reproduced multiple times during testing. A user performing completely normal navigation — clicking through tabs to configure their agent — can lose their profile with no warning and no recovery path.
