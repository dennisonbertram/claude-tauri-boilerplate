# UX Walker Report — Run #3

| Field | Value |
|-------|-------|
| Run | #3 |
| Date | 2026-03-25 |
| Frontend URL | http://localhost:1420 |
| Server URL | http://localhost:3131 |
| Catalog | `docs/ux-paths/catalog.md` |
| Focus | Agent creation, settings information architecture, and pre-chat information density |
| Stories walked | 8 |
| Stories skipped | 16 |

## Environment Notes

- The local app was started with `./init.sh` in `tmux` on ports `1420` and `3131`.
- This dev build includes an `Agentation` overlay. I disabled its interaction blocker, but it still added visual/debug chrome and occasionally surfaced annotation UI during the walk.
- The browser walkthrough used `agent-browser`, per repository instructions.

## Stories Walked

| Story | Result | Notes |
|-------|--------|-------|
| CHAT-01 | PARTIAL | Welcome screen is usable, but visually dense before the first prompt |
| CHAT-02 | PARTIAL | Profile, project, and model controls are visible, but their scopes are not explained clearly |
| ACE-01 | PASS | Blank-profile path works from modal to editor |
| ACE-02 | FAIL | Generate-with-AI fires backend requests but does not surface the returned error state clearly |
| ACE-04 | PARTIAL | Repeated configuration concepts are visible across profile and settings surfaces |
| SET-01 | PARTIAL | Finding a simple setting is possible, but the pane is long and mixed-purpose |
| SET-02 | PARTIAL | Global and per-profile model controls are both present, with weak precedence cues |
| SET-04 | PARTIAL | Data & Context mixes instructions, memory, MCP, hooks, and logs into one dense pane |

## Findings By Severity

### High

1. **ACE-02 silent failure on AI-generated agent creation**
   The browser fired `POST /api/agent-profiles/generate`, and a direct curl to the same endpoint returned `{"error":"Assistant error: rate_limit","code":"GENERATION_ERROR"}`. In the UI, the modal mainly looked disabled/busy and did not surface a clear inline explanation during the observed failure state.

### Medium

1. **CHAT-01 welcome screen asks for too many decisions before first value**
   The first screen presents profile, project, model, templates, attachments/connectors, and learning copy at once. The composer remains visible, but the screen reads more like a setup surface than a simple “ask your first question” surface.

2. **CHAT-02 scope of pre-chat controls is under-explained**
   The app shows profile, project, and model selectors before chat begins, but does not strongly explain what each choice changes for the first turn versus later runtime behavior.

3. **ACE-04 / SET-02 repeated model and behavior controls across surfaces**
   Model, effort, and related behavior controls exist in both the profile editor and global settings. The UI exposes both well, but it does not strongly answer “which one wins next?”

4. **SET-01 mixed-purpose settings groups increase scan cost**
   The General group includes account/provider, runtime environment, IDE settings, appearance, and notifications in one long right-hand pane. This is workable for experts but slow for quick changes.

5. **SET-04 Data & Context is especially dense**
   Instructions, CLAUDE.md files, Memory, MCP, Hooks, Event Reference, and Execution Log all render in one pane. The density makes this feel like a control center rather than a focused task flow.

6. **SET-04 duplicated headings reduce clarity**
   The Data & Context pane visibly repeats headings like `Memory` and `Hooks`, which makes the structure feel more crowded than it needs to.

## Quick Fixes Applied

None. This run was review-only.

## Issues Filed

None in this run. The findings are actionable, but I kept this pass focused on evidence capture and report generation.

## Overall Assessment

The app already has strong surface coverage and a lot of capability, but the focused browser pass reinforced the same pattern across the product: power is arriving before clarity. Agent creation works on the blank path, yet the jump into the full editor is abrupt. Settings is comprehensive, yet broad groups still collapse many concepts into long panes. The welcome screen is attractive and capable, but it asks users to mentally model the system before they have received the first bit of value.

The biggest concrete defect from this run is the AI-generated agent flow failing without strong in-context error communication when generation hits a backend rate limit. The biggest product-level theme is repeated configuration scope: the app needs more help answering “global default or profile override?” in plain UI language.

## Top Recommendations

1. Surface backend generation failures inline in the create-agent modal with explicit retry guidance.
2. Add scope language for repeated controls such as model, permissions, hooks, and MCP.
3. Reduce first-prompt cognitive load by visually downgrading optional welcome-screen controls.
4. Split or progressively disclose long settings panes, especially Data & Context.
5. Clean up repeated headings and section framing so dense panes feel structured instead of stacked.
