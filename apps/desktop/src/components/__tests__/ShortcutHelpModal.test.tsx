import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShortcutHelpModal } from '../ShortcutHelpModal';
import type { ShortcutDefinition } from '@/hooks/useKeyboardShortcuts';

const mockShortcuts: ShortcutDefinition[] = [
  {
    id: 'command-palette',
    key: 'K',
    meta: true,
    label: 'Command Palette',
    category: 'general',
    handler: vi.fn(),
  },
  {
    id: 'new-session',
    key: 'N',
    meta: true,
    label: 'New Session',
    category: 'chat',
    handler: vi.fn(),
  },
  {
    id: 'clear-chat',
    key: 'L',
    meta: true,
    label: 'Clear Chat',
    category: 'chat',
    handler: vi.fn(),
  },
  {
    id: 'submit',
    key: 'Enter',
    meta: true,
    label: 'Submit Message',
    category: 'chat',
    handler: vi.fn(),
  },
  {
    id: 'cancel',
    key: 'Escape',
    label: 'Cancel / Close',
    category: 'general',
    handler: vi.fn(),
  },
  {
    id: 'toggle-sidebar',
    key: '/',
    meta: true,
    label: 'Toggle Sidebar',
    category: 'navigation',
    handler: vi.fn(),
  },
  {
    id: 'help',
    key: '?',
    meta: true,
    shift: true,
    label: 'Show Help',
    category: 'general',
    handler: vi.fn(),
  },
];

describe('ShortcutHelpModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Rendering --

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
        />
      );
      expect(screen.getByTestId('shortcut-help-modal')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <ShortcutHelpModal
          isOpen={false}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
        />
      );
      expect(
        screen.queryByTestId('shortcut-help-modal')
      ).not.toBeInTheDocument();
    });

    it('displays a title', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
        />
      );
      expect(
        screen.getByText(/keyboard shortcuts/i)
      ).toBeInTheDocument();
    });
  });

  // -- Shortcut listing --

  describe('Shortcut listing', () => {
    it('displays all shortcut labels', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
        />
      );

      for (const shortcut of mockShortcuts) {
        expect(screen.getByText(shortcut.label)).toBeInTheDocument();
      }
    });

    it('displays shortcut key combinations', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
        />
      );

      // Should have kbd elements for each shortcut
      const kbdElements = screen.getAllByTestId('shortcut-kbd');
      expect(kbdElements.length).toBe(mockShortcuts.length);
    });
  });

  // -- Category grouping --

  describe('Category grouping', () => {
    it('groups shortcuts by category', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
        />
      );

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getByText('Navigation')).toBeInTheDocument();
    });

    it('shows shortcuts under their correct category', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
        />
      );

      // "Command Palette" should be in general section
      expect(screen.getByText('Command Palette')).toBeInTheDocument();
      // "New Session" should be in chat section
      expect(screen.getByText('New Session')).toBeInTheDocument();
      // "Toggle Sidebar" should be in navigation section
      expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument();
    });
  });

  // -- Closing --

  describe('Closing', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={onClose}
          shortcuts={mockShortcuts}
        />
      );

      const closeButton = screen.getByTestId('shortcut-help-close');
      await user.click(closeButton);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={onClose}
          shortcuts={mockShortcuts}
        />
      );

      const backdrop = screen.getByTestId('shortcut-help-backdrop');
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // -- Platform awareness --

  describe('Platform awareness', () => {
    it('shows Mac symbols when isMac is true', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
          isMac={true}
        />
      );

      // Should contain the Cmd symbol somewhere
      const modal = screen.getByTestId('shortcut-help-modal');
      expect(modal.textContent).toContain('\u2318');
    });

    it('shows Ctrl when isMac is false', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={mockShortcuts}
          isMac={false}
        />
      );

      const modal = screen.getByTestId('shortcut-help-modal');
      expect(modal.textContent).toContain('Ctrl');
    });
  });

  // -- Empty state --

  describe('Edge cases', () => {
    it('handles empty shortcuts array', () => {
      render(
        <ShortcutHelpModal
          isOpen={true}
          onClose={vi.fn()}
          shortcuts={[]}
        />
      );

      expect(screen.getByTestId('shortcut-help-modal')).toBeInTheDocument();
      expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
    });
  });
});
