# UX Stories: Navigation and Surface Switching

Topic: Navigation and surface switching  
Focus: orientation, mode changes, and repeated entry points

## NAV-01: Understand the app from the sidebar alone

**Type**: short  
**Topic**: Navigation and surface switching  
**Persona**: First-time user learning the product map  
**Goal**: Build a mental model of the app from the primary navigation  
**Preconditions**: Sidebar is expanded

### Steps
1. Read the sidebar actions and destinations: New Chat, Search, Documents, Projects, Agent Profiles, Teams, Finance, Settings.
2. Notice that chat sessions and project trees appear conditionally depending on the active view.
3. Decide whether the sidebar behaves like one unified product map or multiple sidebars sharing the same frame.
4. Record where the labels are clear and where they assume prior product knowledge.

### Variations
- The user starts from recents in chat mode.
- The user starts from projects and does not immediately realize chat has its own secondary content below the nav.

### Edge Cases
- Mixed navigation and contextual content can make the sidebar feel different every time the main view changes.

## NAV-02: Jump from chat recents to projects without losing orientation

**Type**: medium  
**Topic**: Navigation and surface switching  
**Persona**: Returning user balancing multiple tasks  
**Goal**: Move between conversation history and project work without context whiplash  
**Preconditions**: Existing chat sessions and at least one project are present

### Steps
1. Review recents in the chat sidebar and select a session.
2. Switch to Projects from the main nav.
3. Observe the sidebar transform from recents into a project/workspace structure.
4. Decide whether the app communicates that only the lower portion changed while the main navigation stayed stable.
5. Switch back to chat and verify whether the previous session context is still easy to recover.

### Variations
- The user has many sessions and many workspaces.
- The user expects tabs or breadcrumbs instead of context-dependent sidebar contents.

### Edge Cases
- Contextual sidebars are efficient but can feel like a mode switch rather than a simple navigation change.

## NAV-03: Use collapsed-sidebar mode and stay confident

**Type**: medium  
**Topic**: Navigation and surface switching  
**Persona**: Laptop user working in a constrained layout  
**Goal**: Keep access to navigation without losing recognition  
**Preconditions**: Sidebar can be toggled collapsed

### Steps
1. Collapse the sidebar to icon-only mode.
2. Identify the available actions from icons and hover titles alone.
3. Trigger search and settings from collapsed mode.
4. Navigate between at least two surfaces and note whether icon-only mode increases cognitive load.
5. Re-expand and compare confidence before and after.

### Variations
- The user already knows the icons well.
- The user is still learning and relies heavily on labels.

### Edge Cases
- Collapsed mode saves space but may hide the app’s IA complexity until the user opens each surface.

## NAV-04: Find settings from multiple entry points and know why each exists

**Type**: short  
**Topic**: Navigation and surface switching  
**Persona**: User noticing repeated controls  
**Goal**: Understand why settings can be opened from more than one place  
**Preconditions**: App is open with sidebar and status surfaces visible

### Steps
1. Open settings from the sidebar footer.
2. Close settings and use another settings-related entry point such as a status action.
3. Compare whether both paths feel like shortcuts to one destination or like separate configuration surfaces.
4. Decide whether the product distinguishes navigation convenience from configuration duplication.

### Variations
- The user enters settings to inspect status, not to edit values.
- The user enters settings after seeing a runtime state they want to change.

### Edge Cases
- Repeated entry points are helpful only if the user can tell they lead to the same source of truth.
