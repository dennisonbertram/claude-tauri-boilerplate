# Issue #119 Fix: Model Selector in Settings General Tab

## Summary

Added a model selector dropdown to the `GeneralTab` in `SettingsPanel.tsx`, using `AVAILABLE_MODELS` from `@/lib/models`. Created a test file with 4 passing tests.

## Changes Made

### 1. `apps/desktop/src/components/settings/SettingsPanel.tsx`

- Added import: `import { AVAILABLE_MODELS } from '@/lib/models';`
- Added `<SettingField label="Model" ...>` with a `<select data-testid="model-select">` element inside `GeneralTab`, positioned after the API Key field and before Max Tokens.
- Options are rendered dynamically from `AVAILABLE_MODELS` (Sonnet 4.6, Opus 4.6, Haiku 4.5).
- `onChange` calls `updateSettings({ model: e.target.value })`.
- `value` is bound to `settings.model` (default: `claude-sonnet-4-6`).

### 2. `apps/desktop/src/components/__tests__/SettingsModelSelector.test.tsx` (new file)

Four tests, all passing:

1. `renders model selector with correct options` — verifies `claude-sonnet-4-6`, `claude-opus-4-6`, and `claude-haiku-4-5-20251001` are present as option values.
2. `default selected model is claude-sonnet-4-6` — verifies the default `select.value`.
3. `changing model calls updateSettings with new value` — fires a change event to `claude-opus-4-6` and inspects what was persisted to `localStorage`.
4. `model selector is in the General tab, not the Model tab` — verifies the selector appears on the General tab and disappears when switching to the Model tab.

## Test Results

```
 ✓ renders model selector with correct options
 ✓ default selected model is claude-sonnet-4-6
 ✓ changing model calls updateSettings with new value
 ✓ model selector is in the General tab, not the Model tab

Test Files  1 passed (1)
Tests       4 passed (4)
```

## Commit

`b9009c2` — `fix(#119): add model selector to Settings General tab`
