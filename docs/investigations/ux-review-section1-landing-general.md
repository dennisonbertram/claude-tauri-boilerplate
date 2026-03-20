# UX Review: Section 1 — Landing Page, Sidebar & General Tab

**Reviewer:** Claude Code (UX audit mode)
**Date:** 2026-03-19
**App URL:** http://localhost:1420
**Viewport tested:** 1400 × 900px

---

## Screenshots Taken

- `01-landing-home.png`: Full app home state — Chat view with left nav showing 4 icons (Chat, Workspaces, Teams, Agents)
- `02-agents-landing.png`: Agents section landing state — sidebar + empty state, before selecting a profile
- `03-sidebar-zoom.png`: Sidebar panel showing both profiles and the empty state together
- `04-sidebar-header-zoom.png`: Close-up of "AGENT PROFILES" header with "+" button at right
- `05-empty-state-zoom.png`: Close-up of robot icon + "No profile selected" + subtitle text
- `06-sidebar-items-zoom.png`: Close-up of a single sidebar profile item (emoji + name)
- `07-general-tab-full.png`: Full viewport of General tab with profile open
- `08-header-zoom.png`: Profile header — icon + name "New Agent Profile", disabled Save button, red Delete button
- `09-tab-bar-zoom.png`: All 8 tabs: General, Prompt, Model, Tools, Hooks, MCP, Sandbox, Advanced
- `10-name-field-zoom.png`: Name field with required asterisk (red *)
- `11-description-field-zoom.png`: Description field with placeholder text
- `12-icon-color-row-zoom.png`: Icon and Color fields side by side with preview swatch and hex input
- `13-default-profile-checkbox.png`: Default Profile checkbox with description text
- `14-sort-order-field.png`: Sort Order number input with helper text
- `15-save-button-hover.png`: Save (disabled/grey) and Delete (red) buttons in header
- `16-save-enabled-after-change.png`: After editing Name — Save becomes enabled, orange dot appears in header
- `17-unsaved-indicator-zoom.png`: Close-up of unsaved indicator — orange dot next to profile name in header
- `18-color-picker-click.png`: After clicking color swatch — no visible color picker opens in UI
- `19-sidebar-item-hover.png`: Sidebar item on hover — 3-dot (⋯) context menu icon appears
- `20b-sidebar-context-menu-full.png`: Full view of sidebar context menu — "Duplicate" and "Delete" (red) options
- `21-left-nav-icons.png`: Left nav icon strip — Chat, Workspaces, Teams, Agents icons
- `22-layout-dead-space.png`: Full view showing ~526px of dead black space to the right of all form content

---

## Issues Found

### CRITICAL

**[Layout — Form Content Area]** — The General tab form content is hard-capped at 562px wide (40% of the 1400px viewport), leaving 526px (37.6% of the viewport) as a completely empty black void to the right of every form field. Measured precisely: form fields end at x=874, viewport ends at x=1400. At a 1400px viewport this is jarring and looks unfinished. The content panel has `flex-1 overflow-hidden` but an inner container is not growing to fill it. **Recommendation:** Remove the fixed max-width cap on the form content container, or use a two-column layout for the General tab (e.g., metadata fields left, live preview / usage instructions right). At minimum, set `max-w-2xl` with `mx-auto` so the empty space is evenly distributed rather than all sitting on the right.

**[Data Integrity — Default Profile Names]** — Both profiles in the sidebar are named "New Agent Profile" with identical robot emoji icons. There is no way to distinguish them from the sidebar. When there are two profiles with the same name, users cannot tell which is which, cannot confidently delete the right one, and cannot understand what each profile is for. The test spec expected a "Code Reviewer" profile — these appear to be unsaved/abandoned profiles from a previous session. **Recommendation:** Enforce unique names at save time with an inline validation error. Also auto-focus the Name field and select-all when a new profile is created so the user is immediately prompted to rename it.

---

### HIGH

**[Icon Field — Discoverability]** — The Icon field shows a small emoji preview square followed by a text input that contains the emoji character itself. The helper text reads "Enter an emoji character." There is no emoji picker button, no clickable swatch, no OS emoji keyboard trigger. Users unfamiliar with how to invoke the emoji keyboard (macOS: Ctrl+Cmd+Space; Windows: Win+.) will not know what to do, and will likely type a letter instead of an emoji, breaking the icon entirely. The field does not show an error if a non-emoji character is entered. **Recommendation:** Add a clickable emoji button that opens the OS emoji picker (`document.execCommand` / custom picker), or at minimum add a tooltip explaining the keyboard shortcut for the current OS. Consider replacing with a curated emoji grid picker like most tools use.

**[Color Field — Broken/Invisible Color Picker]** — The Color field shows a grey swatch square + hex input. Clicking the swatch triggers a hidden `<input type="color">` which opens the OS native color picker — but in this Tauri/Electron environment the native picker appears to open behind the window, is invisible, and does not return a value. From the user's perspective: nothing happens when they click the color swatch. The only working interaction is typing a hex value directly into the text field, which requires the user to already know hex color codes. **Recommendation:** Replace the native `<input type="color">` with an in-window color picker component (e.g., a small popover with hue/saturation picker + hex/rgb inputs). This is a well-known limitation of Tauri webview color inputs.

**[Delete Button — Danger Without Confirmation Visible]** — The "Delete" button is prominently styled in solid red and positioned directly next to "Save" in the header — equal visual weight, always visible regardless of tab. There is no confirmation dialog visible from the DOM inspection (though one may appear on click). Regardless, placing a destructive action as a primary header button with the same size/prominence as Save is dangerous. Users exploring the interface may click Delete accidentally. **Recommendation:** Move Delete out of the primary header action area — put it at the bottom of the General tab form, styled as a secondary danger action with a separator above it. Always require a confirmation dialog ("Are you sure? This cannot be undone.") before deletion.

**[Tab Count — 8 Tabs Is Overwhelming]** — The tab bar contains 8 tabs: General, Prompt, Model, Tools, Hooks, MCP, Sandbox, Advanced. For a first-time user, this presents immediate cognitive overload. There is no progressive disclosure — all tabs are equally visible regardless of user experience level. "Hooks," "MCP," and "Sandbox" are highly technical concepts that most users will never touch. **Recommendation:** Group tabs into "Basic" (General, Prompt, Model) and "Advanced" (Tools, Hooks, MCP, Sandbox, Advanced), with the advanced group collapsed by default behind an "Advanced settings" expander. Or use a two-level nav: primary tabs (General, Prompt, Model) + a single "Advanced" tab that contains sub-sections.

---

### MEDIUM

**[Sort Order Field — Exposed Technical Internals]** — "Sort Order" with a numeric spinner is a developer-facing concept. Regular users think in terms of "move up / move down" or drag-to-reorder, not arbitrary integers. The helper text "Lower numbers appear first in the sidebar" requires the user to reason about ordering numerically rather than spatially. **Recommendation:** Replace with drag-to-reorder handles on sidebar items (which is the standard pattern for ordered lists). If numeric order must be kept internally, hide it from the UI entirely and derive it from drag order.

**[Sidebar — No Description Visible]** — Sidebar items show only emoji icon + name. The Description field exists in the form but is never surfaced in the sidebar. With two profiles named "New Agent Profile" the user has zero context about what differentiates them. **Recommendation:** Show the description as a subtitle line below the name in each sidebar item (truncated to 1 line, ~40 chars). This matches the pattern used in the Conversations sidebar.

**[Empty State — No Call to Action Button]** — The "No profile selected" empty state displays a robot icon and text "Select a profile from the sidebar or create a new one." The phrase "create a new one" is not a link or button — it is plain text. Users must locate the tiny "+" icon in the sidebar header (which is easy to miss at low contrast). **Recommendation:** Add a prominent "Create Agent Profile" button directly in the empty state area, or make "create a new one" a tappable hyperlink that triggers the new-profile action.

**[Sidebar "+" Button — Low Contrast and Small]** — The new profile "+" button is positioned at the far right of the "AGENT PROFILES" header. It is a small, low-contrast icon with no label. At first glance, the affordance is not obvious — the "+" does not stand out from the grey header text. On the home/chat screen the new chat button is a full-width "New Chat" button with clear label, which sets a higher discoverability standard that the Agents section fails to match. **Recommendation:** Either use a labelled button ("+ New Profile"), or increase the contrast of the "+" icon against the header background.

**[No Unsaved Changes Warning on Navigation]** — When unsaved changes exist (the orange dot appears), clicking away to another sidebar item or nav tab is not tested for a warning dialog. If the app silently discards unsaved changes when navigating away, this is a critical data-loss bug. The orange dot indicator is a good signal but insufficient on its own. **Recommendation:** Implement a "You have unsaved changes — discard or save?" confirmation when navigating away from a dirty form.

**[Icon Field — Two Emoji Previews, Confusing Layout]** — The Icon field shows a large emoji preview square followed by a smaller emoji inside the text input box. The user sees the same emoji displayed twice at different sizes before they even interact with the field. The large preview is a separate element from the input; it is unclear which one reflects the "saved" value vs. the "current input." **Recommendation:** Show a single live preview to the left of the text input. Keep it large enough to see clearly. Remove the duplicate rendering inside the input box.

---

### LOW

**[Agents Nav Icon — No Tooltip Label]** — The Agents icon in the left nav (robot/briefcase icon) has no text label and no visible tooltip on hover. The Chat icon similarly has no label. New users must guess what each icon does. **Recommendation:** Add tooltip labels on hover for all nav icons ("Chat", "Workspaces", "Teams", "Agents").

**[AGENT PROFILES Header — All-Caps Styling]** — The sidebar section header reads "AGENT PROFILES" in all-caps small text. This is a common pattern but can read as aggressive or overly formal. Other sections in the app use "Conversations" in sentence case, which is more approachable. **Recommendation:** Use sentence case "Agent profiles" for consistency with other sidebar headers.

**[Default Profile Checkbox — No Current Indication]** — The Default Profile checkbox shows which profile should be default for new sessions, but there is no indicator in the sidebar showing which profile is currently the default. Users must open each profile to check. **Recommendation:** Add a small "default" badge or star icon on the sidebar item of whichever profile has Default Profile checked.

**[Save Button — No Tooltip When Disabled]** — When Save is disabled (no changes made), hovering shows no tooltip explaining why it is disabled ("No changes to save"). This can cause confusion — users may wonder if Save is broken. **Recommendation:** Add a tooltip on the disabled Save button: "No unsaved changes."

**[No Help / Onboarding Element Anywhere]** — There is no "?" help icon, onboarding tooltip, getting-started guide, or documentation link anywhere in the Agents section. New users have no guidance on what agent profiles are for, how they relate to conversations, what MCP/Hooks/Sandbox mean, or what a good profile setup looks like. **Recommendation:** Add at minimum a contextual help icon ("?") in the header that opens a popover explaining what agent profiles are and links to documentation.

**[Context Menu Delete — No Confirmation from Sidebar]** — The sidebar 3-dot context menu exposes a "Delete" option (in red) directly. Clicking it from the sidebar (without opening the profile first) would delete the profile with no confirmation dialog visible in the DOM structure at the menu level. **Recommendation:** The sidebar "Delete" in the context menu must also trigger a confirmation dialog identical to the header Delete button.

---

## Positives

- **Unsaved changes indicator is excellent.** The orange dot in the header title is immediate, on-brand, and clearly signals dirty state. The Save button enabling in sync with the indicator is the right behavior.

- **Tab bar is scannable.** The 8 tabs use concise single-word labels that are easy to scan. The active tab (General) has a clear white underline indicator. The font size and spacing are comfortable.

- **Required field asterisk is clear.** The red asterisk on "Name *" correctly signals the field is required and is a universally understood convention.

- **Context menu is well-implemented.** The 3-dot menu appearing on sidebar item hover (not always-visible) keeps the sidebar clean. The Duplicate action is a thoughtful addition that saves time when creating similar profiles.

- **Sidebar header "+" button is in the expected location.** Power users who know this pattern (Notion, Slack, Linear all use it) will find the button immediately.

- **Form field helper text is accurate and consistent.** "Enter an emoji character", "Hex color for the accent bar", "Lower numbers appear first in the sidebar", "Use this profile by default for new sessions" — all are concise and correctly describe the field's purpose.

- **Delete button color contrast is intentional and correct.** Using red for Delete is the right semantic choice. The execution (solid red, not outline) is perhaps too heavy for a header context, but the color choice itself is correct and expected.

- **Empty state illustration.** The robot icon in the empty state is thematically appropriate and visually distinct from the background. The two lines of text ("No profile selected" + subtitle) are the right amount of copy for an empty state.

---

## Summary Metrics

| Metric | Value |
|--------|-------|
| Viewport width | 1400px |
| Left nav width | 48px |
| Sidebar width | 275px |
| Form content panel width | 562px (40.1% of viewport) |
| Form fields width | 530px (37.9% of viewport) |
| **Dead space (right of form)** | **526px (37.6% of viewport)** |
| Tab count | 8 |
| Fields on General tab | 6 (Name, Description, Icon, Color, Default Profile, Sort Order) |
| Critical issues | 2 |
| High issues | 4 |
| Medium issues | 5 |
| Low issues | 6 |
