# Minimap Toggle Implementation

**File modified:** `apps/desktop/src/components/chat/MessageList.tsx`

## Changes Made

### 1. Added `PanelRight` to lucide-react imports
Added `PanelRight` to the existing lucide-react import block (line 32).

### 2. Added `minimapOpen` state
Added `const [minimapOpen, setMinimapOpen] = useState(true)` alongside the other `useState` calls in `MessageList` (line 268). Defaults to open (`true`) so existing behaviour is preserved on first load.

### 3. Added toggle button
Inserted a small 20x20px icon button (`PanelRight`, h-3 w-3) that appears when `conversationTurns.length >= 3`. It is positioned `absolute right-0 top-2 z-20` with a left-rounded border, floating just above the minimap strip. Clicking it calls `setMinimapOpen(prev => !prev)`. Title attribute reads "Hide outline" / "Show outline" for accessibility.

### 4. Updated ConversationMinimap render condition
Changed `{showMinimap && ...}` to `{showMinimap && minimapOpen && ...}` so the minimap respects the toggle state.

### 5. Narrowed ConversationMinimap width
Changed the container class from `w-7` (28px) to `w-5` (20px) to reduce visual weight without altering any internal layout or logic.

## Unchanged
- All `ConversationMinimap` props and internal logic are untouched.
- The `showMinimap` derived constant (`conversationTurns.length >= 3`) is unchanged.
- `useState` was already imported; no new import was needed beyond `PanelRight`.
