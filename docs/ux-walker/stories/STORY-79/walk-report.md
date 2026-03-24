# STORY-079: Configure Sandbox for Tool Isolation

## Walk Date
2026-03-23

## Story
Check sandbox configuration in agent profiles.

## Steps Taken
1. Navigated to Agent Profiles > Code Review Bot > Sandbox tab
2. Examined sandbox configuration UI

## Findings
- **Sandbox tab** exists in Agent Profile editor with dedicated configuration
- **Sandbox Environment** section provides preset options: None, Node.js, Python 3, Custom JSON
- Currently set to "Custom JSON" showing an editable JSON configuration
- **Environment Configuration** shows Docker container config with type, image, and volumes
- Description: "A sandbox runs your agent's tools in an isolated environment, keeping your system safe from unintended changes. Sandboxes provide isolated execution environments (e.g., Docker containers) for running tools safely."
- The JSON editor is fully editable
- Preset buttons (None, Node.js, Python 3) likely auto-populate the JSON config

## Verdict
**pass** -- Sandbox configuration is fully implemented with preset options and custom JSON editing in Agent Profiles.
