# Issue #429 Welcome Screen First-Prompt Cognitive Load

## Feature

Reduce first-prompt cognitive load on the welcome screen so the composer reads as the obvious first action and optional setup controls recede.

## Why

The welcome screen currently asks users to process several optional controls before getting first value, which can make the product feel like setup instead of progress.

## Acceptance Criteria

- The composer is clearly the dominant first action.
- Optional setup controls are visually downgraded or progressively disclosed.
- The screen more strongly communicates that users can start without configuring everything first.
- Regression tests cover the intended welcome-screen hierarchy.
- The updated welcome screen is manually verified in the browser.

## Checklist

- [x] Add targeted regression tests for the welcome-screen primary-action hierarchy.
- [x] Update the welcome-screen layout to reduce optional-control prominence.
- [x] Strengthen the “just start typing” guidance.
- [x] Run targeted frontend tests for the touched welcome-screen components.
- [ ] Manually verify the updated welcome screen in the browser.
