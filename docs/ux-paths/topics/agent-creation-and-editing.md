# UX Stories: Agent Creation and Editing

Topic: Agent creation and editing  
Focus: confidence, scope clarity, and configuration density

## ACE-01: Create a blank agent from the modal

**Type**: short  
**Topic**: Agent creation and editing  
**Persona**: Developer making a first custom agent  
**Goal**: Start with the simplest possible path and feel confident about what happens next  
**Preconditions**: User is on the Agents view with no profile selected

### Steps
1. Click the create action in the profile sidebar and see a modal with two clear choices: blank profile or AI-generated profile.
2. Choose `Create blank profile` and confirm that the product immediately opens the newly created profile in the editor.
3. Notice the default name `New Agent Profile` and determine whether that placeholder is helpful or generic enough to create uncertainty.
4. Scan the editor header, active tab, and save affordance to confirm the profile is editable but not yet personalized.

### Variations
- The user closes the modal without acting and verifies nothing changed.
- The user already has another unsaved blank profile and expects to resume it instead of creating a duplicate.

### Edge Cases
- The modal offers a simple start, but the next screen is dense enough that the user may feel like they accidentally entered an advanced mode.

## ACE-02: Generate an agent with AI, then verify what was created

**Type**: medium  
**Topic**: Agent creation and editing  
**Persona**: Developer using AI to bootstrap configuration  
**Goal**: Understand whether generated setup feels inspectable rather than magical  
**Preconditions**: Agent creation modal is open

### Steps
1. Enter a natural-language description for a specialized agent and submit with `Generate with AI`.
2. Wait for the loading state and verify whether the modal communicates what Claude is generating.
3. Land in the profile editor and inspect the resulting General, Prompt, Model, Tools, and Advanced tabs.
4. Compare the generated settings to the original request and note which fields are immediately understandable versus opaque.
5. Decide whether the UI makes it easy to answer “what did the generator choose for me?”

### Variations
- The user wants a lightweight editor agent but receives a more fully configured profile.
- The user wants to tweak one field only and should not have to inspect every tab to feel safe.

### Edge Cases
- Failure should leave the user in the modal with a clear retry path instead of forcing them to restart the flow.

## ACE-03: Switch between profiles while holding unsaved edits

**Type**: medium  
**Topic**: Agent creation and editing  
**Persona**: Power user comparing variants  
**Goal**: Explore freely without accidentally losing work  
**Preconditions**: At least two profiles exist and one has unsaved edits

### Steps
1. Edit fields in one profile without saving and confirm the dirty indicator appears in the header.
2. Attempt to select another profile from the sidebar.
3. See the unsaved-changes confirmation and decide whether the prompt is enough to preserve confidence.
4. Cancel once to keep editing, then switch again and accept leaving.
5. Verify that the product clearly communicates which profile is active after the switch.

### Variations
- The user duplicates a profile and immediately compares original versus copy.
- The user uses `Cmd+S` to save before switching and expects the warning to disappear.

### Edge Cases
- A native confirm dialog protects data, but it interrupts rapid comparison and offers little context about what changed.

## ACE-04: Understand repeated model, tools, hooks, and integration controls

**Type**: long  
**Topic**: Agent creation and editing  
**Persona**: Product evaluator auditing scope overlap  
**Goal**: Determine whether profile-level controls feel distinct from global settings  
**Preconditions**: At least one profile exists and the user has already opened global settings once

### Steps
1. Open a profile and inspect the `Model` tab, noting model, effort, and budget controls.
2. Open the `Tools` tab and inspect permission-related controls.
3. Open the `Automations` and `Integrations` tabs and note hooks and MCP server configuration.
4. Open global settings and find model, advanced permissions, hooks, and MCP configuration there as well.
5. Compare the wording, grouping, and visual framing between the two surfaces.
6. Ask the product-level question: “Which of these are defaults, which are overrides, and which one will affect my next chat?”
7. Record every moment where the UI assumes the user already understands that scope boundary.

### Variations
- The user is sophisticated and expects clear override language.
- The user is new and interprets repeated controls as duplicated setup they must complete twice.

### Edge Cases
- If the product does not label precedence clearly, users may avoid customization entirely out of caution.

## ACE-05: Decide whether delete and duplicate feel safe

**Type**: short  
**Topic**: Agent creation and editing  
**Persona**: User cleaning up old profiles  
**Goal**: Manage profile inventory without fear of damaging active work  
**Preconditions**: Several profiles exist in the sidebar

### Steps
1. Duplicate an existing profile and verify the new selection is obvious.
2. Trigger delete on a profile and observe the two-step confirmation flow in the header.
3. Decide whether the affordance communicates enough risk without creating excessive friction.
4. Confirm the editor and sidebar settle into a stable empty or next-selected state after deletion.

### Variations
- The user deletes the currently open profile.
- The user duplicates a profile only to make one small experiment.

### Edge Cases
- Cleanup flows should feel reversible in spirit even when they are not literally undoable.
