import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { render, screen, fireEvent } from '@testing-library/react';
expect.extend(matchers);
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../CommandPalette';
import type { Command } from '@/hooks/useCommands';

const mockCommands: Command[] = [
  {
    name: 'clear',
    description: 'Clear current chat',
    category: 'chat',
    shortcut: 'Cmd+L',
    execute: vi.fn(),
  },
  {
    name: 'new',
    description: 'Start a new session',
    category: 'chat',
    shortcut: 'Cmd+N',
    execute: vi.fn(),
  },
  {
    name: 'export',
    description: 'Export current session',
    category: 'tools',
    execute: vi.fn(),
  },
  {
    name: 'help',
    description: 'Show help and keyboard shortcuts',
    category: 'chat',
    shortcut: '?',
    execute: vi.fn(),
  },
  {
    name: 'compact',
    description: 'Compact conversation context',
    category: 'chat',
    execute: vi.fn(),
  },
];

function renderPalette(
  overrides: {
    filter?: string;
    onSelect?: (cmd: Command) => void;
    onClose?: () => void;
    commands?: Command[];
  } = {}
) {
  const props = {
    commands: overrides.commands ?? mockCommands,
    filter: overrides.filter ?? '',
    onSelect: overrides.onSelect ?? vi.fn(),
    onClose: overrides.onClose ?? vi.fn(),
  };
  return render(<CommandPalette {...props} />);
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -- Rendering --

  describe('Rendering', () => {
    it('renders all commands when no filter is applied', () => {
      renderPalette();
      for (const cmd of mockCommands) {
        expect(screen.getByText(`/${cmd.name}`)).toBeInTheDocument();
      }
    });

    it('displays command descriptions', () => {
      renderPalette();
      for (const cmd of mockCommands) {
        expect(screen.getByText(cmd.description)).toBeInTheDocument();
      }
    });

    it('displays keyboard shortcuts when available', () => {
      renderPalette();
      expect(screen.getByText('Cmd+L')).toBeInTheDocument();
      expect(screen.getByText('Cmd+N')).toBeInTheDocument();
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('has the command-palette test id', () => {
      renderPalette();
      expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    });
  });

  // -- Filtering --

  describe('Filtering', () => {
    it('filters commands by name prefix', () => {
      renderPalette({ filter: 'cl' });
      expect(screen.getByText('/clear')).toBeInTheDocument();
      expect(screen.queryByText('/new')).not.toBeInTheDocument();
      expect(screen.queryByText('/export')).not.toBeInTheDocument();
    });

    it('filters commands case-insensitively', () => {
      renderPalette({ filter: 'CL' });
      expect(screen.getByText('/clear')).toBeInTheDocument();
    });

    it('shows all commands when filter is empty', () => {
      renderPalette({ filter: '' });
      expect(screen.getAllByTestId('command-item')).toHaveLength(
        mockCommands.length
      );
    });

    it('shows no commands when filter matches nothing', () => {
      renderPalette({ filter: 'xyz' });
      expect(screen.queryByTestId('command-item')).not.toBeInTheDocument();
      expect(screen.getByText(/no commands/i)).toBeInTheDocument();
    });

    it('matches against description text too', () => {
      renderPalette({ filter: 'session' });
      // "new" has description "Start a new session", "export" has "Export current session"
      expect(screen.getByText('/new')).toBeInTheDocument();
      expect(screen.getByText('/export')).toBeInTheDocument();
      expect(screen.queryByText('/clear')).not.toBeInTheDocument();
    });

    it('supports fuzzy name matching', () => {
      renderPalette({ filter: 'cmpt' });
      expect(screen.getByText('/compact')).toBeInTheDocument();
      expect(screen.queryByText('/help')).not.toBeInTheDocument();
    });
  });

  // -- Keyboard Navigation --

  describe('Keyboard navigation', () => {
    it('highlights the first command by default', () => {
      renderPalette();
      const items = screen.getAllByTestId('command-item');
      expect(items[0]).toHaveAttribute('data-selected', 'true');
    });

    it('moves selection down with ArrowDown', async () => {
      const user = userEvent.setup();
      renderPalette();

      // Focus the palette container
      const palette = screen.getByTestId('command-palette');
      palette.focus();

      await user.keyboard('{ArrowDown}');

      const items = screen.getAllByTestId('command-item');
      expect(items[0]).toHaveAttribute('data-selected', 'false');
      expect(items[1]).toHaveAttribute('data-selected', 'true');
    });

    it('moves selection up with ArrowUp', async () => {
      const user = userEvent.setup();
      renderPalette();

      const palette = screen.getByTestId('command-palette');
      palette.focus();

      // Move down first, then up
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');

      const items = screen.getAllByTestId('command-item');
      expect(items[0]).toHaveAttribute('data-selected', 'true');
    });

    it('wraps around when pressing ArrowDown at the end', async () => {
      const user = userEvent.setup();
      renderPalette();

      const palette = screen.getByTestId('command-palette');
      palette.focus();

      // Press down for each command to wrap back to first
      for (let i = 0; i < mockCommands.length; i++) {
        await user.keyboard('{ArrowDown}');
      }

      const items = screen.getAllByTestId('command-item');
      expect(items[0]).toHaveAttribute('data-selected', 'true');
    });

    it('wraps around when pressing ArrowUp at the start', async () => {
      const user = userEvent.setup();
      renderPalette();

      const palette = screen.getByTestId('command-palette');
      palette.focus();

      await user.keyboard('{ArrowUp}');

      const items = screen.getAllByTestId('command-item');
      expect(items[mockCommands.length - 1]).toHaveAttribute(
        'data-selected',
        'true'
      );
    });

    it('selects command on Enter', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderPalette({ onSelect });

      const palette = screen.getByTestId('command-palette');
      palette.focus();

      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledWith(mockCommands[0]);
    });

    it('selects navigated command on Enter', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderPalette({ onSelect });

      const palette = screen.getByTestId('command-palette');
      palette.focus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      expect(onSelect).toHaveBeenCalledWith(mockCommands[1]);
    });

    it('calls onClose when Escape is pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderPalette({ onClose });

      const palette = screen.getByTestId('command-palette');
      palette.focus();

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // -- Mouse Interaction --

  describe('Mouse interaction', () => {
    it('selects command on click', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      renderPalette({ onSelect });

      await user.click(screen.getByText('/export'));
      expect(onSelect).toHaveBeenCalledWith(mockCommands[2]);
    });

    it('highlights command on mouse hover', async () => {
      const user = userEvent.setup();
      renderPalette();

      const thirdItem = screen.getAllByTestId('command-item')[2];
      await user.hover(thirdItem);

      expect(thirdItem).toHaveAttribute('data-selected', 'true');
    });
  });

  // -- Category Grouping --

  describe('Category grouping', () => {
    it('shows category headers', () => {
      const commandsWithCategories: Command[] = [
        { name: 'clear', description: 'Clear chat', category: 'chat', execute: vi.fn() },
        { name: 'settings', description: 'Open settings', category: 'navigation', execute: vi.fn() },
        { name: 'model', description: 'Switch model', category: 'tools', execute: vi.fn() },
      ];
      renderPalette({ commands: commandsWithCategories });
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Tools')).toBeInTheDocument();
    });

    it('groups commands under their category', () => {
      renderPalette();
      // mockCommands has chat: clear, new, help, compact; tools: export
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getByText('Tools')).toBeInTheDocument();
    });

    it('does not show empty category headers', () => {
      // Only chat commands in the list
      const chatOnly: Command[] = [
        { name: 'clear', description: 'Clear chat', category: 'chat', execute: vi.fn() },
      ];
      renderPalette({ commands: chatOnly });
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.queryByText('Navigation')).not.toBeInTheDocument();
      expect(screen.queryByText('Tools')).not.toBeInTheDocument();
    });

    it('keyboard navigation works across category boundaries', async () => {
      const user = userEvent.setup();
      const commandsMultiCat: Command[] = [
        { name: 'clear', description: 'Clear chat', category: 'chat', execute: vi.fn() },
        { name: 'model', description: 'Switch model', category: 'tools', execute: vi.fn() },
      ];
      renderPalette({ commands: commandsMultiCat });

      const palette = screen.getByTestId('command-palette');
      palette.focus();

      // First item (chat/clear) is selected
      let items = screen.getAllByTestId('command-item');
      expect(items[0]).toHaveAttribute('data-selected', 'true');

      // ArrowDown moves to second item (tools/model) across category boundary
      await user.keyboard('{ArrowDown}');
      items = screen.getAllByTestId('command-item');
      expect(items[1]).toHaveAttribute('data-selected', 'true');
    });
  });

  // -- Edge Cases --

  describe('Edge cases', () => {
    it('resets selection index when filter changes', () => {
      const { rerender } = render(
        <CommandPalette
          commands={mockCommands}
          filter=""
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />
      );

      // Re-render with a filter that shows fewer items
      rerender(
        <CommandPalette
          commands={mockCommands}
          filter="cl"
          onSelect={vi.fn()}
          onClose={vi.fn()}
        />
      );

      const items = screen.getAllByTestId('command-item');
      expect(items[0]).toHaveAttribute('data-selected', 'true');
    });

    it('does not crash with empty commands list', () => {
      renderPalette({ commands: [] });
      expect(screen.getByText(/no commands/i)).toBeInTheDocument();
    });
  });

  describe('Overflow affordance', () => {
    it('shows a bottom scroll hint when the palette content overflows', () => {
      const manyCommands: Command[] = Array.from({ length: 12 }, (_, index) => ({
        name: `cmd-${index}`,
        description: `Command ${index}`,
        category: index < 4 ? 'chat' : index < 8 ? 'navigation' : 'tools',
        execute: vi.fn(),
      }));

      renderPalette({ commands: manyCommands });

      const palette = screen.getByTestId('command-palette');
      Object.defineProperty(palette, 'scrollHeight', {
        configurable: true,
        value: 480,
      });
      Object.defineProperty(palette, 'clientHeight', {
        configurable: true,
        value: 240,
      });
      Object.defineProperty(palette, 'scrollTop', {
        configurable: true,
        value: 0,
        writable: true,
      });

      fireEvent.scroll(palette);

      expect(
        screen.getByTestId('command-palette-scroll-hint')
      ).toBeInTheDocument();
    });

    it('hides the bottom scroll hint when scrolled to the end', () => {
      const manyCommands: Command[] = Array.from({ length: 12 }, (_, index) => ({
        name: `cmd-${index}`,
        description: `Command ${index}`,
        category: index < 4 ? 'chat' : index < 8 ? 'navigation' : 'tools',
        execute: vi.fn(),
      }));

      renderPalette({ commands: manyCommands });

      const palette = screen.getByTestId('command-palette');
      Object.defineProperty(palette, 'scrollHeight', {
        configurable: true,
        value: 480,
      });
      Object.defineProperty(palette, 'clientHeight', {
        configurable: true,
        value: 240,
      });
      Object.defineProperty(palette, 'scrollTop', {
        configurable: true,
        value: 241,
        writable: true,
      });

      fireEvent.scroll(palette);

      expect(
        screen.queryByTestId('command-palette-scroll-hint')
      ).not.toBeInTheDocument();
    });
  });
});
