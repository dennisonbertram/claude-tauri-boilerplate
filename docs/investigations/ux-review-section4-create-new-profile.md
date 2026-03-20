# UX Review: Section 4 - Create New Profile Flow

**Date:** 2026-03-19
**Reviewer:** Claude Code (exhaustive Playwright-driven UX testing)
**App:** http://localhost:1420 — Agent Profiles section

---

## Screenshots Taken

All screenshots saved to `docs/investigations/screenshots/`:

| # | Filename | What It Shows |
|---|----------|---------------|
| 01 | `01-initial-load.png` | App initial load — Chat view |
| 02 | `02-agents-section-initial.png` | Agents section with empty state + Code Reviewer profile |
| 03 | `03-agents-header-zoom.png` | Sidebar header zoom showing "AGENT PROFILES" + "+" button |
| 04 | `04-new-profile-button-zoom.png` | Clipped header region |
| 05 | `05-after-new-profile-click.png` | State after clicking "+" — opens on Prompt tab, not General |
| 06 | `06-general-tab-existing-profile.png` | General tab on existing Code Reviewer profile |
| 07 | `07-new-profile-in-sidebar-not-selected.png` | New profile created in sidebar but NOT auto-selected |
| 08–11 | Selection bug series | Various screenshots showing Code Reviewer data shown when New Profile clicked |
| 12 | `12-code-reviewer-selected.png` | Clicking Code Reviewer shows "Confirm Delete" stuck state |
| 13 | `13-confirm-delete-state.png` | "Confirm Delete" persists after Escape |
| 14 | `14-general-tab-unsaved-state.png` | Unsaved changes orange dot + Confirm Delete stuck |
| 15 | `15-new-profile-vanished-on-tab-click.png` | New profile disappears from sidebar on tab navigation |
| 16 | `16-new-profile-created-not-selected-again.png` | Second attempt: same auto-select failure |
| 17–18 | `17/18-new-profile-general-tab-correct.png` | Snapshot shows new profile but screenshot shows nothing |
| 19 | `19-code-reviewer-general.png` | Clicking Code Reviewer opens Sandbox tab (wrong) |
| 20 | `20-code-reviewer-general-tab.png` | General tab — all fields visible, correct |
| 21 | `21-icon-color-fields-zoom.png` | Icon + Color fields cropped zoom |
| 22 | `22-name-desc-fields-zoom.png` | Name + Description fields zoomed |
| 23 | `23-name-cleared.png` | Name field cleared — "Untitled Profile" in header |
| 24 | `24-save-empty-name-validation.png` | Save with empty name — no visible error, silent failure |
| 25 | `25-fields-filled-in.png` | Fields filled including icon — emoji substitution bug |
| 26 | `26-all-profiles-deleted-catastrophic.png` | ALL profiles deleted — "No agent profiles yet" |

---

## Issues Found

### CRITICAL — Data Loss / Destructive Bugs

---

#### CRITICAL-1: "Confirm Delete" Has No Cancel, No Timeout, No Escape Dismissal

**Severity:** Critical
**Location:** Agent profile editor header — Delete button
**Screenshot:** `12-code-reviewer-selected.png`, `13-confirm-delete-state.png`, `14-general-tab-unsaved-state.png`

**Description:**
When the Delete button is clicked (even accidentally), it switches to a "Confirm Delete" state. There is:
- No "Cancel" button to dismiss it
- No timeout to auto-reset it
- No Escape key to dismiss it
- No click-outside-to-dismiss behavior

The "Confirm Delete" state **persists indefinitely** across tab switches, profile navigation, and other interactions. This means a user can accidentally hover over Delete, click elsewhere, come back later, and unknowingly delete their profile.

During testing, this stuck state caused the `Code Reviewer` (and eventually ALL) profiles to be deleted because the confirmation remained live while other UI interactions occurred.

**Recommendation:**
- Add a "Cancel" button next to "Confirm Delete"
- Auto-reset after 3–5 seconds if no confirmation received
- Dismiss on Escape key or any click outside the button group
- Consider using a modal dialog instead of inline confirmation

---

#### CRITICAL-2: New Profile Is NOT Auto-Selected After Creation

**Severity:** Critical
**Location:** "+" (New agent profile) button
**Screenshot:** `07-new-profile-in-sidebar-not-selected.png`, `16-new-profile-created-not-selected-again.png`

**Description:**
Clicking the "+" button creates a new profile entry in the sidebar but **does not select or navigate to it**. The main content panel continues to show "No profile selected" (or the previously selected profile's content). A new user clicking "+" would have no idea anything happened — the new profile appears in the sidebar but the editor stays blank.

Confirmed reproducible on multiple attempts.

**Recommendation:**
After creating a new profile, immediately select it and focus the Name field so the user can begin editing. This is standard behavior for all list+detail UIs (VS Code, Xcode, etc.).

---

#### CRITICAL-3: Unsaved New Profile Is Silently Discarded on Navigation

**Severity:** Critical
**Location:** New (unsaved) profile — any navigation away
**Screenshot:** `15-new-profile-vanished-on-tab-click.png`

**Description:**
A newly created, unsaved profile is **silently discarded** when the user clicks any tab (General, Prompt, etc.) while a different profile is the "active" one in the editor. There is:
- No warning dialog ("You have unsaved changes — discard?")
- No auto-save
- No recovery mechanism

During testing, clicking the General tab while the new profile appeared selected caused it to disappear from the sidebar entirely, with zero user feedback.

**Recommendation:**
- Show a "Unsaved changes — Save or Discard?" dialog when navigating away from an unsaved new profile
- Or: immediately persist the new profile as a draft on creation (as a record with defaults), then let the user edit and save

---

#### CRITICAL-4: All Profiles Deleted — No Undo Available

**Severity:** Critical
**Location:** Delete flow
**Screenshot:** `26-all-profiles-deleted-catastrophic.png`

**Description:**
Due to the combination of CRITICAL-1 (Confirm Delete stuck state) and normal UI interaction, **all agent profiles were permanently deleted** during a single test session. The sidebar showed "No agent profiles yet" with no recovery option.

There is no:
- Undo (Cmd+Z) support
- Trash/recycle functionality
- Confirmation modal with profile name shown

**Recommendation:**
- Show a confirmation modal that names the profile being deleted: "Delete 'Code Reviewer'? This cannot be undone."
- Implement a soft-delete / trash mechanism with a recovery window
- Never let a single click + environmental state cause permanent data loss

---

### HIGH — Core Flow Broken

---

#### HIGH-1: New Profile Opens on Prompt Tab Instead of General

**Severity:** High
**Location:** After clicking sidebar item to select the new profile
**Screenshot:** `05-after-new-profile-click.png`

**Description:**
When a new profile is created and then selected from the sidebar, it opens on the **Prompt tab** instead of the **General tab**. The General tab is where the user must go first to set the profile name — the most critical first step. A new user will land on a system prompt textarea without knowing they need to name their profile first.

**Recommendation:**
Always open a new (unsaved) profile on the General tab with the Name field auto-focused. This is the logical entry point.

---

#### HIGH-2: Silent Save Failure — No Error Message on Empty Name

**Severity:** High
**Location:** General tab — Save button with empty Name field
**Screenshot:** `24-save-empty-name-validation.png`

**Description:**
Clicking Save with an empty name field produces **no visible error message**. Specifically:
- No inline error under the Name field (e.g., "Name is required")
- No toast notification
- No field border highlight in red
- No focus return to the Name field

The only indication of failure is: (a) the app silently switches to the Prompt tab, and (b) a console error `Failed to save profile: Error: Validation` appears (invisible to users). The Save button is NOT disabled when the name is empty — it is enabled, allowing the attempt.

**Recommendation:**
- Disable the Save button when Name is empty, OR
- Show an inline validation error below the Name field immediately ("Name is required")
- On save failure: show a toast, highlight the problematic field, scroll to it, and focus it

---

#### HIGH-3: Clicking Sidebar Profile Restores Last-Viewed Tab, Not General

**Severity:** High
**Location:** Sidebar profile selection
**Screenshot:** `19-code-reviewer-general.png` (shows Sandbox tab opened on click)

**Description:**
When clicking a profile in the sidebar to select it, the app restores whichever tab was last active for that profile. This means clicking Code Reviewer could open it on Hooks, Sandbox, or any other tab — not General. A user who hasn't used the app in a while will be dropped into an arbitrary tab with no context.

**Recommendation:**
Always navigate to the General tab when selecting a profile from the sidebar, or at minimum, make the behavior predictable and documented. Current behavior is disorienting.

---

#### HIGH-4: Tab active/selected Attributes Out of Sync (Rendering Bug)

**Severity:** High
**Location:** Tablist in profile editor
**Screenshot:** (observable in snapshot output — tab shows `Sandbox [active]` but `Prompt [selected]`)

**Description:**
The accessibility tree showed `tab "Sandbox" [active]` and `tab "Prompt" [selected]` simultaneously — two different tabs indicating different visual vs. semantic state. This means:
- The CSS highlight (`active`) says Sandbox
- The ARIA selection (`selected`) says Prompt
- The rendered content shows Prompt

This is a React state management bug causing split-brain tab state. It produces confusing and unpredictable navigation behavior.

**Recommendation:**
Ensure tab selection, tab active state, and rendered content are all driven from a single source of truth. Likely a `useState` or `useEffect` dependency issue.

---

### MEDIUM — Usability Issues

---

#### MEDIUM-1: Icon Field Placeholder is Wrong Default

**Severity:** Medium
**Location:** General tab — Icon field
**Screenshot:** `23-name-cleared.png`

**Description:**
The Icon text input has placeholder text `🤖` and hint "Enter an emoji character". There is no emoji picker — the user must know to type or paste an emoji directly. Most users will not know this interaction model. The placeholder `🤖` looks like the actual current value, not instructional text, which is confusing.

Additionally, when a multi-byte emoji (`🧪`) is typed into the field, it renders differently (appears as a green mark/pencil `✏️`-like rendering) — suggesting emoji input handling may not support all emoji categories correctly.

**Recommendation:**
- Add an emoji picker button (standard OS emoji panel trigger)
- Change the placeholder to instructional text like "Enter emoji (e.g. 🤖)"
- Validate and normalize emoji input to ensure consistent rendering

---

#### MEDIUM-2: Name Field Placeholder Text Is Not Instructional

**Severity:** Medium
**Location:** General tab — Name field
**Screenshot:** `23-name-cleared.png`

**Description:**
The Name field placeholder is "My Agent Profile" — this looks like a template name rather than instructional placeholder text. A new user might think the field already has a value. Standard UX practice is to use instructional placeholder text like "Enter a profile name..." or just use a floating label.

**Recommendation:**
Change placeholder to "Enter profile name..." or similar instructional text.

---

#### MEDIUM-3: Color Field UX is Unclear

**Severity:** Medium
**Location:** General tab — Color field
**Screenshot:** `20-code-reviewer-general-tab.png`, `21-icon-color-fields-zoom.png`

**Description:**
The Color field has two components: a colored swatch square and a hex value text input. The swatch has `cursor=pointer` indicating it should be clickable, but:
- It's not obvious the swatch is clickable (no affordance, no border, no hover label)
- No color picker opens (tested — the field just takes raw hex input)
- The placeholder `#6b7280` (gray) doesn't indicate what the color applies to until the help text "Hex color for the accent bar" is read

**Recommendation:**
- Make the swatch open a native `<input type="color">` picker
- Add visible hover state to the swatch (cursor pointer + subtle border)
- Consider a preset palette for quick selection

---

#### MEDIUM-4: Sort Order Field Is Confusing for New Users

**Severity:** Medium
**Location:** General tab — Sort Order field
**Screenshot:** `20-code-reviewer-general-tab.png`

**Description:**
The Sort Order is a numeric spinner field. New users will not understand what this means or why they need to set a number. The help text "Lower numbers appear first in the sidebar" helps, but a numeric sort order is an implementation detail that should be abstracted. Most apps offer drag-and-drop reordering instead.

There is also no drag-to-reorder affordance in the sidebar at all — no drag handles, no visual cue.

**Recommendation:**
- Replace numeric Sort Order with drag-and-drop reordering in the sidebar
- If keeping numeric: pre-populate with a sensible default (e.g., highest existing + 1) so new profiles appear at the bottom by default, not in position 0 which conflicts with all other profiles

---

#### MEDIUM-5: Unsaved Changes State Visible in Header But Not Sidebar

**Severity:** Medium
**Location:** Profile editor header
**Screenshot:** `23-name-cleared.png`

**Description:**
When a profile has unsaved changes, an orange dot appears next to the profile name in the header. However, the **sidebar item does not show this unsaved indicator**. A user looking at the sidebar cannot tell which profile has pending changes.

**Recommendation:**
Mirror the unsaved indicator (orange dot or asterisk) on the sidebar list item.

---

#### MEDIUM-6: Sidebar Has No Search/Filter

**Severity:** Medium
**Location:** Agent Profiles sidebar
**Screenshot:** `02-agents-section-initial.png`

**Description:**
There is no search or filter input for the profiles list. With more than ~10 profiles this will become difficult to navigate. Contrast with the Conversations sidebar which has a "Search sessions" field.

**Recommendation:**
Add a search/filter input to the Agent Profiles sidebar, consistent with the Conversations panel.

---

#### MEDIUM-7: No Context Menu on Right-Click or Long-Press

**Severity:** Medium
**Location:** Sidebar profile items

**Description:**
Right-clicking a profile item in the sidebar produces no context menu. Users would reasonably expect options like: Edit, Duplicate, Delete, Set as Default. The only delete mechanism is the "Delete" button inside the editor, making deletion a multi-step process that requires first selecting the profile.

**Recommendation:**
Add a right-click context menu with: Edit (select), Duplicate, Delete, Set as Default.

---

#### MEDIUM-8: "..." Menu Appears Inconsistently on Sidebar Items

**Severity:** Medium
**Location:** Sidebar profile items on hover

**Description:**
A small button appeared inside the sidebar item for "New Agent Profile" during testing (ref `e1171` / `e1296`) — a "..." or icon button — but it was not visible on Code Reviewer consistently and the behavior was unreliable. The hover-reveal pattern for action buttons is used inconsistently.

**Recommendation:**
Make the "..." action menu consistently visible on hover for ALL profile items, with a clear affordance.

---

### LOW — Polish Issues

---

#### LOW-1: "AGENT PROFILES" Header Is All-Caps While Other Sections Use Title Case

**Severity:** Low
**Location:** Agent Profiles sidebar header
**Screenshot:** `02-agents-section-initial.png`

**Description:**
The sidebar header reads "AGENT PROFILES" in all-caps. Other sidebars (e.g., Conversations) use mixed-case. Inconsistent typographic treatment.

**Recommendation:**
Standardize to "Agent Profiles" to match app-wide convention.

---

#### LOW-2: Empty State Has No CTA Button

**Severity:** Low
**Location:** Main content panel — "No profile selected" state
**Screenshot:** `02-agents-section-initial.png`

**Description:**
The empty state shows: robot icon, "No profile selected", "Select a profile from the sidebar or create a new one". There is no action button (e.g., "Create New Profile") in the empty state itself. The user must look elsewhere for the "+" button in the sidebar header.

**Recommendation:**
Add a "Create New Profile" button directly in the empty state to reduce friction.

---

#### LOW-3: Delete Button Uses Destructive Red in the Same Visual Weight as Save

**Severity:** Low
**Location:** Profile editor header
**Screenshot:** `20-code-reviewer-general-tab.png`

**Description:**
The Save (neutral) and Delete (red) buttons are the same size and sit side by side. The red Delete button draws more visual attention than the primary action Save. This inverted visual hierarchy increases risk of accidental deletion.

**Recommendation:**
- Make Save the primary (filled/prominent) button and Delete a ghost or link-style button
- Or move Delete to a less prominent location (e.g., bottom of the form, or inside a "..." menu)

---

#### LOW-4: No Success Feedback After Save

**Severity:** Low
**Location:** Save button

**Description:**
During testing, saving a profile produced no visible success feedback — no toast ("Profile saved"), no button state change (no brief "Saved ✓" label), no animation. The sidebar item does update, but there is no acknowledgment to the user that the save succeeded.

**Recommendation:**
Show a brief success toast or transient "Saved" state on the button after a successful save.

---

#### LOW-5: No Keyboard Shortcut for Save

**Severity:** Low
**Location:** Profile editor

**Description:**
There is no Cmd+S / Ctrl+S keyboard shortcut to save the profile. Users familiar with form-based editors expect this.

**Recommendation:**
Bind Cmd+S (macOS) / Ctrl+S (Windows/Linux) to the Save action in the profile editor.

---

#### LOW-6: Profile Name in Sidebar Does Not Truncate Gracefully

**Severity:** Low
**Location:** Sidebar profile list items

**Description:**
Not tested with a very long name due to the profile deletion incidents, but the sidebar item layout has a fixed width (~246px) with no visible ellipsis style applied. Long names would likely overflow or wrap awkwardly.

**Recommendation:**
Apply `text-overflow: ellipsis` with `overflow: hidden; white-space: nowrap` to profile name in sidebar item.

---

## Positives

1. **Live Header Update**: The profile editor header updates in real-time as you type the name (shows "Untitled Profile" when cleared, shows typed name instantly). Good reactive feedback.

2. **Unsaved Changes Indicator**: The orange dot on the header title correctly reflects whether there are pending changes. Clear visual signal.

3. **Tab Organization**: The 8-tab structure (General, Prompt, Model, Tools, Hooks, MCP, Sandbox, Advanced) is logically organized and covers a comprehensive feature set.

4. **Icon Preview**: The Icon field shows a live preview of the selected emoji both in the field and the editor header. Good immediate feedback.

5. **Save Button Disabled on Clean State**: When a profile has no changes, the Save button is correctly disabled, preventing unnecessary saves.

6. **Setting Sources Checkboxes**: The Prompt tab has well-labeled checkboxes for configuration source inclusion with clear descriptions — good UX for a technical feature.

7. **Sort Order Help Text**: "Lower numbers appear first in the sidebar" is a clear, concise explanation of a non-obvious field.

8. **Profile Description Shown in Sidebar**: The sidebar shows both the profile name and its description (e.g., "Reviews code for quality"), giving useful at-a-glance context without clicking.

9. **"+" Button Visible**: The new profile button (+) is visible in the sidebar header (top-right of the Agent Profiles panel) without requiring hover. Reasonably discoverable.

10. **Tab bar coverage**: All 8 tabs (General, Prompt, Model, Tools, Hooks, MCP, Sandbox, Advanced) are visible without scrolling on standard viewport sizes.

---

## Summary of Most Critical Issues

In order of severity:

| # | Issue | Impact |
|---|-------|--------|
| 1 | Confirm Delete has no cancel/timeout — causes permanent data loss | **Data loss** |
| 2 | New profile not auto-selected after creation — core flow broken | **Core flow** |
| 3 | New unsaved profile silently discarded on navigation | **Data loss** |
| 4 | Silent save failure with no error message | **Core flow** |
| 5 | Tab active/selected state out of sync | **Rendering bug** |

The most impactful single issue for a new user is **CRITICAL-2**: clicking "+" creates a profile but shows nothing — the user has no idea the creation succeeded or what to do next. Combined with **CRITICAL-1** (Confirm Delete has no cancel), a new user exploring the UI can accidentally destroy all their work with no recovery path.
