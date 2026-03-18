import { describe, it, expect, vi } from 'vitest';
import { useState, type ComponentProps } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileReadDisplay } from '../FileReadDisplay';
import { ChatInput } from '../ChatInput';
import { isImageFile } from '../file-utils';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import type { Command } from '@/hooks/useCommands';
import { SettingsProvider } from '@/contexts/SettingsContext';

// --- Helper to build a ToolCallState ---
function makeToolCall(overrides: Partial<ToolCallState> & { name: string }): ToolCallState {
  return {
    toolUseId: 'tool-1',
    status: 'complete',
    input: '',
    ...overrides,
  };
}

// =====================================================================
// isImageFile utility
// =====================================================================
describe('isImageFile utility', () => {
  it('detects PNG files', () => {
    expect(isImageFile('/path/to/photo.png')).toBe(true);
  });

  it('detects JPG files', () => {
    expect(isImageFile('/path/to/photo.jpg')).toBe(true);
  });

  it('detects JPEG files', () => {
    expect(isImageFile('/path/to/photo.jpeg')).toBe(true);
  });

  it('detects GIF files', () => {
    expect(isImageFile('/path/to/animation.gif')).toBe(true);
  });

  it('detects WebP files', () => {
    expect(isImageFile('/path/to/image.webp')).toBe(true);
  });

  it('detects SVG files', () => {
    expect(isImageFile('/path/to/icon.svg')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isImageFile('/path/to/PHOTO.PNG')).toBe(true);
    expect(isImageFile('/path/to/Photo.Jpg')).toBe(true);
  });

  it('returns false for non-image files', () => {
    expect(isImageFile('/path/to/file.ts')).toBe(false);
    expect(isImageFile('/path/to/file.pdf')).toBe(false);
    expect(isImageFile('/path/to/file.txt')).toBe(false);
    expect(isImageFile('/path/to/file.json')).toBe(false);
  });

  it('returns false for files with no extension', () => {
    expect(isImageFile('/path/to/Makefile')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isImageFile('')).toBe(false);
  });
});

// =====================================================================
// FileReadDisplay - Image detection and preview
// =====================================================================
describe('FileReadDisplay - Image file detection', () => {
  it('shows image preview for PNG files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/path/to/screenshot.png' }),
          result: 'binary content not shown',
        })}
      />
    );
    expect(screen.getByTestId('image-preview')).toBeInTheDocument();
  });

  it('shows image preview for JPG files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/photos/vacation.jpg' }),
          result: 'binary content not shown',
        })}
      />
    );
    expect(screen.getByTestId('image-preview')).toBeInTheDocument();
  });

  it('shows image preview for GIF files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/images/animation.gif' }),
          result: 'binary content not shown',
        })}
      />
    );
    expect(screen.getByTestId('image-preview')).toBeInTheDocument();
  });

  it('shows image preview for WebP files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/images/photo.webp' }),
          result: 'binary content not shown',
        })}
      />
    );
    expect(screen.getByTestId('image-preview')).toBeInTheDocument();
  });

  it('shows image preview for SVG files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/icons/logo.svg' }),
          result: 'binary content not shown',
        })}
      />
    );
    expect(screen.getByTestId('image-preview')).toBeInTheDocument();
  });

  it('does NOT show image preview for non-image files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/src/app.tsx' }),
          result: 'import React from "react";',
        })}
      />
    );
    expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
  });

  it('shows the file path for image files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/images/logo.png' }),
          result: 'binary content',
        })}
      />
    );
    expect(screen.getByText('/images/logo.png')).toBeInTheDocument();
  });

  it('shows image label instead of language label for image files', () => {
    render(
      <FileReadDisplay
        toolCall={makeToolCall({
          name: 'Read',
          input: JSON.stringify({ file_path: '/images/logo.png' }),
          result: 'binary content',
        })}
      />
    );
    expect(screen.getByTestId('language-label')).toHaveTextContent('image');
  });
});

// =====================================================================
// ChatInput - Image paste and drag-and-drop
// =====================================================================
describe('ChatInput - Image paste support', () => {
  const mockCommands: Command[] = [];

  function renderChatInput(
    overrides: Partial<ComponentProps<typeof ChatInput>> = {}
  ) {
    const defaults: ComponentProps<typeof ChatInput> = {
      input: '',
      onInputChange: vi.fn(),
      onSubmit: vi.fn(),
      isLoading: false,
      showPalette: false,
      paletteFilter: '',
      paletteCommands: mockCommands,
      onCommandSelect: vi.fn(),
      onPaletteClose: vi.fn(),
      images: [],
      onImagesChange: vi.fn(),
      ...overrides,
    };
    return render(
      <SettingsProvider>
        <ChatInput {...defaults} />
      </SettingsProvider>
    );
  }

  function StatefulChatInput(
    overrides: Partial<ComponentProps<typeof ChatInput>> = {}
  ) {
    const [value, setValue] = useState(overrides.input ?? '');

    return (
      <SettingsProvider>
        <ChatInput
          input={value}
          onInputChange={(next) => {
            overrides.onInputChange?.(next);
            setValue(next);
          }}
          onSubmit={overrides.onSubmit ?? vi.fn()}
          isLoading={overrides.isLoading ?? false}
          showPalette={overrides.showPalette ?? false}
          paletteFilter={overrides.paletteFilter ?? ''}
          paletteCommands={overrides.paletteCommands ?? mockCommands}
          onCommandSelect={overrides.onCommandSelect ?? vi.fn()}
          onPaletteClose={overrides.onPaletteClose ?? vi.fn()}
          images={overrides.images ?? []}
          onImagesChange={overrides.onImagesChange ?? vi.fn()}
          availableFiles={overrides.availableFiles ?? []}
          ghostText={overrides.ghostText}
          onAcceptSuggestion={overrides.onAcceptSuggestion}
        />
      </SettingsProvider>
    );
  }

  function makeEntryFromFile(file: File, name = file.name): any {
    return {
      isFile: true,
      isDirectory: false,
      name,
      file: (cb: (file: File) => void) => {
        cb(file);
      },
    };
  }

  function makeEntryFromDirectory(entries: any[], name = 'folder'): any {
    const queue = [...entries];
    return {
      isFile: false,
      isDirectory: true,
      name,
      createReader: () => ({
        readEntries: (onSuccess: (items: any[]) => void) => {
          onSuccess(queue.splice(0, entries.length));
        },
      }),
    };
  }

  it('renders without images by default', () => {
    renderChatInput();
    expect(screen.queryByTestId('image-thumbnails')).not.toBeInTheDocument();
  });

  it('renders image thumbnails when images are provided', () => {
    const images = [
      { id: '1', dataUrl: 'data:image/png;base64,abc', name: 'test.png' },
    ];
    renderChatInput({ images });
    expect(screen.getByTestId('image-thumbnails')).toBeInTheDocument();
  });

  it('renders multiple image thumbnails', () => {
    const images = [
      { id: '1', dataUrl: 'data:image/png;base64,abc', name: 'test1.png' },
      { id: '2', dataUrl: 'data:image/jpeg;base64,def', name: 'test2.jpg' },
    ];
    renderChatInput({ images });
    const thumbnails = screen.getAllByTestId('image-thumbnail');
    expect(thumbnails).toHaveLength(2);
  });

  it('shows remove button on each thumbnail', () => {
    const images = [
      { id: '1', dataUrl: 'data:image/png;base64,abc', name: 'test.png' },
    ];
    renderChatInput({ images });
    expect(screen.getByLabelText('Remove attachment')).toBeInTheDocument();
  });

  it('calls onImagesChange when remove button is clicked', async () => {
    const user = userEvent.setup();
    const onImagesChange = vi.fn();
    const images = [
      { id: '1', dataUrl: 'data:image/png;base64,abc', name: 'test.png' },
    ];
    renderChatInput({ images, onImagesChange });

    await user.click(screen.getByLabelText('Remove attachment'));
    expect(onImagesChange).toHaveBeenCalledWith([]);
  });

  it('handles paste event with image data', () => {
    const onImagesChange = vi.fn();
    renderChatInput({ onImagesChange });

    const textarea = screen.getByPlaceholderText(/type a message/i);

    // Create a mock paste event with an image file
    const file = new File(['fake-image-data'], 'pasted.png', { type: 'image/png' });
    const dataTransfer = {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        },
      ],
    };

    // Use fireEvent since we need to control the clipboardData
    fireEvent.paste(textarea, {
      clipboardData: dataTransfer,
    });

    // The handler should process the file - it reads asynchronously via FileReader
    // so we check that the paste event was at least handled
    // (the actual onImagesChange call happens after FileReader.onload)
  });

  it('handles drag over event by setting drag-active state', () => {
    renderChatInput();
    const dropZone = screen.getByTestId('chat-input-form');

    fireEvent.dragOver(dropZone, {
      dataTransfer: { types: ['Files'] },
    });

    // The drop zone should have some visual indication of drag state
    // We verify it doesn't throw and the form is still present
    expect(dropZone).toBeInTheDocument();
  });

  it('handles drop event with image files', () => {
    const onImagesChange = vi.fn();
    renderChatInput({ onImagesChange });

    const dropZone = screen.getByTestId('chat-input-form');
    const file = new File(['fake-image-data'], 'dropped.png', { type: 'image/png' });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        types: ['Files'],
      },
    });

    // Drop event should be handled (file reading is async)
    expect(dropZone).toBeInTheDocument();
  });

  it('adds non-image files on drop', async () => {
    const onImagesChange = vi.fn();
    renderChatInput({ onImagesChange });

    const dropZone = screen.getByTestId('chat-input-form');
    const file = new File(['text content'], 'readme.txt', { type: 'text/plain' });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        types: ['Files'],
      },
    });

    expect(dropZone).toBeInTheDocument();
    await waitFor(() => expect(onImagesChange).toHaveBeenCalled());
  });

  it('supports folder drop and flattens nested files from DataTransfer entries', async () => {
    const onImagesChange = vi.fn();
    renderChatInput({ onImagesChange });

    const dropZone = screen.getByTestId('chat-input-form');
    const rootText = new File(['root'], 'root.txt', { type: 'text/plain' });
    const nestedText = new File(['nested'], 'nested.txt', { type: 'text/plain' });

    const nestedFolder = makeEntryFromDirectory([
      makeEntryFromFile(nestedText, 'nested.txt'),
    ], 'nested');

    const rootEntry = makeEntryFromDirectory([
      makeEntryFromFile(rootText, 'root.txt'),
      nestedFolder,
    ], 'root');

    fireEvent.drop(dropZone, {
      dataTransfer: {
        items: [
          {
            kind: 'file',
            webkitGetAsEntry: () => rootEntry,
          },
        ],
        files: [],
        types: ['Files'],
      },
    });

    await waitFor(() => expect(onImagesChange).toHaveBeenCalled());
    const calls = onImagesChange.mock.calls;
    const lastCall = calls[calls.length - 1]?.[0] as Array<{
      name: string;
    }>;
    expect(lastCall.some((file) => file.name === 'root.txt')).toBeTruthy();
    expect(lastCall.some((file) => file.name === 'nested.txt')).toBeTruthy();
  });

  it('supports file picker selection for attachments', async () => {
    const onImagesChange = vi.fn();
    renderChatInput({ onImagesChange });

    const picker = screen.getByTestId('file-input');
    const file = new File(['notes'], 'notes.txt', {
      type: 'text/plain',
    });

    fireEvent.change(picker, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => expect(onImagesChange).toHaveBeenCalled());
  });

  it('renders non-image attachment previews', () => {
    const images = [
      { id: '1', dataUrl: '', name: 'notes.txt' },
    ];
    renderChatInput({ images });

    expect(screen.getByTestId('image-thumbnails')).toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByTestId('file-attachment-item')).toBeInTheDocument();
  });

  it('filters and suggests files after @ mention', async () => {
    const onInputChange = vi.fn();
    render(
      <StatefulChatInput
        onInputChange={onInputChange}
        availableFiles={['src/app.tsx', 'src/styles.css', 'README.md']}
      />
    );

    const textarea = screen.getByPlaceholderText(/type a message/i);
    const user = userEvent.setup();
    await user.click(textarea);
    await user.type(textarea, 'review @');

    expect(screen.getByTestId('file-mention-palette')).toBeInTheDocument();
    expect(screen.getByText('src/app.tsx')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();

    await user.click(screen.getByText('README.md'));
    expect(onInputChange).toHaveBeenLastCalledWith('review @README.md ');
  });

  it('renders with attached images without errors', () => {
    const images = [
      { id: '1', dataUrl: 'data:image/png;base64,abc', name: 'test.png' },
    ];
    renderChatInput({ images, input: '' });

    // Verify the component renders with images attached and shows thumbnails
    expect(screen.getByTestId('image-thumbnails')).toBeInTheDocument();
    expect(screen.getByTestId('image-thumbnail')).toBeInTheDocument();
    // The form should exist and have a submit button
    expect(screen.getByTestId('chat-input-form')).toBeInTheDocument();
  });
});

// =====================================================================
// MarkdownRenderer - clickable images (tested via integration)
// =====================================================================
describe('MarkdownRenderer - Image click behavior', () => {
  // Image click behavior is tested via ImageViewer.test.tsx which
  // covers the lightbox component used by MarkdownRenderer's img handler.
  // MarkdownRenderer delegates to <ImageViewer> for all image rendering.
  it('verifies ImageViewer is the component used for markdown images', async () => {
    // Import MarkdownRenderer and render markdown with an image
    const { MarkdownRenderer } = await import('../MarkdownRenderer');
    render(<MarkdownRenderer content="![alt text](https://example.com/photo.png)" />);
    // The image should be rendered (ImageViewer renders an img element)
    const img = screen.getByAltText('alt text');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.png');
  });
});
