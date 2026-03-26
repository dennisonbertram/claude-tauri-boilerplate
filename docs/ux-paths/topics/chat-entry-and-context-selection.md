# UX Stories: Chat Entry and Context Selection

Topic: Chat entry and context selection  
Focus: first-message momentum, optional controls, and pre-chat density

## CHAT-01: Reach a first prompt with minimal setup

**Type**: short  
**Topic**: Chat entry and context selection  
**Persona**: New user opening the app to ask one question  
**Goal**: Send a first message without feeling required to configure anything  
**Preconditions**: User is on the empty chat welcome screen

### Steps
1. Read the hero, template suggestions, profile selector, project selector, model selector, and plus-menu affordances.
2. Ignore all optional controls and type directly into the main composer.
3. Submit the message and verify the app allows immediate progress.
4. Judge whether the screen communicates “you can just ask” strongly enough.

### Variations
- The user has existing agent profiles, which adds another visible decision before typing.
- The user has no projects, so project selection should look optional rather than broken.

### Edge Cases
- A richly instrumented welcome surface can accidentally feel like a setup checklist.

## CHAT-02: Choose an agent, project, and model before chatting

**Type**: medium  
**Topic**: Chat entry and context selection  
**Persona**: User trying to set context correctly on the first try  
**Goal**: Enter chat with the right defaults and understand what was chosen  
**Preconditions**: At least one project and one custom agent profile exist

### Steps
1. Select an agent profile from the `Start as` control.
2. Select a project from the project dropdown.
3. Open the model selector and choose a model.
4. Submit the first prompt.
5. Once in the live chat, check whether the chosen profile, project, and model still feel visible and understandable.
6. Decide whether the handoff from pre-chat setup to active conversation preserves confidence.

### Variations
- The user changes only one of the three controls and expects the others to remain default.
- The user chooses “No project” and expects a clearly general conversation.

### Edge Cases
- If post-submit confirmation is weak, the user may second-guess whether the first message used the intended setup.

## CHAT-03: Interpret extra entry controls without feeling blocked

**Type**: medium  
**Topic**: Chat entry and context selection  
**Persona**: Curious user exploring templates, connectors, and attachments  
**Goal**: Understand which pre-chat controls are optional, advanced, or not yet relevant  
**Preconditions**: Welcome screen is visible

### Steps
1. Open the plus menu and inspect its options.
2. Notice template cards, connector indicators, and file-related affordances around the composer.
3. Determine whether each element reads as primary, secondary, or advanced.
4. Ask whether anything on screen invites exploration before the user has even established intent.
5. Record which elements feel helpful and which feel extraneous at this stage.

### Variations
- The user is a power user and appreciates pre-chat controls.
- The user is a first-timer and wants a cleaner starting point.

### Edge Cases
- Advanced affordances can be useful but still create hesitation if they compete visually with the main prompt action.

## CHAT-04: Recover confidence after selecting the wrong pre-chat context

**Type**: short  
**Topic**: Chat entry and context selection  
**Persona**: User who realizes the chosen setup was not needed  
**Goal**: Back out of a mistaken agent or project choice without friction  
**Preconditions**: User is still on the welcome screen or has just entered a fresh chat

### Steps
1. Choose a project or profile intentionally, then realize it was unnecessary.
2. Try to revert to a more general setup.
3. Confirm whether the UI makes “No project” and profile switching easy to discover.
4. Decide whether correction feels lightweight or like restarting setup.

### Variations
- The user wants to change only the project.
- The user wants to abandon all special setup and ask a generic question.

### Edge Cases
- Recovery matters because the welcome screen exposes several choices before the user has product familiarity.
