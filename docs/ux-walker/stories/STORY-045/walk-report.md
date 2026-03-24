# STORY-045: Configure System Prompt

## Status: PASS

## Steps Performed
1. Clicked "Prompt" tab in profile editor
2. Observed system prompt textarea with placeholder "You are a helpful assistant..."
3. Character count displayed (0 chars for empty prompt)
4. "Include Claude Code system prompt" checkbox (checked by default)
5. Setting Sources section with 4 checkboxes: Project settings, Personal settings, Global settings, Organization settings

## Observations
- System prompt textarea is full-width with descriptive placeholder
- Character counter shows real-time count
- "Include Claude Code system prompt" checkbox adds Claude's built-in instructions before custom prompt
- Setting Sources provide fine-grained control over which configuration files are included:
  - Project settings: Local to project (.claude/ folder)
  - Personal settings: User defaults (~/.claude/ folder)
  - Global settings: System-wide configuration
  - Organization settings: Admin-managed policies
- All setting source checkboxes start unchecked by default

## Findings
None -- system prompt configuration works as expected.
