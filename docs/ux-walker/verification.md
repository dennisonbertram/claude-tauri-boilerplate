# UX Walker Skill — Verification Report

**Date**: 2026-03-20
**Skill path**: `~/.claude/skills/ux-walker/`

---

## 1. File Listing

All files found in `~/.claude/skills/ux-walker/`:

```
~/.claude/skills/ux-walker/
├── SKILL.md
├── references/
│   ├── action-patterns.md
│   ├── issue-template.md
│   ├── triage-rubric.md
│   └── ux-audit-rubric.md
└── templates/
    └── latest-report-template.md
```

**Result**: PASS — All 6 expected files are present.

---

## 2. SKILL.md Frontmatter

```yaml
---
name: ux-walker
description: Walk UX story catalog through a real browser, testing each journey for correctness, visual quality, and UX excellence. Auto-fixes small issues, files GitHub issues for larger ones.
version: 1.0.0
user_invocable: true
---
```

| Field | Expected | Actual | Status |
|-------|----------|--------|--------|
| `name` | `ux-walker` | `ux-walker` | PASS |
| `user_invocable` | `true` | `true` | PASS |
| `version` | present | `1.0.0` | PASS |
| `description` | present | present (full sentence) | PASS |

**Result**: PASS — Frontmatter is correct and complete.

---

## 3. Cross-Reference Check

### 3.1 Referenced files existence

SKILL.md references these files in its References and Templates tables (lines 598-607):

| Referenced Path | Exists? | Status |
|-----------------|---------|--------|
| `references/ux-audit-rubric.md` | Yes | PASS |
| `references/action-patterns.md` | Yes | PASS |
| `references/triage-rubric.md` | Yes | PASS |
| `references/issue-template.md` | Yes (referenced in Step 2d, line 374+) | PASS |
| `templates/latest-report-template.md` | Yes | PASS |

**Result**: PASS — All referenced files exist.

### 3.2 Explicit references in SKILL.md

| Location in SKILL.md | Reference | Context |
|----------------------|-----------|---------|
| Line 244 | `references/ux-audit-rubric.md` | Walker agent prompt — UX audit checklist |
| Line 330 | `references/triage-rubric.md` | Triage step — "See references/triage-rubric.md for the full triage decision tree" |
| Line 495 | `templates/latest-report-template.md` | Phase 4 report — "Template reference" |
| Line 600 | `references/ux-audit-rubric.md` | References table — hyperlinked |
| Line 601 | `references/triage-rubric.md` | References table — hyperlinked |
| Line 607 | `templates/latest-report-template.md` | Templates table — hyperlinked |

Note: `references/action-patterns.md` is NOT explicitly referenced by path in SKILL.md. However, it exists in the skill directory and its content (agent-browser command translations) is implicitly used by walker sub-agents. This is not a broken reference — it is an unreferenced file.

Note: `references/issue-template.md` is NOT explicitly referenced by path in SKILL.md. The issue filing template in SKILL.md (Step 2d, lines 374-401) is inline rather than pointing to the reference file. The reference file contains a more detailed version of the template.

**Result**: WARN — Two reference files (`action-patterns.md`, `issue-template.md`) exist but are not explicitly referenced by path in SKILL.md. See Issue #1 and #2 below.

---

## 4. Broken Reference Check

Scanned SKILL.md for all file path references:

| Path in SKILL.md | Exists? | Status |
|-------------------|---------|--------|
| `docs/ux-paths/catalog.md` | Runtime dependency (not part of skill) | N/A |
| `docs/ux-walker/run-history.json` | Runtime output (created during execution) | N/A |
| `docs/ux-walker/walk-plan.json` | Runtime output | N/A |
| `docs/ux-walker/issues-filed.md` | Runtime output | N/A |
| `docs/ux-walker/stories/STORY-{NNN}/` | Runtime output | N/A |
| `docs/ux-walker/fixes/{FINDING_ID}.md` | Runtime output | N/A |
| `docs/ux-walker/latest-report.md` | Runtime output | N/A |
| `references/ux-audit-rubric.md` | Yes | PASS |
| `references/triage-rubric.md` | Yes | PASS |
| `templates/latest-report-template.md` | Yes | PASS |

**Result**: PASS — No broken references to skill-internal files. All runtime paths are created during execution.

---

## 5. Consistency Checks

### 5.1 Finding JSON Schema — SKILL.md vs. ux-audit-rubric.md

**SKILL.md findings.json schema** (lines 291-306):

```json
{
  "id": "FINDING-{STORY_ID}-{N}",
  "story_id": "STORY-{ID}",
  "severity": "critical|high|medium|low|suggestion",
  "category": "functional|visual|ux|a11y|performance",
  "description": "...",
  "expected": "...",
  "actual": "...",
  "screenshot": "screenshots/finding-{N}.png",
  "video": "videos/finding-{N}.webm or null",
  "step_number": 3,
  "suggested_fix": "... or null",
  "files_likely_involved": ["src/components/Foo.tsx"]
}
```

**ux-audit-rubric.md finding template** (lines 100-113):

```json
{
  "id": "F-{STORY_ID}-{SEQ}",
  "severity": "critical|high|medium|low|suggestion",
  "category": "simplicity|disclosure|layout|visual|happy-path|a11y|error-handling",
  "criterion": "Which specific check failed",
  "score": "warn|fail",
  "description": "What is wrong",
  "expected": "What should happen",
  "actual": "What actually happens",
  "screenshot": "path/to/screenshot.png",
  "suggested_fix": "How to fix it (if obvious)",
  "files_likely_involved": ["src/components/Foo.tsx"]
}
```

**Discrepancies found:**

| Field | SKILL.md | ux-audit-rubric.md | Status |
|-------|----------|-------------------|--------|
| `id` format | `FINDING-{STORY_ID}-{N}` | `F-{STORY_ID}-{SEQ}` | MISMATCH |
| `story_id` | Present | Absent | MISMATCH |
| `category` values | `functional\|visual\|ux\|a11y\|performance` | `simplicity\|disclosure\|layout\|visual\|happy-path\|a11y\|error-handling` | MISMATCH |
| `criterion` | Absent | Present | MISMATCH |
| `score` | Absent | Present (`warn\|fail`) | MISMATCH |
| `video` | Present | Absent | MISMATCH |
| `step_number` | Present | Absent | MISMATCH |

**Result**: FAIL — Significant schema divergence. See Issue #3, #4, and #5 below.

### 5.2 Severity Levels

| File | Severity Levels |
|------|----------------|
| SKILL.md (lines 258, 295) | `critical \| high \| medium \| low \| suggestion` |
| ux-audit-rubric.md (lines 117-122) | `critical \| high \| medium \| low \| suggestion` |
| triage-rubric.md (lines 73-76) | `critical \| high \| medium \| low \| suggestion` (inferred from override rules + labels) |
| issue-template.md (line 18) | `{SEVERITY}` (placeholder, references findings.json) |
| latest-report-template.md (lines 28-33) | `Critical \| High \| Medium \| Low \| Suggestion` |

**Result**: PASS — Severity levels are consistent across all files. The five levels (`critical`, `high`, `medium`, `low`, `suggestion`) appear in all relevant files.

### 5.3 Category Names

| File | Categories |
|------|-----------|
| SKILL.md walker prompt (line 259) | `functional \| visual \| ux \| a11y \| performance` |
| SKILL.md findings.json schema (line 296) | `functional \| visual \| ux \| a11y \| performance` |
| ux-audit-rubric.md finding template (line 104) | `simplicity \| disclosure \| layout \| visual \| happy-path \| a11y \| error-handling` |
| triage-rubric.md labels (line 108) | `functional \| visual \| ux \| a11y` |
| issue-template.md labels (line 78) | `{CATEGORY}` (placeholder) |
| latest-report-template.md (lines 40-44) | `Functional \| Visual \| UX \| Accessibility \| Error Handling` |

**Result**: FAIL — Category names are inconsistent. See Issue #4 below.

Three different category taxonomies exist:
1. **SKILL.md**: `functional | visual | ux | a11y | performance`
2. **ux-audit-rubric.md**: `simplicity | disclosure | layout | visual | happy-path | a11y | error-handling`
3. **latest-report-template.md**: `Functional | Visual | UX | Accessibility | Error Handling`

The rubric uses granular audit-oriented categories while SKILL.md uses broader groupings. There is no mapping defined between them.

### 5.4 Triage Criteria — SKILL.md vs. triage-rubric.md

**SKILL.md triage criteria** (lines 315-328):

Quick fix requires ALL:
1. Touches <=2 files
2. Obvious fix
3. Low regression risk
4. Severity: medium or lower

Filed issue if ANY:
1. Touches 3+ files
2. Requires design thought
3. Could break other features
4. Severity: critical or high
5. Involves component restructuring or state changes

**triage-rubric.md criteria** (lines 20-27, 42-55):

Quick fix requires ALL:
1. File scope: Touches <=2 source files
2. Obvious solution
3. Low regression risk
4. **Time estimate: Can be completed in <15 minutes** (extra criterion)
5. Severity: Medium or lower

Filed issue if ANY:
1. File scope: Touches 3+ source files
2. Design thought needed
3. Regression risk
4. Severity: Critical or high
5. **Workflow change** (extra criterion)
6. **Component restructuring** (extra criterion)
7. **State management** (extra criterion)
8. **New feature** (extra criterion)

**Discrepancies:**

| Criterion | SKILL.md | triage-rubric.md | Status |
|-----------|----------|------------------|--------|
| Quick fix: time estimate | Not mentioned | "<15 minutes" | MISMATCH — rubric has extra criterion |
| Filed issue: workflow change | Not listed separately | Listed as criterion #5 | MINOR — SKILL.md bundles into "design thought" |
| Filed issue: state management | Not listed separately | Listed as criterion #7 | MINOR — SKILL.md bundles into "restructuring" |
| Filed issue: new feature | Not mentioned | Listed as criterion #8 | MISMATCH — rubric is more specific |
| Severity override rules | Not mentioned | Critical -> always filed; Suggestion -> never fixed | MISMATCH |
| Quick fix limits | Not mentioned | Max 3 parallel, max 10 per run, no file conflicts | PARTIAL — SKILL.md mentions max 3 parallel in Step 2c but not 10-per-run limit |

**Result**: WARN — SKILL.md is a simplified summary of the triage rubric. The rubric adds extra criteria and override rules that the SKILL.md summary omits. This is acceptable as long as agents are directed to read the rubric, which they are (line 330). However, the severity override rules (critical -> always file, suggestion -> never fix) are not mentioned in SKILL.md and could be missed by the orchestrator if it only reads SKILL.md.

### 5.5 Issue Template Fields vs. findings.json Output

**findings.json produces** (SKILL.md schema):
- `id`, `story_id`, `severity`, `category`, `description`, `expected`, `actual`, `screenshot`, `video`, `step_number`, `suggested_fix`, `files_likely_involved`

**issue-template.md expects** (Field Reference table, lines 83-103):
- `STORY_ID` — from walk-plan.json (also available as `story_id` in findings.json)
- `STORY_TITLE` — from catalog.md (NOT in findings.json)
- `ISO_DATE` — current timestamp (NOT in findings.json)
- `STEP_NUMBER` — from findings.json `step_number`
- `STEP_DESCRIPTION` — from catalog.md (NOT in findings.json)
- `CURRENT_URL` — from agent-browser (NOT in findings.json)
- `FINDING_ID` — from findings.json `id`
- `SEVERITY` — from findings.json `severity`
- `CATEGORY` — from findings.json `category`
- `CRITERION` — from findings.json `criterion` (**NOT in SKILL.md schema**)
- `SCORE` — from findings.json `score` (**NOT in SKILL.md schema**)
- `DETAILED_DESCRIPTION` — from findings.json `description`
- `EXPECTED` — from findings.json `expected`
- `ACTUAL` — from findings.json `actual`
- `SCREENSHOT_PATH` — from findings.json `screenshot`
- `SNAPSHOT_EXCERPT` — saved separately (NOT in findings.json)
- `SUGGESTED_FIX_OR_APPROACH` — from findings.json `suggested_fix`
- `FILES_LIST` — from findings.json `files_likely_involved`
- `FILE_COUNT` — derived from `files_likely_involved`

**Missing from SKILL.md findings.json schema but needed by issue-template.md:**
- `criterion` — which rubric check failed
- `score` — `warn` or `fail`

These fields ARE in the ux-audit-rubric.md finding template but NOT in the SKILL.md findings.json schema.

**Result**: FAIL — The issue template expects `criterion` and `score` fields that the SKILL.md findings.json schema does not produce. See Issue #5.

---

## Issues Summary

### Issue #1: Unreferenced file — action-patterns.md (LOW)

`references/action-patterns.md` exists but SKILL.md never references it by path. Walker sub-agents would need to know it exists to use it. Consider adding it to the References table in SKILL.md.

**Recommendation**: Add to SKILL.md References table:
```
| [references/action-patterns.md](references/action-patterns.md) | During walks — translate story steps to agent-browser commands |
```

### Issue #2: Unreferenced file — issue-template.md (LOW)

`references/issue-template.md` exists but SKILL.md never references it by path. SKILL.md has an inline (simplified) issue template in Step 2d. The reference file has a more detailed template with additional fields (run date, step description, current URL, snapshot excerpt, estimated complexity).

**Recommendation**: Either reference `issue-template.md` from SKILL.md Step 2d, or merge the reference file content into SKILL.md and delete the separate file. The current situation risks the orchestrator using the simplified inline template and missing the additional fields.

### Issue #3: Finding ID format mismatch (MEDIUM)

SKILL.md uses `FINDING-{STORY_ID}-{N}` (e.g., `FINDING-005-3`) while ux-audit-rubric.md uses `F-{STORY_ID}-{SEQ}` (e.g., `F-005-3`). The issue-template.md field reference table (line 91) uses `F-014-003`.

This means walker sub-agents following the rubric will produce IDs in `F-` format, but the orchestrator expecting `FINDING-` format may not match them correctly. Branch naming in SKILL.md (line 573) also uses the `FINDING-` prefix: `ux-walker/FINDING-005-3-sidebar-overflow`.

**Recommendation**: Standardize on one format. `F-{STORY_ID}-{SEQ}` is shorter and used by both ux-audit-rubric.md and issue-template.md. Update SKILL.md to match.

### Issue #4: Category taxonomy mismatch (HIGH)

Three incompatible category sets exist:

1. **SKILL.md** (5 categories): `functional | visual | ux | a11y | performance`
2. **ux-audit-rubric.md** (7 categories): `simplicity | disclosure | layout | visual | happy-path | a11y | error-handling`
3. **latest-report-template.md** (5 categories): `Functional | Visual | UX | Accessibility | Error Handling`

Problems:
- Walker sub-agents follow the rubric and produce findings with rubric categories (e.g., `simplicity`, `disclosure`, `layout`, `happy-path`).
- The orchestrator triages using SKILL.md categories (e.g., `functional`, `ux`, `performance`).
- The report template uses yet another set (e.g., `Accessibility` instead of `a11y`, `Error Handling` instead of `error-handling`).
- `performance` appears only in SKILL.md, not in the rubric or report template.
- `simplicity`, `disclosure`, `layout`, `happy-path` appear only in the rubric.

This will cause confusion during triage (orchestrator sees unknown categories) and reporting (report template has categories that don't match findings).

**Recommendation**: Define an authoritative category list and a mapping. Either:
- (a) Use the rubric's 7 categories everywhere and update SKILL.md and the report template, or
- (b) Use SKILL.md's 5 broad categories everywhere and define a mapping in the rubric (e.g., `simplicity` and `disclosure` map to `ux`; `layout` maps to `visual`; `happy-path` maps to `ux`; `error-handling` maps to `functional`).

### Issue #5: Schema fields missing from SKILL.md (MEDIUM)

The ux-audit-rubric.md finding template includes `criterion` and `score` fields. The issue-template.md expects these fields (CRITERION, SCORE). But the SKILL.md findings.json schema does not include them.

This means:
- Walker sub-agents following only SKILL.md will not produce `criterion` or `score`.
- Walker sub-agents following the rubric will produce them.
- The issue template will have empty CRITERION and SCORE fields if the walker used SKILL.md's schema.

**Recommendation**: Add `criterion` and `score` fields to the SKILL.md findings.json schema to match the rubric and issue template.

### Issue #6: Triage severity override rules not in SKILL.md (LOW)

triage-rubric.md specifies that critical findings are ALWAYS filed as issues (even if 1 file) and suggestion findings are NEVER quick-fixed. SKILL.md's triage section (lines 315-328) does not mention these override rules. The orchestrator is told to reference the triage rubric, so this is partially mitigated, but the SKILL.md summary could mislead if read in isolation.

**Recommendation**: Add a note to SKILL.md Step 2b:
```
Note: Critical findings are always filed as issues regardless of file count.
Suggestions are logged in the report only — never quick-fixed or filed.
See references/triage-rubric.md for override rules.
```

### Issue #7: Quick fix limit (10 per run) not in SKILL.md (LOW)

triage-rubric.md specifies a max of 10 quick fixes per run. SKILL.md mentions the max 3 parallel fix agents but not the 10-per-run cap.

**Recommendation**: Add the 10-per-run limit to SKILL.md Step 2c or Step 2b.

---

## Verification Summary

| Check | Result |
|-------|--------|
| All files exist | PASS |
| Frontmatter correct (`name: ux-walker`, `user_invocable: true`) | PASS |
| All cross-referenced files exist | PASS |
| No broken file references | PASS |
| Finding JSON schema consistency | FAIL — 7 field-level mismatches between SKILL.md and rubric |
| Severity levels consistency | PASS |
| Category names consistency | FAIL — 3 different taxonomies across files |
| Triage criteria consistency | WARN — SKILL.md is simplified subset; missing override rules |
| Issue template field compatibility | FAIL — `criterion` and `score` missing from SKILL.md schema |
| Unreferenced files | WARN — `action-patterns.md` and `issue-template.md` not referenced in SKILL.md |

**Overall**: 7 issues found (1 HIGH, 2 MEDIUM, 4 LOW). The skill is structurally complete and all files exist, but there are schema and taxonomy inconsistencies between the SKILL.md orchestration instructions and the reference files that would cause problems during execution.
