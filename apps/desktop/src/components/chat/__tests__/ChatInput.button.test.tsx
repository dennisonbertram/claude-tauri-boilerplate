import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { render, screen } from '@testing-library/react';
expect.extend(matchers);
import userEvent from '@testing-library/user-event';
import { ChatInput } from '../ChatInput';

const mockUseSettings = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
}));

vi.mock('@phosphor-icons/react', () => ({
  X: (props: any) => <span data-testid="icon-x" {...props} />,
  FileText: (props: any) => <span data-testid="icon-filetext" {...props} />,
  Plus: (props: any) => <span data-testid="icon-plus" {...props} />,
}));

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
    paletteCommands: [],
    onCommandSelect: vi.fn(),
    onPaletteClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<ChatInput {...defaults} />), props: defaults };
}

describe('ChatInput send button', () => {
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

  it('clicking the send button calls onSubmit when input has text', async () => {
    const onSubmit = vi.fn();
    renderInput({ input: 'hello', onSubmit });

    const button = screen.getByRole('button', { name: /send message/i });
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('send button is disabled when input is empty', () => {
    renderInput({ input: '' });
    const button = screen.getByRole('button', { name: /send message/i });
    expect(button).toBeDisabled();
  });

  it('send button is disabled when isLoading is true', () => {
    renderInput({ input: 'hello', isLoading: true });
    const button = screen.getByRole('button', { name: /send message/i });
    expect(button).toBeDisabled();
  });

  it('send button is enabled when input has text and not loading', () => {
    renderInput({ input: 'hello', isLoading: false });
    const button = screen.getByRole('button', { name: /send message/i });
    expect(button).toBeEnabled();
  });
});
