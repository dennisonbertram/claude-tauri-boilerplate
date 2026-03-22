/**
 * Structured setup contract for workspace initialization.
 *
 * Replaces free-form shell commands with typed, validated setup steps.
 * Each step declares its intent so the orchestrator can validate safety
 * before execution.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SetupStepType = 'npm_install' | 'git_submodules' | 'env_file' | 'custom';

export interface SetupStep {
  /** The kind of operation this step performs. */
  type: SetupStepType;
  /**
   * Shell command to run.  Required for `custom` steps.
   * For well-known types the command is derived automatically when omitted:
   *   npm_install   -> "npm install"
   *   git_submodules -> "git submodule update --init --recursive"
   *   env_file      -> "cp .env.example .env"
   */
  command?: string;
  /** Optional human-readable label shown in logs / UI. */
  label?: string;
}

export interface SetupContract {
  steps: SetupStep[];
}

// ---------------------------------------------------------------------------
// Dangerous-pattern detection
// ---------------------------------------------------------------------------

/**
 * Patterns that must never appear in a setup command.
 * Each entry is [regex, human-readable reason].
 */
const DANGEROUS_PATTERNS: [RegExp, string][] = [
  [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--force\b|--recursive\b|-[a-zA-Z]*f[a-zA-Z]*r)\b/, 'rm with recursive/force flags'],
  [/\brm\s+-rf\s+\//, 'rm -rf /'],
  [/\|\s*(ba)?sh\b/, 'piping into sh/bash'],
  [/\|\s*zsh\b/, 'piping into zsh'],
  [/\bcurl\b.*\|\s*(ba)?sh/, 'curl piped to shell'],
  [/\bwget\b.*\|\s*(ba)?sh/, 'wget piped to shell'],
  [/\bcurl\b.*\|\s*zsh/, 'curl piped to zsh'],
  [/\bwget\b.*\|\s*zsh/, 'wget piped to zsh'],
  [/\beval\s/, 'eval execution'],
  [/\bsudo\b/, 'sudo usage'],
  [/\bchmod\s+[0-7]*7[0-7]*\s/, 'world-writable chmod'],
  [/\bmkfs\b/, 'filesystem format command'],
  [/\bdd\s+.*of=\/dev\//, 'dd writing to device'],
  [/>\s*\/dev\/[sh]d[a-z]/, 'redirect to block device'],
  [/\bpython[23]?\s+-c\b/, 'inline python execution'],
  [/\bnode\s+-e\b/, 'inline node execution'],
  [/\bperl\s+-e\b/, 'inline perl execution'],
];

/**
 * Known-safe command prefixes for well-known step types.
 */
const SAFE_COMMAND_PREFIXES: Record<Exclude<SetupStepType, 'custom'>, RegExp> = {
  npm_install: /^(npm|pnpm|yarn|bun)\s+(install|ci|i)\b/,
  git_submodules: /^git\s+submodule\s+(update|init|sync)\b/,
  env_file: /^cp\s+/,
};

/**
 * Default commands used when a well-known step omits its command.
 */
const DEFAULT_COMMANDS: Record<Exclude<SetupStepType, 'custom'>, string> = {
  npm_install: 'npm install',
  git_submodules: 'git submodule update --init --recursive',
  env_file: 'cp .env.example .env',
};

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a single setup command string against the blocklist.
 * Returns `{ valid, errors, warnings }`.
 */
export function validateCommand(command: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const trimmed = command.trim();
  if (!trimmed) {
    errors.push('Empty command');
    return { valid: false, errors, warnings };
  }

  for (const [pattern, reason] of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      errors.push(`Blocked dangerous pattern: ${reason}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a single SetupStep.  For well-known types the resolved command is
 * also checked against the expected prefix; mismatches are warnings (the step
 * still runs if it passes the blocklist).
 */
export function validateStep(step: SetupStep): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Custom steps require a command
  if (step.type === 'custom' && !step.command) {
    errors.push('Custom setup step requires a command');
    return { valid: false, errors, warnings };
  }

  const resolvedCommand = resolveCommand(step);

  // Run blocklist check
  const cmdResult = validateCommand(resolvedCommand);
  errors.push(...cmdResult.errors);
  warnings.push(...cmdResult.warnings);

  // For well-known types, warn if the command deviates from expected prefix
  if (step.type !== 'custom' && step.command) {
    const expected = SAFE_COMMAND_PREFIXES[step.type];
    if (!expected.test(step.command.trim())) {
      warnings.push(
        `Step type '${step.type}' has unexpected command: ${step.command}. ` +
        `Expected a command matching ${expected}`
      );
    }
  }

  // Custom commands always get a warning
  if (step.type === 'custom') {
    warnings.push(`Custom setup command will be executed: ${resolvedCommand}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate an entire SetupContract.
 */
export function validateSetupContract(contract: SetupContract): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!contract.steps || contract.steps.length === 0) {
    // Empty contract is valid — nothing to run
    return { valid: true, errors, warnings };
  }

  for (let i = 0; i < contract.steps.length; i++) {
    const step = contract.steps[i];
    const result = validateStep(step);
    for (const e of result.errors) {
      errors.push(`Step ${i + 1} (${step.type}): ${e}`);
    }
    for (const w of result.warnings) {
      warnings.push(`Step ${i + 1} (${step.type}): ${w}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective shell command for a step, filling in defaults for
 * well-known types when `command` is omitted.
 */
export function resolveCommand(step: SetupStep): string {
  if (step.command) {
    return step.command;
  }
  if (step.type !== 'custom') {
    return DEFAULT_COMMANDS[step.type];
  }
  // Should never happen if validateStep is called first
  return '';
}

/**
 * Convert a legacy free-form command string into a single-step SetupContract
 * so existing configs continue to work.
 */
export function legacyCommandToContract(command: string): SetupContract {
  const trimmed = command.trim();

  // Try to match against well-known types
  for (const [type, pattern] of Object.entries(SAFE_COMMAND_PREFIXES) as [Exclude<SetupStepType, 'custom'>, RegExp][]) {
    if (pattern.test(trimmed)) {
      return { steps: [{ type, command: trimmed }] };
    }
  }

  // Fall back to custom
  return { steps: [{ type: 'custom', command: trimmed }] };
}
