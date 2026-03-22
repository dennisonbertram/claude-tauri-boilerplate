/**
 * Setup command validator for structured setup contracts.
 *
 * Provides command-level validation that complements the contract-level
 * validation in setup-contract.ts.  This module focuses on blocking
 * dangerous patterns and shell-injection vectors in individual command
 * strings, and identifying known-safe commands that need no further review.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetupStepType = 'npm_install' | 'git_submodules' | 'env_copy' | 'custom';

export interface SetupCommandValidation {
  valid: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Dangerous command patterns (destructive / privilege-escalation)
// ---------------------------------------------------------------------------

const DANGEROUS_PATTERNS: [RegExp, string][] = [
  [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--force\b|--recursive\b|-[a-zA-Z]*f[a-zA-Z]*r)\b/, 'rm with recursive/force flags'],
  [/\brm\s+-rf\s+\//, 'rm -rf /'],
  [/\bcurl\b.*\|\s*(ba)?sh/, 'curl piped to shell'],
  [/\bwget\b.*\|\s*(ba)?sh/, 'wget piped to shell'],
  [/\bcurl\b.*\|\s*zsh/, 'curl piped to zsh'],
  [/\bwget\b.*\|\s*zsh/, 'wget piped to zsh'],
  [/\|\s*(ba)?sh\b/, 'piping into sh/bash'],
  [/\|\s*zsh\b/, 'piping into zsh'],
  [/:\(\)\s*\{/, 'fork bomb pattern'],
  [/>\s*\/dev\//, 'redirect to /dev/ device'],
  [/\bchmod\s+777\b/, 'chmod 777'],
  [/\bsudo\b/, 'sudo usage'],
  [/\beval\s/, 'eval execution'],
  [/\bmkfs\b/, 'filesystem format command'],
  [/\bdd\s+.*of=\/dev\//, 'dd writing to device'],
];

// ---------------------------------------------------------------------------
// Shell injection patterns
// ---------------------------------------------------------------------------

const SHELL_INJECTION_PATTERNS: [RegExp, string][] = [
  [/;/, 'semicolon (command chaining)'],
  [/&&/, 'double ampersand (command chaining)'],
  [/\|\|/, 'double pipe (command chaining)'],
  [/`/, 'backtick (command substitution)'],
  [/\$\(/, '$() (command substitution)'],
];

// ---------------------------------------------------------------------------
// Known-safe command patterns
// ---------------------------------------------------------------------------

const KNOWN_SAFE_PATTERNS: RegExp[] = [
  // npm / pnpm / yarn / bun install variants
  /^(npm|pnpm|yarn|bun)\s+(install|ci|i)(\s+--[a-zA-Z-]+=?\S*)*\s*$/,
  // git submodule commands
  /^git\s+submodule\s+(update|init|sync)(\s+--[a-zA-Z-]+)*\s*$/,
  // cp .env patterns  (cp .env.example .env, cp .env.template .env.local, etc.)
  /^cp\s+\.env[\w.-]*\s+\.env[\w.-]*\s*$/,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a setup command string.
 *
 * Checks for:
 * 1. Dangerous destructive patterns (rm -rf, curl|sh, sudo, etc.)
 * 2. Shell injection patterns (;, &&, ||, backticks, $())
 *
 * Returns `{ valid: true }` when the command is acceptable, or
 * `{ valid: false, reason }` describing why it was rejected.
 */
export function validateSetupCommand(cmd: string): SetupCommandValidation {
  const trimmed = cmd.trim();

  if (!trimmed) {
    return { valid: false, reason: 'Empty command' };
  }

  // Check dangerous patterns first
  for (const [pattern, reason] of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: `Blocked dangerous pattern: ${reason}` };
    }
  }

  // Check shell injection patterns
  for (const [pattern, reason] of SHELL_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: `Blocked shell injection: ${reason}` };
    }
  }

  return { valid: true };
}

/**
 * Check whether a command is a known-safe operation that needs no
 * further review.  Known-safe commands include:
 * - npm/pnpm/yarn/bun install
 * - git submodule update/init/sync
 * - cp .env.example .env (and similar .env copy patterns)
 */
export function isKnownSafeCommand(cmd: string): boolean {
  const trimmed = cmd.trim();
  return KNOWN_SAFE_PATTERNS.some((pattern) => pattern.test(trimmed));
}
