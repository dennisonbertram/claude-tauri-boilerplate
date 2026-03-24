# STORY-156: Settings Panel Access & Quick Open

**Type**: short
**Goal**: Verify settings panel is accessible
**Result**: PASS (with caveats)

## Steps Performed

### 1. Find and click the settings icon/gear in the sidebar
- The sidebar footer shows a user avatar ("?"), display name ("User"), and a gear icon button
- The gear icon is rendered using `@phosphor-icons/react` `Gear` component
- In collapsed sidebar mode, a dedicated `title="Settings"` gear button appears at the bottom
- In expanded sidebar mode, the entire user profile row and a small gear button trigger settings
- **Issue**: Direct click on the gear button via browser automation failed because the agentation browser extension's "Block page interactions" checkbox intercepted DOM events. Required using `document.dispatchEvent(new KeyboardEvent(...))` to trigger settings.

### 2. Verify settings panel opens
- Settings panel opens as a fixed right-side overlay (560px wide, z-50)
- A semi-transparent black overlay (z-40) covers the rest of the page
- Panel has a "Settings" heading and "Close settings" button with `aria-label`

### 3. Settings categories are visible and organized
Settings are organized into **5 tab groups**:
1. **General** (default selected)
   - General (API Key, Runtime Env, Preferred IDE)
   - Appearance
   - Notifications
2. **AI & Model**
   - Model
   - Advanced
   - Workflows
3. **Data & Context**
   - Instructions
   - Memory
   - MCP
   - Hooks
4. **Integrations**
   - Git
   - Linear
5. **Status**
   - Status

### 4. Screenshot taken
- `screenshots/05-settings-panel-visible.png` - Settings panel with General tab open

### 5. Close settings and return to previous view
- Close button (`data-testid="settings-close-button"`) works correctly
- Previous view ("What would you like to build?") restored after closing
- Overlay click also triggers close (onClick={onClose} on overlay div)

## Findings

| ID | Severity | Description |
|----|----------|-------------|
| F-156-001 | low | Gear button in sidebar footer has no `aria-label` or `title` attribute (only the collapsed-sidebar gear has `title="Settings"`). The expanded-sidebar gear at line 228 lacks accessibility attributes. |
| F-156-002 | info | Keyboard shortcut Cmd+, (Ctrl+,) works to open settings - standard macOS convention |
| F-156-003 | low | The two unlabeled buttons at top of sidebar (CaretLeft/CaretRight for back/forward navigation) have `opacity-50` and no title/aria-label, making their purpose unclear |

## Screenshots
- `01-initial-view.png` - App initial state
- `02-reloaded.png` - After reload
- `05-settings-panel-visible.png` - Settings panel open
- `06-settings-closed.png` - After closing settings
