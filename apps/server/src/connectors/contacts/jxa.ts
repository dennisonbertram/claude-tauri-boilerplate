/**
 * JXA (JavaScript for Automation) helper for running osascript.
 * Extracted into its own module so tests can mock it cleanly.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function runJxa(script: string): Promise<string> {
  const { stdout } = await execFileAsync('osascript', ['-l', 'JavaScript', '-e', script], {
    timeout: 10_000,
  });
  return stdout.trim();
}
