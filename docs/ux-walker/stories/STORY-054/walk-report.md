# STORY-054: Manage Advanced Settings

## Status: PASS

## Steps Performed
1. Clicked "Advanced" tab in profile editor
2. Observed all advanced configuration options

## Observations
- Working Directory (cwd): Text input for project directory path
  - Help: "Leave empty to use the default project directory"
- Additional Directories: Multiline text input for extra accessible paths
  - Help: "One path per line"
- Sort Order: Spinbutton (default 0)
  - Help: "Controls sidebar position. Lower numbers appear first."
- Max Turns: Spinbutton (default 0)
  - Help: "Maximum conversation turns. 0 = unlimited."
- Max Budget (USD): Spinbutton with $ prefix (default $0.00)
  - Help: "Maximum spend per session. 0 = unlimited."
- Sub-agents JSON: Large textarea for configuring sub-agent teams
  - Placeholder shows example with researcher agent, model, and tools
  - Help: "Configure sub-agents available to this profile. Defines a team of specialized agents with their own models, tools, and permissions."

## Findings
None -- advanced settings are comprehensive and well-documented with help text.
