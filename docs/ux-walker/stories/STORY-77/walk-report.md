# STORY-077: Handle Permission Denial and Error Recovery

## Walk Date
2026-03-23

## Story
Check what happens when permissions are denied.

## Steps Taken
1. Looked for permission denial UI in chat interface
2. Checked Agent Profile Tools tab for block behavior documentation
3. No active session to test permission denial flow

## Findings
- Agent Profile > Tools tab provides "Block" option for each tool, which would permanently deny the tool
- No UI was observed for handling runtime permission denial (e.g., user clicking "Deny" on a permission prompt)
- Cannot test the denial flow without an active sidecar session
- No error recovery UI or retry mechanism was observed in the static configuration

## Verdict
**blocked** -- Cannot test permission denial and error recovery without an active agent session. The Block toggle in Agent Profiles provides static denial but runtime denial UX cannot be verified.
