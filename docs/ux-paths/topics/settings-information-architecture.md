# UX Stories: Settings Information Architecture

Topic: Settings information architecture  
Focus: scope boundaries, information density, and repeated controls

## SET-01: Open settings to answer one simple question quickly

**Type**: medium  
**Topic**: Settings information architecture  
**Persona**: Developer trying to change one default  
**Goal**: Find the right settings area quickly without learning the whole system  
**Preconditions**: App is open on any main surface

### Steps
1. Open settings from the sidebar or status-related entry point.
2. Try to answer one concrete question such as “Where do I change my provider?” or “Where do I change my IDE?”
3. Use only the group labels first and note whether they are descriptive enough.
4. Open the chosen group and scan the rendered subsections in the right pane.
5. Decide whether the group structure reduces search time or merely starts a second search inside a long scroll region.

### Variations
- The user arrives from a deep link into a specific tab.
- The user does not know if the answer belongs under General, AI & Model, or Integrations.

### Edge Cases
- A grouped drawer can still feel like a large form when several sections render together below one heading.

## SET-02: Compare global model settings with profile model settings

**Type**: medium  
**Topic**: Settings information architecture  
**Persona**: User unsure which model setting wins  
**Goal**: Understand whether model changes are app-wide defaults or profile-specific behavior  
**Preconditions**: At least one agent profile exists

### Steps
1. Open global settings and inspect the model controls.
2. Change nothing yet; simply note the labels and descriptions for model, effort, system prompt, and thinking budget.
3. Open an agent profile and inspect its `Model` tab.
4. Compare the same concepts across the two surfaces.
5. Form a prediction about what happens to the next chat if the two surfaces disagree.
6. Note where the UI explicitly states precedence and where the user has to infer it.

### Variations
- The user expects global settings to be account defaults.
- The user expects profile settings to override only when that profile is selected.

### Edge Cases
- Repeated labels with different scopes can look identical even when the underlying intent differs.

## SET-03: Read a long grouped settings pane without losing context

**Type**: short  
**Topic**: Settings information architecture  
**Persona**: User navigating dense technical options  
**Goal**: Maintain orientation while scanning a large amount of explanatory copy  
**Preconditions**: Settings drawer is open

### Steps
1. Select a group that contains multiple subsections, such as `General` or `AI & Model`.
2. Scroll through the pane and watch headings, descriptions, toggles, and form fields accumulate.
3. Check whether the visual hierarchy makes it easy to distinguish “new section” from “more controls in the same task.”
4. Decide whether the amount of explanation feels supportive or extraneous for a returning user.

### Variations
- The user is new and wants rich explanation.
- The user is experienced and wants faster scan-ability.

### Edge Cases
- Long panes can make users feel they are changing more of the system than intended.

## SET-04: Configure hooks or MCP and determine where that configuration belongs

**Type**: long  
**Topic**: Settings information architecture  
**Persona**: Power user managing global versus per-agent behavior  
**Goal**: Decide where automation and integration setup should live  
**Preconditions**: User has both settings and agent profiles available

### Steps
1. Open global settings and navigate to `MCP` and `Hooks`.
2. Read the labels and infer whether the configuration is app-wide, reusable, or runtime-specific.
3. Open an agent profile and navigate to `Automations` and `Integrations`.
4. Compare the vocabulary between the two surfaces.
5. Imagine a concrete need such as “I want browser automation for every session” versus “I want it only for my review agent.”
6. Decide whether the product makes the storage scope obvious before the user edits anything.
7. Record whether the interface communicates inheritance, override, merge, or replacement behavior.

### Variations
- The user wants one MCP server globally and a second only for a specialized agent.
- The user wants to audit existing setup without accidentally editing it.

### Edge Cases
- Repetition without explicit hierarchy can make advanced features feel more fragile than they are.
