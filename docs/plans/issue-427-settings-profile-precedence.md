# Issue #427 Settings vs Profile Precedence

## Feature

Clarify the precedence between global settings and profile-specific overrides for model and related behavior controls so users can tell which values apply to the next chat run.

## Why

The same controls appear in both Settings and the Agent Profile editor. Without clear framing, users have to infer whether they are editing defaults or overrides and which value wins.

## Acceptance Criteria

- Global controls are labeled as defaults.
- Profile controls are labeled as overrides when a profile is selected.
- The UI explains which value affects the next chat run.
- Regression tests cover the clarified precedence copy.
- The updated settings/profile surfaces are manually verified in the browser.

## Checklist

- [x] Add targeted regression tests for precedence/default/override helper copy.
- [x] Update the settings model controls to read as defaults.
- [x] Update the profile model controls to read as overrides.
- [x] Clarify next-run precedence in the relevant UI copy.
- [x] Run targeted frontend tests for the touched settings/profile components.
- [ ] Manually verify the updated UI in the browser.
