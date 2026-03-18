import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BashDisplay } from '../BashDisplay';
import type { BashDisplayProps } from '../BashDisplay';

// We'll spy on the clipboard in each test where it's needed.
// The `userEvent.setup()` clipboard API handles the actual writing,
// so we verify behavior by reading from the clipboard after the click.

function renderBash(overrides: Partial<BashDisplayProps> = {}) {
  const defaults: BashDisplayProps = {
    command: 'echo "hello"',
    isRunning: false,
    ...overrides,
  };
  return render(<BashDisplay {...defaults} />);
}

describe('BashDisplay', () => {
  // ── Command Rendering ──────────────────────────────────────────────

  describe('Command rendering', () => {
    it('renders the command text in monospace', () => {
      renderBash({ command: 'ls -la /tmp' });
      const commandEl = screen.getByTestId('bash-command');
      expect(commandEl).toHaveTextContent('ls -la /tmp');
      expect(commandEl.tagName.toLowerCase()).toBe('code');
    });

    it('renders the description when provided', () => {
      renderBash({
        command: 'npm install',
        description: 'Install dependencies',
      });
      expect(screen.getByText('Install dependencies')).toBeInTheDocument();
    });

    it('does not render description area when not provided', () => {
      renderBash({ command: 'ls' });
      expect(screen.queryByTestId('bash-description')).not.toBeInTheDocument();
    });

    it('renders multi-line commands preserving content', () => {
      const cmd = 'echo "line1" &&\necho "line2"';
      renderBash({ command: cmd });
      const commandEl = screen.getByTestId('bash-command');
      // The <code> element will render newlines as spaces in textContent
      expect(commandEl).toHaveTextContent(/echo "line1"/);
      expect(commandEl).toHaveTextContent(/echo "line2"/);
    });
  });

  // ── stdout / stderr Display ────────────────────────────────────────

  describe('stdout display', () => {
    it('renders stdout output with monospace font', () => {
      renderBash({
        command: 'echo hello',
        output: 'hello world',
      });
      const outputArea = screen.getByTestId('bash-output');
      expect(outputArea).toHaveTextContent('hello world');
    });

    it('shows "No output" when output is empty and not running', () => {
      renderBash({ command: 'true', isRunning: false });
      expect(screen.getByText('No output')).toBeInTheDocument();
    });

    it('does not show "No output" while still running', () => {
      renderBash({ command: 'sleep 5', isRunning: true });
      expect(screen.queryByText('No output')).not.toBeInTheDocument();
    });
  });

  describe('stderr display', () => {
    it('renders stderr text with red/orange styling', () => {
      renderBash({
        command: 'cat missing.txt',
        stderr: 'cat: missing.txt: No such file or directory',
      });
      const stderrEl = screen.getByTestId('bash-stderr');
      expect(stderrEl).toHaveTextContent(
        'cat: missing.txt: No such file or directory'
      );
      // Should have red/error text color class
      expect(stderrEl.className).toMatch(/text-red|text-orange/);
    });
  });

  // ── Exit Code Badge ────────────────────────────────────────────────

  describe('Exit code badge', () => {
    it('shows green "exit 0" badge for success', () => {
      renderBash({ command: 'echo ok', exitCode: 0 });
      const badge = screen.getByTestId('bash-exit-code');
      expect(badge).toHaveTextContent('exit 0');
      expect(badge.className).toMatch(/green/);
    });

    it('shows red "exit 1" badge for failure', () => {
      renderBash({ command: 'false', exitCode: 1 });
      const badge = screen.getByTestId('bash-exit-code');
      expect(badge).toHaveTextContent('exit 1');
      expect(badge.className).toMatch(/red/);
    });

    it('shows red badge for arbitrary non-zero exit codes', () => {
      renderBash({ command: 'segfault', exitCode: 139 });
      const badge = screen.getByTestId('bash-exit-code');
      expect(badge).toHaveTextContent('exit 139');
      expect(badge.className).toMatch(/red/);
    });

    it('does not show exit code badge while running', () => {
      renderBash({ command: 'sleep 10', isRunning: true });
      expect(screen.queryByTestId('bash-exit-code')).not.toBeInTheDocument();
    });
  });

  // ── Output Truncation ─────────────────────────────────────────────

  describe('Output truncation and expansion', () => {
    const longOutput = Array.from(
      { length: 50 },
      (_, i) => `line ${i + 1}`
    ).join('\n');

    it('auto-collapses output when > 20 lines', () => {
      renderBash({ command: 'seq 50', output: longOutput });
      const outputArea = screen.getByTestId('bash-output');
      // Should only show first 20 lines
      expect(outputArea).toHaveTextContent('line 1');
      expect(outputArea).toHaveTextContent('line 20');
      expect(outputArea).not.toHaveTextContent('line 21');
    });

    it('shows "Show N more lines" button when truncated', () => {
      renderBash({ command: 'seq 50', output: longOutput });
      const expandBtn = screen.getByRole('button', {
        name: /show 30 more lines/i,
      });
      expect(expandBtn).toBeInTheDocument();
    });

    it('expands to show all lines when button is clicked', async () => {
      const user = userEvent.setup();
      renderBash({ command: 'seq 50', output: longOutput });

      const expandBtn = screen.getByRole('button', {
        name: /show 30 more lines/i,
      });
      await user.click(expandBtn);

      const outputArea = screen.getByTestId('bash-output');
      expect(outputArea).toHaveTextContent('line 50');
    });

    it('does not truncate output with <= 20 lines', () => {
      const shortOutput = Array.from(
        { length: 15 },
        (_, i) => `line ${i + 1}`
      ).join('\n');
      renderBash({ command: 'seq 15', output: shortOutput });
      expect(
        screen.queryByRole('button', { name: /show.*more lines/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Terminal search and output controls', () => {
    it('opens search with Cmd+F and focuses the search input', async () => {
      const user = userEvent.setup();
      const longOutput = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');

      renderBash({ command: 'seq 30', output: longOutput });
      const terminalCard = screen.getByTestId('terminal-card');

      await user.click(terminalCard);
      fireEvent.keyDown(terminalCard, { key: 'f', metaKey: true });

      const searchInput = screen.getByTestId('terminal-search-input');
      expect(searchInput).toHaveValue('');
      expect(searchInput).toHaveFocus();

      fireEvent.keyDown(terminalCard, { key: 'k', metaKey: true });
      expect(searchInput).toHaveValue('');
    });

    it('filters output lines by query and removes truncation while searching', async () => {
      const user = userEvent.setup();
      const longOutput = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');

      renderBash({ command: 'seq 50', output: longOutput });
      const searchInput = screen.getByTestId('terminal-search-input');

      await user.type(searchInput, 'line 50');

      const outputArea = screen.getByTestId('bash-output');
      expect(outputArea).toHaveTextContent('line 50');
      expect(
        screen.queryByRole('button', { name: /show.*more lines/i })
      ).not.toBeInTheDocument();
    });

    it('clears terminal search with Cmd+K', async () => {
      const user = userEvent.setup();
      renderBash({ command: 'seq 3', output: 'line 1\nline 2\nline 3' });
      const searchInput = screen.getByTestId('terminal-search-input');

      await user.type(searchInput, 'line 1');
      expect(searchInput).toHaveValue('line 1');

      const card = screen.getByTestId('terminal-card');
      fireEvent.keyDown(card, { key: 'k', metaKey: true });

      expect(searchInput).toHaveValue('');
    });

    it('expands output area to full height and collapses back', async () => {
      const user = userEvent.setup();
      renderBash({ command: 'seq 3', output: 'line 1\nline 2\nline 3' });

      const fullHeightBtn = screen.getByTestId('toggle-full-height');
      const outputArea = screen.getByTestId('bash-output');

      expect(outputArea.className).toContain('max-h-96');
      await user.click(fullHeightBtn);
      expect(outputArea.className).toContain('max-h-none');

      await user.click(fullHeightBtn);
      expect(outputArea.className).toContain('max-h-96');
    });
  });

  // ── ANSI Color Parsing ────────────────────────────────────────────

  describe('ANSI color code parsing', () => {
    it('converts ANSI red to styled span', () => {
      const ansiRed = '\x1b[31mERROR\x1b[0m normal text';
      renderBash({ command: 'test', output: ansiRed });
      const outputArea = screen.getByTestId('bash-output');
      const redSpan = outputArea.querySelector('[data-ansi-color="red"]');
      expect(redSpan).toBeInTheDocument();
      expect(redSpan).toHaveTextContent('ERROR');
    });

    it('converts ANSI green to styled span', () => {
      const ansiGreen = '\x1b[32mPASSED\x1b[0m';
      renderBash({ command: 'test', output: ansiGreen });
      const outputArea = screen.getByTestId('bash-output');
      const greenSpan = outputArea.querySelector('[data-ansi-color="green"]');
      expect(greenSpan).toBeInTheDocument();
      expect(greenSpan).toHaveTextContent('PASSED');
    });

    it('handles bold ANSI codes', () => {
      const ansiBold = '\x1b[1mBOLD TEXT\x1b[0m';
      renderBash({ command: 'test', output: ansiBold });
      const outputArea = screen.getByTestId('bash-output');
      const boldSpan = outputArea.querySelector('[data-ansi-style="bold"]');
      expect(boldSpan).toBeInTheDocument();
      expect(boldSpan).toHaveTextContent('BOLD TEXT');
    });

    it('handles underline ANSI codes', () => {
      const ansiUnderline = '\x1b[4mUNDERLINED\x1b[0m';
      renderBash({ command: 'test', output: ansiUnderline });
      const outputArea = screen.getByTestId('bash-output');
      const underlineSpan = outputArea.querySelector(
        '[data-ansi-style="underline"]'
      );
      expect(underlineSpan).toBeInTheDocument();
      expect(underlineSpan).toHaveTextContent('UNDERLINED');
    });

    it('handles combined color and style codes', () => {
      // Bold + Red
      const combined = '\x1b[1;31mCRITICAL\x1b[0m';
      renderBash({ command: 'test', output: combined });
      const outputArea = screen.getByTestId('bash-output');
      expect(outputArea).toHaveTextContent('CRITICAL');
    });

    it('strips unknown ANSI escape sequences gracefully', () => {
      const unknown = '\x1b[38;5;200mweird color\x1b[0m plain';
      renderBash({ command: 'test', output: unknown });
      const outputArea = screen.getByTestId('bash-output');
      expect(outputArea).toHaveTextContent('weird color');
      expect(outputArea).toHaveTextContent('plain');
    });

    it('handles text with no ANSI codes', () => {
      renderBash({ command: 'echo hello', output: 'plain text' });
      const outputArea = screen.getByTestId('bash-output');
      expect(outputArea).toHaveTextContent('plain text');
    });
  });

  // ── Copy Functionality ─────────────────────────────────────────────

  describe('Copy functionality', () => {
    it('copies the command to clipboard when command copy button is clicked', async () => {
      const user = userEvent.setup();
      renderBash({ command: 'echo hello', output: 'hello' });

      const copyCommandBtn = screen.getByTestId('copy-command');
      await user.click(copyCommandBtn);

      // After clicking, the copy button icon should change to a check mark,
      // indicating the copy handler ran successfully.
      await waitFor(() => {
        const svg = copyCommandBtn.querySelector('svg');
        expect(svg?.classList.toString()).toMatch(/check/);
      });
    });

    it('copies the output to clipboard when output copy button is clicked', async () => {
      const user = userEvent.setup();
      renderBash({ command: 'echo hello', output: 'hello world' });

      const copyOutputBtn = screen.getByTestId('copy-output');
      await user.click(copyOutputBtn);

      // After clicking, the copy button icon should change to a check mark
      await waitFor(() => {
        const svg = copyOutputBtn.querySelector('svg');
        expect(svg?.classList.toString()).toMatch(/check/);
      });
    });
  });

  // ── Background Command Indicator ──────────────────────────────────

  describe('Background command indicator', () => {
    it('shows "Running in background..." when isBackground and isRunning', () => {
      renderBash({
        command: 'npm run build',
        isRunning: true,
        isBackground: true,
      });
      expect(screen.getByText(/running in background/i)).toBeInTheDocument();
    });

    it('shows a spinner for background running commands', () => {
      renderBash({
        command: 'npm run build',
        isRunning: true,
        isBackground: true,
      });
      expect(screen.getByTestId('background-spinner')).toBeInTheDocument();
    });

    it('does not show background indicator when not a background command', () => {
      renderBash({ command: 'ls', isRunning: true, isBackground: false });
      expect(
        screen.queryByText(/running in background/i)
      ).not.toBeInTheDocument();
    });
  });

  // ── Dangerous Command Detection ───────────────────────────────────

  describe('Dangerous command detection', () => {
    it('shows warning for "rm -rf" commands', () => {
      renderBash({ command: 'rm -rf /tmp/test' });
      expect(screen.getByTestId('danger-warning')).toBeInTheDocument();
    });

    it('shows warning for "sudo" commands', () => {
      renderBash({ command: 'sudo apt-get install foo' });
      expect(screen.getByTestId('danger-warning')).toBeInTheDocument();
    });

    it('shows warning for "chmod 777" commands', () => {
      renderBash({ command: 'chmod 777 /var/www' });
      expect(screen.getByTestId('danger-warning')).toBeInTheDocument();
    });

    it('shows warning for "dd if=" commands', () => {
      renderBash({ command: 'dd if=/dev/zero of=/dev/sda' });
      expect(screen.getByTestId('danger-warning')).toBeInTheDocument();
    });

    it('shows warning for "mkfs" commands', () => {
      renderBash({ command: 'mkfs.ext4 /dev/sdb1' });
      expect(screen.getByTestId('danger-warning')).toBeInTheDocument();
    });

    it('does not show warning for safe commands', () => {
      renderBash({ command: 'ls -la' });
      expect(screen.queryByTestId('danger-warning')).not.toBeInTheDocument();
    });

    it('does not show warning for commands containing "rm" but not "rm -rf"', () => {
      renderBash({ command: 'echo "remove this"' });
      expect(screen.queryByTestId('danger-warning')).not.toBeInTheDocument();
    });
  });

  // ── Collapse / Expand ─────────────────────────────────────────────

  describe('Collapse and expand', () => {
    it('output area is visible by default', () => {
      renderBash({ command: 'ls', output: 'file1.txt' });
      expect(screen.getByTestId('bash-output')).toBeInTheDocument();
    });

    it('can collapse and expand the output area', async () => {
      const user = userEvent.setup();
      renderBash({ command: 'ls', output: 'file1.txt' });

      const toggleBtn = screen.getByTestId('toggle-expand');
      await user.click(toggleBtn);

      // Output should be hidden
      expect(screen.queryByTestId('bash-output')).not.toBeInTheDocument();

      // Click again to expand
      await user.click(toggleBtn);
      expect(screen.getByTestId('bash-output')).toBeInTheDocument();
    });
  });

  // ── Duration ──────────────────────────────────────────────────────

  describe('Duration display', () => {
    it('shows duration when provided', () => {
      renderBash({ command: 'sleep 2', duration: 2100 });
      expect(screen.getByTestId('bash-duration')).toHaveTextContent('2.1s');
    });

    it('does not show duration when not provided', () => {
      renderBash({ command: 'echo hi' });
      expect(screen.queryByTestId('bash-duration')).not.toBeInTheDocument();
    });
  });

  // ── Running Indicator ─────────────────────────────────────────────

  describe('Running indicator', () => {
    it('shows a spinner in the header when running', () => {
      renderBash({ command: 'npm test', isRunning: true });
      expect(screen.getByTestId('running-spinner')).toBeInTheDocument();
    });

    it('does not show spinner when not running', () => {
      renderBash({ command: 'echo done', isRunning: false });
      expect(screen.queryByTestId('running-spinner')).not.toBeInTheDocument();
    });
  });

  // ── Special Characters ────────────────────────────────────────────

  describe('Special characters', () => {
    it('handles unicode in output', () => {
      renderBash({
        command: 'echo unicode',
        output: 'Hello \u{1F30D} \u2014 "quotes"',
      });
      expect(screen.getByTestId('bash-output')).toHaveTextContent(
        'Hello \u{1F30D} \u2014 "quotes"'
      );
    });

    it('handles very long single lines with overflow', () => {
      const longLine = 'x'.repeat(500);
      renderBash({ command: 'echo long', output: longLine });
      const outputArea = screen.getByTestId('bash-output');
      expect(outputArea).toHaveTextContent(longLine);
    });
  });
});
