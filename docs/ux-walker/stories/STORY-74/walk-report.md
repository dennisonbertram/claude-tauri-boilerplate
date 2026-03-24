# STORY-074: Set Up Session-Scoped vs. Permanent Permissions

## Walk Date
2026-03-23

## Story
Check for permission scope settings (session vs permanent).

## Steps Taken
1. Checked Settings > AI & Model > Advanced > Permission Mode dropdown
2. Checked Agent Profiles > Tools > Permission Mode dropdown
3. Looked for session vs permanent toggle in both locations

## Findings
- **Settings > AI & Model > Advanced** has a Permission Mode dropdown set to "Default"
- **Agent Profiles > Tools** tab has a separate Permission Mode dropdown also set to "Default"
- Neither location shows a session-scoped vs permanent distinction
- No UI element was found to configure whether a permission grant persists across sessions or is limited to the current session
- The Permission Mode dropdown options could not be fully explored because clicking the status bar "Normal" button crashes the app

## Verdict
**fail** -- No session-scoped vs permanent permission toggle exists in the UI. Permissions appear to be configured only at the profile level (permanent) with no session-scoped option.

## Missing Features
- Session vs permanent permission scope toggle
- Per-permission scope configuration
- Session permission expiry settings
