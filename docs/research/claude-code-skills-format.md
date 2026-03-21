# Claude Code Skills & Commands: Complete Format Reference

**Date**: 2026-03-20
**Sources**: Official Claude Code docs, Agent Skills spec (agentskills.io), Anthropic skills repo

---

## 1. Skills vs Commands: What's the Difference?

**Commands are now merged into Skills.** The `.claude/commands/` format is the legacy approach. The `.claude/skills/` format is the recommended current standard.

| Aspect | Commands (Legacy) | Skills (Current) |
|--------|-------------------|-------------------|
| Path | `.claude/commands/<name>.md` | `.claude/skills/<name>/SKILL.md` |
| Format | Single markdown file | Directory with SKILL.md + optional supporting files |
| Frontmatter | Supported (same fields) | Supported (extended fields) |
| Invocation | `/project:<name>` or `/user:<name>` | `/name` |
| Auto-invocation by Claude | No (manual only) | Yes (unless `disable-model-invocation: true`) |
| Supporting files | Not supported | Scripts, templates, examples, references |
| Namespace in plugins | N/A | `plugin-name:skill-name` |

Key points:
- Files in `.claude/commands/` still work and support the same frontmatter
- If a skill and a command share the same name, the skill takes precedence
- Skills are the recommended format going forward

---

## 2. Skill File Structure

### Minimal Skill
```
my-skill/
└── SKILL.md           # Required: YAML frontmatter + markdown instructions
```

### Full Skill with Supporting Files
```
my-skill/
├── SKILL.md           # Required: main instructions (keep under 500 lines)
├── template.md        # Optional: template for Claude to fill in
├── reference.md       # Optional: detailed API docs, loaded when needed
├── examples/
│   └── sample.md      # Optional: example output showing expected format
├── scripts/
│   └── validate.sh    # Optional: scripts Claude can execute
├── references/
│   └── REFERENCE.md   # Optional: detailed technical reference
└── assets/
    └── schema.json    # Optional: static resources, templates, data files
```

### Where Skills Live (Priority Order)

| Location | Path | Scope |
|----------|------|-------|
| Enterprise | Managed settings | All users in organization |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | All your projects |
| Project | `.claude/skills/<skill-name>/SKILL.md` | This project only |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | Where plugin is enabled |

Higher-priority locations win when names conflict: enterprise > personal > project.

---

## 3. SKILL.md Format: Frontmatter Reference

### Agent Skills Open Standard Fields (agentskills.io)

These fields are part of the cross-tool open standard supported by Claude Code, Cursor, Gemini CLI, Goose, Roo Code, VS Code Copilot, and 20+ other tools:

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes (in standard) / No (in Claude Code, defaults to directory name) | Max 64 chars. Lowercase letters, numbers, hyphens only. No starting/ending hyphens. No consecutive hyphens. Must match parent directory name. |
| `description` | Yes (in standard) / Recommended (in Claude Code) | Max 1024 chars. What the skill does AND when to use it. Claude uses this to decide when to auto-load. |
| `license` | No | License name or reference to bundled license file |
| `compatibility` | No | Max 500 chars. Environment requirements (packages, network, etc.) |
| `metadata` | No | Arbitrary key-value mapping for additional properties |
| `allowed-tools` | No (experimental) | Space-delimited list of pre-approved tools |

### Claude Code Extension Fields

These are additional fields Claude Code supports beyond the open standard:

| Field | Required | Description |
|-------|----------|-------------|
| `argument-hint` | No | Hint shown during autocomplete. Example: `[issue-number]` or `[filename] [format]` |
| `disable-model-invocation` | No | `true` = only user can invoke (prevents Claude from auto-triggering). Default: `false` |
| `user-invocable` | No | `false` = hidden from `/` menu (only Claude can invoke). Default: `true` |
| `model` | No | Force a specific model when this skill is active |
| `context` | No | Set to `fork` to run in an isolated subagent context |
| `agent` | No | Which subagent type to use with `context: fork` (e.g., `Explore`, `Plan`, `general-purpose`, or custom agent) |
| `hooks` | No | Hooks scoped to this skill's lifecycle |

### Invocation Control Matrix

| Frontmatter | User can invoke | Claude can invoke | Context loading |
|-------------|----------------|-------------------|-----------------|
| (default) | Yes | Yes | Description always in context; full skill loads when invoked |
| `disable-model-invocation: true` | Yes | No | Description NOT in context; loads only when user invokes |
| `user-invocable: false` | No | Yes | Description always in context; loads when Claude invokes |

---

## 4. SKILL.md Complete Example

### Minimal Skill
```yaml
---
name: explain-code
description: Explains code with visual diagrams and analogies. Use when explaining how code works.
---

When explaining code, always include:
1. Start with an analogy
2. Draw an ASCII diagram
3. Walk through step-by-step
4. Highlight a common gotcha
```

### Full-Featured Skill
```yaml
---
name: fix-issue
description: Fix a GitHub issue by number. Reads the issue, implements the fix, writes tests, and creates a commit.
disable-model-invocation: true
argument-hint: <issue-number>
allowed-tools: Bash(gh *), Read, Grep, Glob, Edit, Write
context: fork
agent: general-purpose
---

Fix GitHub issue $ARGUMENTS following our coding standards.

1. Read the issue description with `gh issue view $ARGUMENTS`
2. Understand the requirements
3. Find relevant code using Grep and Glob
4. Implement the fix
5. Write tests
6. Create a commit

## Additional resources
- For coding conventions, see [reference.md](reference.md)
- For test patterns, see [examples/test-patterns.md](examples/test-patterns.md)
```

---

## 5. String Substitutions

| Variable | Description |
|----------|-------------|
| `$ARGUMENTS` | All arguments passed when invoking the skill |
| `$ARGUMENTS[N]` | Specific argument by 0-based index (e.g., `$ARGUMENTS[0]`) |
| `$N` | Shorthand for `$ARGUMENTS[N]` (e.g., `$0`, `$1`, `$2`) |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_SKILL_DIR}` | Directory containing the skill's SKILL.md file |

If `$ARGUMENTS` is not present in skill content but arguments are passed, they are appended as `ARGUMENTS: <value>`.

---

## 6. Dynamic Context Injection

The `` !`command` `` syntax runs shell commands BEFORE the skill content is sent to Claude:

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
- Changed files: !`gh pr diff --name-only`

## Your task
Summarize this pull request...
```

The command output replaces the placeholder. Claude only sees the final rendered result.

---

## 7. Sharing Skills

### Method 1: Project Skills (Version Control)

Commit `.claude/skills/` to your repo. Anyone who clones the repo gets the skills automatically.

```
your-repo/
├── .claude/
│   └── skills/
│       ├── deploy/
│       │   └── SKILL.md
│       └── review/
│           └── SKILL.md
├── src/
└── ...
```

### Method 2: Plugin Distribution (Recommended for Sharing)

Package skills in a plugin for distribution via marketplaces.

#### Plugin Directory Structure
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Required: manifest with name, description, version
├── skills/                   # Skills with SKILL.md files
│   ├── code-review/
│   │   └── SKILL.md
│   └── deploy/
│       └── SKILL.md
├── commands/                 # Legacy command format (still works)
├── agents/                   # Custom agent definitions
├── hooks/
│   └── hooks.json           # Event handlers
├── .mcp.json                # MCP server configurations
├── .lsp.json                # LSP server configurations
└── settings.json            # Default settings
```

#### Plugin Manifest (`plugin.json`)
```json
{
  "name": "my-plugin",
  "description": "Description of what this plugin provides",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  }
}
```

#### Installing Plugins

```bash
# Test locally during development
claude --plugin-dir ./my-plugin

# Install from a marketplace
/plugin marketplace add owner/repo
/plugin install skill-name@marketplace-name

# Reload after changes
/reload-plugins
```

Plugin skills are namespaced: `/my-plugin:skill-name`

### Method 3: Managed Settings (Enterprise)

Deploy organization-wide through managed settings for enterprise distribution.

### Method 4: GitHub Repo as Marketplace

A GitHub repo can serve as a plugin marketplace. Users add the repo as a marketplace source and install plugins from it.

```bash
# User adds your repo as a marketplace
/plugin marketplace add your-org/your-skills-repo

# User installs a skill
/plugin install my-skill@your-skills-repo
```

---

## 8. The Agent Skills Open Standard

Claude Code skills follow the [Agent Skills](https://agentskills.io) open standard. This means skills are portable across 20+ tools including:

- Claude Code, Claude.ai
- Cursor, VS Code Copilot
- Gemini CLI, OpenAI Codex
- Roo Code, Goose, OpenHands
- JetBrains Junie, Amp, Spring AI
- And many more

The standard ensures a skill written once can work across multiple AI coding tools, though each tool may support additional extension fields.

### Standard Validation

Use the reference library to validate skills:
```bash
skills-ref validate ./my-skill
```

---

## 9. Progressive Disclosure (Performance)

Skills are designed for efficient context usage:

1. **Metadata (~100 tokens)**: `name` and `description` loaded at startup for ALL skills
2. **Instructions (<5000 tokens recommended)**: Full SKILL.md body loaded when skill is activated
3. **Resources (as needed)**: Supporting files loaded only when required

Keep SKILL.md under 500 lines. Move detailed reference material to separate files. The description character budget scales at 2% of the context window (fallback: 16,000 chars). Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET` env var.

---

## 10. Monorepo Support

Claude Code auto-discovers skills from nested `.claude/skills/` directories. If you're editing `packages/frontend/src/App.tsx`, it also looks for skills in `packages/frontend/.claude/skills/`.

Skills from `--add-dir` directories are also loaded automatically with live change detection.

---

## 11. Converting Commands to Skills

If you have existing `.claude/commands/` files:

1. Create a directory: `mkdir -p .claude/skills/my-skill`
2. Move the command: `mv .claude/commands/my-skill.md .claude/skills/my-skill/SKILL.md`
3. The frontmatter format is identical -- no changes needed
4. Optionally add supporting files to the skill directory

---

## 12. Anthropic Official Skills Repo

The official repo at [github.com/anthropics/skills](https://github.com/anthropics/skills) contains:

- **Creative & Design**: Art, music, design skills
- **Development & Technical**: Web testing, MCP server generation
- **Enterprise & Communication**: Business workflows, branding
- **Document Skills**: DOCX, PDF, PPTX, XLSX manipulation (source-available)

Install via:
```bash
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
```

---

## 13. Key Naming Conventions

- Skill directory name: `lowercase-with-hyphens` (max 64 chars)
- Must match the `name` field in frontmatter
- No uppercase, no underscores, no spaces
- No starting/ending hyphens, no consecutive hyphens
- The directory name becomes the `/slash-command` name

---

## 14. Bundled Skills (Built-in)

These ship with Claude Code:

| Skill | Purpose |
|-------|---------|
| `/batch <instruction>` | Parallel large-scale codebase changes via worktrees |
| `/claude-api` | Load Claude API reference for your language |
| `/debug [description]` | Troubleshoot your Claude Code session |
| `/loop [interval] <prompt>` | Run a prompt repeatedly on schedule |
| `/simplify [focus]` | Review and fix code quality issues |
