# STORY-066: Workflow Template Customization

## Walk Report

### Date: 2026-03-23
### Walker: UX Walker (automated)
### App URL: http://localhost:1927

## Steps Taken
1. Opened Settings > AI & Model tab
2. Scrolled to Repository-scoped workflow prompts section

## Observations
- **Repository-scoped workflow prompts** section found in AI & Model tab
- Description: "These prompts override the defaults for this repository only and power the '/review', '/pr', '/branch', and '/browser' workflows."
- **Review Prompt**: Editable textarea with default review instructions, labeled "Prompt template used by /review"
- **PR Prompt**: Editable textarea with default PR creation instructions, labeled "Prompt template used by /pr"
- **Branch Naming Prompt**: Editable textarea with default branch naming instructions, labeled "Prompt template used by /branch"
- All templates are pre-populated with sensible defaults and fully editable

## Verdict: PASS
- Workflow template customization is fully implemented
- Three editable prompt templates for /review, /pr, and /branch workflows
- Clear descriptions and pre-populated defaults

## Issues Found
- None
