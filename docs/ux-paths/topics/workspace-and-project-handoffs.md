# UX Stories: Workspace and Project Handoffs

Topic: Workspace and project handoffs  
Focus: context continuity, scope clarity, and escalation from chat to code work

## WS-01: Pick a project from the welcome screen before chatting

**Type**: medium  
**Topic**: Workspace and project handoffs  
**Persona**: Developer who wants scoped context but not a workspace yet  
**Goal**: Start a conversation that is project-aware without overcommitting to a code-edit flow  
**Preconditions**: At least one project has been added

### Steps
1. Open the welcome screen and use the project picker.
2. Choose a project and send a first prompt.
3. In the resulting chat, verify whether the project selection still feels visible and meaningful.
4. Decide whether the system communicates what project context actually buys the user at this stage.

### Variations
- The user intentionally selects `No project`.
- The user has many projects and needs quick recognition in the dropdown.

### Edge Cases
- Project-aware chat is useful only if the user can still tell it apart from fully workspace-bound work.

## WS-02: Move from general chat into workspace work

**Type**: medium  
**Topic**: Workspace and project handoffs  
**Persona**: Developer escalating from ideation into code changes  
**Goal**: Transition from conversation to concrete workspace work without losing momentum  
**Preconditions**: The user has chatted about a task and has a project available

### Steps
1. Start in a general or project-scoped chat.
2. Decide the task now requires an actual workspace.
3. Navigate to Projects and create or select a workspace.
4. Compare the mental shift between conversational setup and operational code-work surfaces.
5. Judge whether the transition feels like a natural escalation or a context reset.

### Variations
- The user knows the branch to use.
- The user starts from an issue-backed workspace flow instead.

### Edge Cases
- Handoffs are where users most notice missing breadcrumbs and unclear scope labels.

## WS-03: Understand whether the current conversation is project-aware or workspace-aware

**Type**: short  
**Topic**: Workspace and project handoffs  
**Persona**: User checking context before asking for edits  
**Goal**: Avoid asking the agent to act in the wrong scope  
**Preconditions**: Both project and workspace concepts are already familiar

### Steps
1. Inspect the current chat and identify what visible cues describe its scope.
2. Compare those cues against what appears in the Projects surface.
3. Decide whether the interface makes the current operating context obvious enough before the user asks for work.
4. Note any ambiguity that could cause users to repeat context in the prompt itself.

### Variations
- The user is doing planning only.
- The user is about to ask for file edits and needs stronger scope confidence.

### Edge Cases
- When scope is unclear, users compensate by repeating context manually, which makes the product feel noisier than it is.

## WS-04: Follow one task from project selection to workspace review

**Type**: long  
**Topic**: Workspace and project handoffs  
**Persona**: Developer doing end-to-end task execution  
**Goal**: Validate the app’s “idea to implementation” path as one coherent UX journey  
**Preconditions**: A project exists and the user can create a workspace

### Steps
1. Select a project from the welcome screen.
2. Start a chat describing a real task.
3. Decide the task needs concrete code work.
4. Navigate into the Projects surface and create or select the relevant workspace.
5. Review workspace-specific surfaces such as chat, diff, notes, or dashboards.
6. Return to the original conversational goal and decide whether the product still feels like one workflow.
7. Record every place where context must be mentally reconstructed by the user.

### Variations
- The task begins from a project-first mindset.
- The task begins as a casual question and only later becomes implementation work.

### Edge Cases
- This is the journey most likely to expose gaps between technically connected systems and experientially connected systems.
