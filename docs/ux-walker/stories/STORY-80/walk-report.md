# STORY-080: Review Risk Level in Permission Mode Settings

## Walk Date
2026-03-23

## Story
Check permission mode settings for risk level information.

## Steps Taken
1. Checked Settings > AI & Model > Advanced > Permission Mode
2. Checked Agent Profiles > Tools > Permission Mode
3. Looked for risk level documentation or indicators

## Findings
- **Settings > AI & Model > Advanced** has Permission Mode dropdown set to "Default"
- **Agent Profiles > Tools** has Permission Mode dropdown set to "Default" with description: "Ask for permission on risky operations"
- The description mentions "risky operations" but provides no breakdown of what constitutes risky vs safe
- No risk level documentation, legend, or classification system is visible
- Individual tools do not show their risk classification
- The Permission Mode dropdown could not be expanded to see if other modes describe risk levels differently

## Verdict
**fail** -- Permission mode settings mention "risky operations" but do not expose or document risk levels. Users have no way to review which tools are considered risky.

## Missing Features
- Risk level documentation in permission mode settings
- Per-tool risk classification visible to users
- Risk level legend or explanation
