# STORY-081: Recover from Permission Timeout or Disconnection

## Walk Date
2026-03-23

## Story
Check timeout handling for permissions.

## Steps Taken
1. Examined chat interface for timeout indicators
2. Checked settings for timeout configuration
3. No active session to test timeout behavior

## Findings
- No timeout configuration was found in Settings or Agent Profiles
- Settings > AI & Model > Advanced has Max Turns (25) but no permission timeout setting
- Agent Profiles > Advanced has Max Turns and Max Budget but no timeout setting
- Without an active sidecar session, timeout and disconnection behavior cannot be tested
- The app does show a "Something went wrong" error boundary with a "Try Again" button, which provides basic crash recovery
- Status bar shows connection state but no permission-specific timeout indicators

## Verdict
**blocked** -- Cannot test permission timeout or disconnection recovery without an active agent session. No timeout configuration settings were found in the UI.

## Missing Features
- Permission timeout configuration
- Timeout indicator in chat
- Reconnection/retry flow for timed-out permissions
