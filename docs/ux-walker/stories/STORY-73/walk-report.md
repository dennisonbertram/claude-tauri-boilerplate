# STORY-073: Identify Risk Level of Requested Tool

## Walk Date
2026-03-23

## Story
Check if tools show risk level indicators.

## Steps Taken
1. Navigated to Agent Profiles > Code Review Bot > Tools tab
2. Examined tool list for risk level indicators
3. Checked permission mode description

## Findings
- Tools are listed with names and descriptions but **no explicit risk level indicators** (no color coding, no risk badges, no severity icons)
- Permission Mode is labeled "Default" with description "Ask for permission on risky operations" -- this implies the system has an internal concept of risk levels but does not expose them visually to the user
- Tools have Default/Allow/Block toggles but no risk classification (e.g., low/medium/high)
- No tooltips or additional info icons were observed that might show risk information

## Verdict
**fail** -- No visible risk level indicators on tools. The system implies risk classification internally (via "risky operations" in permission mode description) but does not surface this to the user.

## Missing Features
- Risk level badges/icons per tool
- Risk categorization (low/medium/high/critical)
- Visual differentiation between safe and risky tools
