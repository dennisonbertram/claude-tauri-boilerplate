# Issue #428 General Settings Scan Cost

## Feature

Reduce the scan cost of the General settings group so users can find one-off changes faster without reading a long mixed-purpose pane.

## Why

The current General group stacks unrelated concerns together, which makes quick changes slower than they need to be and weakens the visual structure of the right-hand pane.

## Acceptance Criteria

- The General settings group is easier to scan for one-off changes.
- Subsections are more clearly framed or split.
- Common settings are easier to find without reading the entire pane.
- Regression tests cover the new section framing.
- The updated settings UI is manually verified in the browser.

## Checklist

- [x] Add targeted regression tests around the updated General-group structure.
- [x] Update the settings panel layout or framing to reduce scan cost in the General group.
- [x] Keep the revised structure consistent with the existing design system.
- [x] Run targeted frontend tests for the touched settings components.
- [ ] Manually verify the revised General settings flow in the browser.
