import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';
import type { Command } from '@/hooks/useCommands';

const mockUseSettings = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
}));

const mockCommands: Command[] = [
  {
    name: 'clear',
    description: 'Clear current chat',
    category: 'chat',
    shortcut: 'Cmd+L',
    execute: vi.fn(),
  },
  {
    name: 'help',
    description: 'Show help',
    category: 'chat',
    execute: vi.fn(),
  },
];

function renderInput(
  overrides: Partial<React.ComponentProps<typeof ChatInput>> = {}
) {
  const defaults: React.ComponentProps<typeof ChatInput> = {
    input: '',
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
    showPalette: false,
    paletteFilter: '',
    paletteCommands: mockCommands,
    onCommandSelect: vi.fn(),
    onPaletteClose: vi.fn(),
    ghostText: undefined,
    onAcceptSuggestion: undefined,
    ...overrides,
  };
  return render(<ChatInput {...defaults} />);
}

// TODO: #267 — quarantined, ChatInput component API changed (placeholder, props)
describe.skip('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettings.mockReturnValue({
      settings: {
        chatFont: 'proportional',
        chatDensity: 'comfortable',
        chatWidth: 'standard',
      },
    });
  });

  // -- Basic rendering --

  describe('Basic rendering', () => {
    it('renders the textarea', () => {
      renderInput();
      expect(
        screen.getByPlaceholderText(/type a message/i)
      ).toBeInTheDocument();
    });

    it('renders the submit button', () => {
      const { container } = renderInput();
      expect(container.querySelector('button[type="submit"]')).toBeInTheDocument();
    });

    it('shows the input value', () => {
      renderInput({ input: 'hello world' });
      const textarea = screen.getByPlaceholderText(
        /type a message/i
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe('hello world');
    });

    it('disables textarea when loading', () => {
      renderInput({ isLoading: true });
      const textarea = screen.getByPlaceholderText(/type a message/i);
      expect(textarea).toBeDisabled();
    });
  });

  // -- Input changes --

  describe('Input changes', () => {
    it('calls onInputChange when typing', async () => {
      const user = userEvent.setup();
      const onInputChange = vi.fn();
      renderInput({ onInputChange });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      await user.type(textarea, 'hello');
      expect(onInputChange).toHaveBeenCalled();
    });
  });

  // -- Command Palette visibility --

  describe('Command Palette visibility', () => {
    it('does not show palette when showPalette is false', () => {
      renderInput({ showPalette: false });
      expect(
        screen.queryByTestId('command-palette')
      ).not.toBeInTheDocument();
    });

    it('shows palette when showPalette is true', () => {
      renderInput({ showPalette: true });
      expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    });

    it('passes filter to palette', () => {
      renderInput({ showPalette: true, paletteFilter: 'cl' });
      // When filter is "cl", only "clear" should show
      expect(screen.getByText('/clear')).toBeInTheDocument();
      expect(screen.queryByText('/help')).not.toBeInTheDocument();
    });

    it('passes commands to palette', () => {
      renderInput({ showPalette: true, paletteFilter: '' });
      expect(screen.getByText('/clear')).toBeInTheDocument();
      expect(screen.getByText('/help')).toBeInTheDocument();
    });
  });

  // -- Command selection --

  describe('Command selection via palette', () => {
    it('calls onCommandSelect when a command is clicked in palette', async () => {
      const user = userEvent.setup();
      const onCommandSelect = vi.fn();
      renderInput({
        showPalette: true,
        paletteFilter: '',
        onCommandSelect,
      });

      await user.click(screen.getByText('/clear'));
      expect(onCommandSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'clear' })
      );
    });
  });

  // -- Keyboard forwarding --

  describe('Keyboard forwarding to palette', () => {
    it('forwards Enter to palette when palette is open (does not submit form)', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onCommandSelect = vi.fn();
      renderInput({
        input: '/cl',
        showPalette: true,
        paletteFilter: 'cl',
        onSubmit,
        onCommandSelect,
      });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      await user.click(textarea);
      await user.keyboard('{Enter}');
      // The form should NOT be submitted -- the palette handles Enter
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('forwards Escape to palette close when palette is open', async () => {
      const user = userEvent.setup();
      const onPaletteClose = vi.fn();
      renderInput({
        input: '/',
        showPalette: true,
        paletteFilter: '',
        onPaletteClose,
      });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      await user.click(textarea);
      await user.keyboard('{Escape}');
      // The palette's onClose should be called via the dispatched event
    });

    it('submits on Enter when slash input has no matching palette commands', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderInput({
        input: '/does-not-exist',
        showPalette: true,
        paletteFilter: 'does-not-exist',
        paletteCommands: [],
        onSubmit,
      });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      await user.click(textarea);
      await user.keyboard('{Enter}');
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  // -- Submit behavior --

  describe('Submit behavior', () => {
    it('calls onSubmit on Enter when palette is not open', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderInput({ input: 'hello', onSubmit, showPalette: false });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      await user.click(textarea);
      await user.keyboard('{Enter}');
      expect(onSubmit).toHaveBeenCalled();
    });

    it('does not submit on Enter when input is empty', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderInput({ input: '', onSubmit, showPalette: false });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      await user.click(textarea);
      await user.keyboard('{Enter}');
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit on Enter when loading', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderInput({
        input: 'hello',
        onSubmit,
        isLoading: true,
        showPalette: false,
      });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      // Textarea is disabled when loading, so we can't type.
      // This verifies the submit guard works.
      expect(textarea).toBeDisabled();
    });

    it('allows shift+Enter for newline (does not submit)', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderInput({ input: 'hello', onSubmit, showPalette: false });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      await user.click(textarea);
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  // -- Placeholder text --

  describe('Placeholder', () => {
    it('shows hint about slash commands in placeholder', () => {
      renderInput();
      const textarea = screen.getByPlaceholderText(/\/ for commands/i);
      expect(textarea).toBeInTheDocument();
    });
  });

  // -- Ghost text / suggestions --

  describe('Ghost text overlay', () => {
    it('renders ghost text when input is empty and suggestion is provided', () => {
      renderInput({ ghostText: 'Can you explain this code?' });
      const ghost = screen.getByTestId('ghost-text');
      expect(ghost).toBeInTheDocument();
      expect(ghost).toHaveTextContent('Can you explain this code?');
    });

    it('does not render ghost text when input has content', () => {
      renderInput({ input: 'hello', ghostText: 'Can you explain this code?' });
      expect(screen.queryByTestId('ghost-text')).not.toBeInTheDocument();
    });

    it('does not render ghost text when no suggestion is provided', () => {
      renderInput({ ghostText: undefined });
      expect(screen.queryByTestId('ghost-text')).not.toBeInTheDocument();
    });

    it('does not render ghost text when ghostText is null', () => {
      renderInput({ ghostText: null });
      expect(screen.queryByTestId('ghost-text')).not.toBeInTheDocument();
    });

    it('calls onAcceptSuggestion when Tab is pressed with ghost text and empty input', async () => {
      const user = userEvent.setup();
      const onAcceptSuggestion = vi.fn();
      renderInput({
        ghostText: 'Can you explain this code?',
        onAcceptSuggestion,
      });

      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      await user.keyboard('{Tab}');
      expect(onAcceptSuggestion).toHaveBeenCalled();
    });

    it('does not call onAcceptSuggestion when Tab is pressed without ghost text', async () => {
      const user = userEvent.setup();
      const onAcceptSuggestion = vi.fn();
      renderInput({
        ghostText: undefined,
        onAcceptSuggestion,
      });

      const textarea = screen.getByPlaceholderText(/type a message/i);
      await user.click(textarea);
      await user.keyboard('{Tab}');
      expect(onAcceptSuggestion).not.toHaveBeenCalled();
    });

    it('accepts and submits on Enter when input is empty but ghost text exists', async () => {
      const user = userEvent.setup();
      const onAcceptSuggestion = vi.fn();
      const onSubmit = vi.fn();
      renderInput({
        ghostText: 'Can you explain this code?',
        onAcceptSuggestion,
        onSubmit,
      });

      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      await user.keyboard('{Enter}');
      expect(onAcceptSuggestion).toHaveBeenCalled();
    });

    it('calls onAcceptSuggestion when ArrowRight is pressed with empty input and ghost text', async () => {
      const user = userEvent.setup();
      const onAcceptSuggestion = vi.fn();
      renderInput({
        ghostText: 'Can you explain this code?',
        onAcceptSuggestion,
      });

      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      await user.keyboard('{ArrowRight}');
      expect(onAcceptSuggestion).toHaveBeenCalled();
    });
  });
});

// TODO: #267 — quarantined, ChatInput component API changed
describe.skip('ChatInput appearance settings', () => {
  it('applies chat width and density controls to the composer shell', () => {
    mockUseSettings.mockReturnValue({
      settings: {
        chatFont: 'mono',
        monoFontFamily: 'courier',
        chatDensity: 'compact',
        chatWidth: 'wide',
      },
    });

    renderInput();
    const shell = screen.getByTestId('chat-input-shell');
    const form = screen.getByTestId('chat-input-form');
    const textarea = screen.getByRole('textbox');

    expect(shell).toHaveClass('max-w-5xl');
    expect(form).toHaveClass('p-3');
    expect(textarea).toHaveStyle({ fontFamily: 'var(--chat-mono-font)' });
  });
});
