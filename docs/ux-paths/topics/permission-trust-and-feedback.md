# UX Stories: Permission Trust and Feedback

Topic: Permission trust and feedback  
Focus: safety perception, runtime clarity, and repeated permission language

## PERM-01: See a risky tool request and decide quickly

**Type**: medium  
**Topic**: Permission trust and feedback  
**Persona**: Cautious developer reviewing a live action  
**Goal**: Approve or deny a risky tool call with confidence  
**Preconditions**: An active chat triggers a permission-requiring action

### Steps
1. Ask for a task likely to require a sensitive tool.
2. Observe the permission request when it appears.
3. Read the request text and determine whether the risk, scope, and consequence are obvious at a glance.
4. Decide whether enough supporting context is present to approve quickly without reading the whole thread again.
5. Approve or deny and verify the result is clearly reflected in the conversation flow.

### Variations
- The user is highly technical and wants exact tool details.
- The user is less technical and wants plainer language about consequence.

### Edge Cases
- Approval prompts need to be concise without becoming vague.

## PERM-02: Use runtime indicators to understand what the agent is doing

**Type**: short  
**Topic**: Permission trust and feedback  
**Persona**: Developer watching a long-running response  
**Goal**: Stay oriented during streaming work  
**Preconditions**: A response is actively streaming

### Steps
1. Observe the visible runtime indicators such as active tool, context usage, cost, and subagent count.
2. Decide which signals feel immediately useful and which require interpretation.
3. Ask whether the product surfaces too little, too much, or the wrong information for a user waiting on progress.
4. Note whether status signals reinforce trust or mainly add noise.

### Variations
- The user is cost-sensitive and watches spend.
- The user is mainly worried about side effects and watches active tools.

### Edge Cases
- Dense runtime data can reassure experts while overwhelming casual users.

## PERM-03: Reconcile permission mode in settings, profiles, and live prompts

**Type**: medium  
**Topic**: Permission trust and feedback  
**Persona**: User trying to predict approval behavior  
**Goal**: Understand how permission behavior is configured before a request occurs  
**Preconditions**: Settings and at least one agent profile are available

### Steps
1. Inspect permission mode in global settings.
2. Inspect permission-related controls in an agent profile.
3. Start or inspect a live chat where permissions matter.
4. Compare the language across all three places.
5. Form a mental model of which level drives the next approval prompt.
6. Note every place where the product expects inference instead of explaining precedence directly.

### Variations
- The user wants strict default permissions globally but looser behavior for one trusted profile.
- The user wants a predictable plan-first mode for all risky tasks.

### Edge Cases
- Permission systems are judged as much by predictability as by raw safety.
