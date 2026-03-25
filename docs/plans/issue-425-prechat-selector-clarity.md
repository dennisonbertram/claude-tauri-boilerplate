# Issue #425 Pre-Chat Selector Clarity

## Feature

Clarify what the profile, project, and model selectors on the welcome screen affect before the first chat turn so users can make informed choices without extra guesswork.

## Why

The current welcome screen surfaces the selectors, but it does not explain whether they are optional, whether they apply to just the next run or the whole session, or how they relate to later settings. That ambiguity raises the cost of getting started.

## Acceptance Criteria

- Each selector has short helper copy that explains its scope.
- The UI makes it clear these selectors are optional pre-chat choices.
- The model/profile copy better explains the relationship to later settings and defaults.
- Regression tests cover the added helper text and optionality cues.
- The welcome screen is manually verified in the browser.

## Checklist

- [x] Add an issue-specific regression test for the new helper text and optional labels.
- [x] Update the welcome screen copy/layout to clarify profile, project, and model scope.
- [x] Keep the composer as the dominant primary action.
- [x] Run targeted frontend tests for the welcome screen.
- [x] Manually verify the updated welcome screen in the browser.
