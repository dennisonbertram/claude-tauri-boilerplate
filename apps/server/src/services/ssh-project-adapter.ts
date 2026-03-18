import type { SshProjectLocation } from '@claude-tauri/shared';
import type { ProjectAdapter } from './project-adapter';

/**
 * SSH ProjectAdapter stub.
 *
 * This class defines the interface contract for remote SSH projects but does
 * NOT yet implement any actual SSH connectivity. Every method throws
 * "SSH adapter not yet implemented" to make the gap explicit.
 *
 * Follow-up work required before this can be used:
 *   1. Host-key verification + trust-on-first-use (TOFU) flow
 *   2. Persistent SSH multiplexed connection (ControlMaster)
 *   3. SFTP session for file reads and directory listings
 *   4. Remote exec via SSH channel
 *   5. Secure storage of known-host fingerprints per project
 */
export class SshProjectAdapter implements ProjectAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_location: SshProjectLocation) {
    // Stored for future implementation. Currently unused.
  }

  async checkAccess(): Promise<{ accessible: boolean; error?: string }> {
    throw new Error(
      'SSH adapter not yet implemented: requires host-key verification setup'
    );
  }

  async resolvePath(_relativePath: string): Promise<string> {
    throw new Error(
      'SSH adapter not yet implemented: requires host-key verification setup'
    );
  }

  async exec(
    _command: string,
    _args: string[],
    _options?: { env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    throw new Error(
      'SSH adapter not yet implemented: requires host-key verification setup'
    );
  }

  async listDir(_relativePath?: string): Promise<string[]> {
    throw new Error(
      'SSH adapter not yet implemented: requires host-key verification setup'
    );
  }

  async readFile(_relativePath: string): Promise<string> {
    throw new Error(
      'SSH adapter not yet implemented: requires host-key verification setup'
    );
  }

  async exists(_relativePath: string): Promise<boolean> {
    throw new Error(
      'SSH adapter not yet implemented: requires host-key verification setup'
    );
  }
}
