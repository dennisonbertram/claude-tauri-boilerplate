# STORY-157: Quit Confirmation for Running Agents

**Type**: short
**Goal**: Verify quit/close confirmation exists (or note its absence)
**Result**: PARTIAL PASS

## Steps Performed

### 1. Check beforeunload handling (web browser version)
- **Found**: `App.tsx` line 57 registers a `beforeunload` event handler
- The handler only triggers when `subagentActiveCountRef.current > 0` (i.e., when agents are actively running)
- When triggered, it calls `e.preventDefault()` and sets `e.returnValue = ''`, which is the standard browser pattern to show a "Leave site?" confirmation dialog
- This means: if an agent is running and the user tries to close/reload the browser tab, the browser will show a confirmation dialog

### 2. Check for quit/close button or menu item
- No explicit "Quit" or "Close" button exists in the web UI
- No custom quit confirmation dialog is implemented
- The app relies entirely on the browser's built-in `beforeunload` confirmation

### 3. Check Tauri-specific close handling
- **No Tauri-specific close handling found**
- `lib.rs` has a minimal Tauri setup with no `on_window_event` handler for `CloseRequested`
- No `close_requested` or window close event handler in the Rust code
- The `tauri.conf.json` has no close-related configuration
- **This means**: In the Tauri desktop app, closing the window while agents are running would NOT show a confirmation (the `beforeunload` event is not reliably fired in Tauri webviews)

### 4. Summary
- **Web browser**: Quit confirmation works conditionally (only when agents are running)
- **Tauri desktop**: No quit confirmation exists - this is a gap

## Findings

| ID | Severity | Description |
|----|----------|-------------|
| F-157-001 | medium | No Tauri-specific close confirmation for running agents. The `beforeunload` web handler exists but Tauri webviews don't reliably fire this event. A Tauri `on_window_event(CloseRequested)` handler is needed. |
| F-157-002 | low | No visible quit/close button in the UI. Users must use browser tab close or Tauri window controls. |
| F-157-003 | info | The `beforeunload` handler correctly conditions on `subagentActiveCountRef.current > 0`, avoiding unnecessary confirmation dialogs when no agents are running. |

## Screenshots
- `01-main-view.png` - Main app view (no quit button visible in UI)
