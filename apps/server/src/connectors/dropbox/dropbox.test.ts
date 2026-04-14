import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import type { Database } from 'bun:sqlite';

// ---------------------------------------------------------------------------
// Mock fetch before importing tools
// ---------------------------------------------------------------------------

const mockFetch = mock(async (_url: string, _init?: RequestInit): Promise<Response> => {
  return new Response(JSON.stringify({}), { status: 200 });
});

// @ts-ignore — replace global fetch with mock
global.fetch = mockFetch;

// Set the required env var
process.env.DROPBOX_ACCESS_TOKEN = 'test-dropbox-token';

// ---------------------------------------------------------------------------
// Import tools after mocking
// ---------------------------------------------------------------------------

const { createDropboxTools } = await import('./tools');
const { dropboxConnectorFactory } = await import('./index');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeDb = {} as Database;

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeBinaryResponse(content: string, status = 200): Response {
  const bytes = new TextEncoder().encode(content);
  return new Response(bytes, {
    status,
    headers: { 'Content-Type': 'application/octet-stream' },
  });
}

async function callTool(toolName: string, args: Record<string, unknown>) {
  const tools = createDropboxTools(fakeDb);
  const def = tools.find((t) => t.name === toolName);
  if (!def) throw new Error(`Tool "${toolName}" not found`);
  const sdkTool = def.sdkTool as any;
  return sdkTool.handler(args);
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeFileEntry(overrides: Record<string, unknown> = {}) {
  return {
    '.tag': 'file',
    name: 'report.pdf',
    path_lower: '/report.pdf',
    path_display: '/report.pdf',
    size: 204800,
    server_modified: '2024-03-10T08:00:00Z',
    client_modified: '2024-03-09T10:00:00Z',
    content_hash: 'abc123',
    rev: '01abc',
    ...overrides,
  };
}

function makeFolderEntry(overrides: Record<string, unknown> = {}) {
  return {
    '.tag': 'folder',
    name: 'Documents',
    path_lower: '/documents',
    path_display: '/Documents',
    ...overrides,
  };
}

function makeListFolderResponse(entries: unknown[] = [], hasMore = false) {
  return {
    entries,
    cursor: 'cursor-abc',
    has_more: hasMore,
  };
}

function makeSearchResponse(matches: unknown[] = [], hasMore = false) {
  return {
    matches,
    has_more: hasMore,
    cursor: 'search-cursor',
  };
}

function makeSearchMatch(metadata: unknown) {
  return {
    match_type: { '.tag': 'filename' },
    metadata: { '.tag': 'metadata', metadata },
  };
}

function makeSpaceUsageResponse(usedBytes: number, allocatedBytes: number) {
  return {
    used: usedBytes,
    allocation: {
      '.tag': 'individual',
      allocated: allocatedBytes,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dropbox Connector Tools', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ---------- dropbox_list_folder ----------

  describe('dropbox_list_folder', () => {
    test('returns formatted folder listing with files and folders', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(
          makeListFolderResponse([
            makeFileEntry({ name: 'budget.xlsx', size: 10240 }),
            makeFolderEntry({ name: 'Photos', path_display: '/Photos' }),
          ])
        )
      );

      const result = await callTool('dropbox_list_folder', { path: '/Documents' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('/Documents');
      expect(text).toContain('budget.xlsx');
      expect(text).toContain('[file]');
      expect(text).toContain('Photos');
      expect(text).toContain('[folder]');
    });

    test('shows empty message when folder is empty', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(makeListFolderResponse([])));

      const result = await callTool('dropbox_list_folder', { path: '/EmptyFolder' });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('empty');
      expect(result.content[0].text).toContain('/EmptyFolder');
    });

    test('shows has_more cursor when more entries exist', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(makeListFolderResponse([makeFileEntry()], true))
      );

      const result = await callTool('dropbox_list_folder', { path: '/' });

      expect(result.content[0].text).toContain('cursor-abc');
      expect(result.content[0].text).toContain('More entries');
    });

    test('normalizes root "/" to "" for Dropbox API', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(makeListFolderResponse([])));

      await callTool('dropbox_list_folder', { path: '/' });

      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.path).toBe('');
    });

    test('formats file size in human-readable form', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(
          makeListFolderResponse([makeFileEntry({ size: 1536000 })])
        )
      );

      const result = await callTool('dropbox_list_folder', { path: '' });

      expect(result.content[0].text).toContain('MB');
    });

    test('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

      const result = await callTool('dropbox_list_folder', { path: '/test' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error listing folder');
    });

    test('sends Authorization header with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(makeListFolderResponse([])));

      await callTool('dropbox_list_folder', { path: '/test' });

      const [, init] = mockFetch.mock.calls[0];
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer test-dropbox-token');
    });
  });

  // ---------- dropbox_search ----------

  describe('dropbox_search', () => {
    test('returns formatted search results', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(
          makeSearchResponse([
            makeSearchMatch(makeFileEntry({ name: 'quarterly-report.docx', size: 50000 })),
            makeSearchMatch(makeFolderEntry({ name: 'Reports' })),
          ])
        )
      );

      const result = await callTool('dropbox_search', { query: 'report' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('report');
      expect(text).toContain('quarterly-report.docx');
      expect(text).toContain('[file]');
      expect(text).toContain('Reports');
      expect(text).toContain('[folder]');
      expect(text).toContain('2 match');
    });

    test('returns no-results message when nothing found', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(makeSearchResponse([])));

      const result = await callTool('dropbox_search', { query: 'nonexistent-file' });

      expect(result.content[0].text).toContain('No results found');
      expect(result.content[0].text).toContain('nonexistent-file');
    });

    test('shows more results cursor when has_more is true', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(makeSearchResponse([makeSearchMatch(makeFileEntry())], true))
      );

      const result = await callTool('dropbox_search', { query: 'doc' });

      expect(result.content[0].text).toContain('More results');
    });

    test('returns error when search API fails', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

      const result = await callTool('dropbox_search', { query: 'anything' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error searching Dropbox');
    });

    test('sends query to /files/search_v2', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(makeSearchResponse([])));

      await callTool('dropbox_search', { query: 'my query' });

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/files/search_v2');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.query).toBe('my query');
    });
  });

  // ---------- dropbox_get_metadata ----------

  describe('dropbox_get_metadata', () => {
    test('returns file metadata including size and dates', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(
          makeFileEntry({
            name: 'photo.jpg',
            path_display: '/Photos/photo.jpg',
            size: 2097152,
            server_modified: '2024-02-15T14:30:00Z',
          })
        )
      );

      const result = await callTool('dropbox_get_metadata', { path: '/Photos/photo.jpg' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('photo.jpg');
      expect(text).toContain('/Photos/photo.jpg');
      expect(text).toContain('2.00 MB');
      expect(text).toContain('2024-02-15T14:30:00Z');
    });

    test('returns folder metadata without size', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(
          makeFolderEntry({ name: 'Archive', path_display: '/Archive' })
        )
      );

      const result = await callTool('dropbox_get_metadata', { path: '/Archive' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('folder');
      expect(text).toContain('Archive');
    });

    test('returns error when path does not exist', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 409 }));

      const result = await callTool('dropbox_get_metadata', { path: '/nonexistent' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error getting metadata');
    });

    test('includes content_hash and revision when present', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(
          makeFileEntry({ content_hash: 'hash-xyz', rev: 'rev-abc' })
        )
      );

      const result = await callTool('dropbox_get_metadata', { path: '/file.txt' });

      const text: string = result.content[0].text;
      expect(text).toContain('hash-xyz');
      expect(text).toContain('rev-abc');
    });
  });

  // ---------- dropbox_read_file ----------

  describe('dropbox_read_file', () => {
    test('returns file contents', async () => {
      mockFetch.mockResolvedValueOnce(makeBinaryResponse('Hello, Dropbox!'));

      const result = await callTool('dropbox_read_file', { path: '/hello.txt' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('Hello, Dropbox!');
      expect(text).toContain('/hello.txt');
    });

    test('truncates content exceeding 100KB', async () => {
      const largeContent = 'x'.repeat(150_000);
      mockFetch.mockResolvedValueOnce(makeBinaryResponse(largeContent));

      const result = await callTool('dropbox_read_file', { path: '/large.txt' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('[Content truncated');
      expect(text).toContain('150000');
      // Should not contain the full content
      expect(text.length).toBeLessThan(largeContent.length + 500);
    });

    test('does not truncate content under 100KB', async () => {
      const smallContent = 'Short file.';
      mockFetch.mockResolvedValueOnce(makeBinaryResponse(smallContent));

      const result = await callTool('dropbox_read_file', { path: '/small.txt' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain(smallContent);
      expect(text).not.toContain('[Content truncated');
    });

    test('uses content.dropboxapi.com endpoint', async () => {
      mockFetch.mockResolvedValueOnce(makeBinaryResponse('data'));

      await callTool('dropbox_read_file', { path: '/file.txt' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('content.dropboxapi.com');
      expect(url).toContain('/files/download');
    });

    test('sends Dropbox-API-Arg header with path', async () => {
      mockFetch.mockResolvedValueOnce(makeBinaryResponse('content'));

      await callTool('dropbox_read_file', { path: '/docs/readme.txt' });

      const [, init] = mockFetch.mock.calls[0];
      const headers = (init as RequestInit).headers as Record<string, string>;
      const apiArg = JSON.parse(headers['Dropbox-API-Arg']);
      expect(apiArg.path).toBe('/docs/readme.txt');
    });

    test('returns error on download failure', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

      const result = await callTool('dropbox_read_file', { path: '/restricted.txt' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error reading file');
    });
  });

  // ---------- dropbox_upload_file ----------

  describe('dropbox_upload_file', () => {
    test('uploads file and returns metadata', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(
          makeFileEntry({
            name: 'uploaded.txt',
            path_display: '/uploaded.txt',
            size: 12,
            server_modified: '2024-03-20T10:00:00Z',
            content_hash: 'new-hash',
            rev: 'new-rev',
          })
        )
      );

      const result = await callTool('dropbox_upload_file', {
        path: '/uploaded.txt',
        content: 'Hello world!',
      });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('uploaded successfully');
      expect(text).toContain('uploaded.txt');
      expect(text).toContain('/uploaded.txt');
    });

    test('uses content.dropboxapi.com endpoint', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(makeFileEntry()));

      await callTool('dropbox_upload_file', { path: '/test.txt', content: 'data' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('content.dropboxapi.com');
      expect(url).toContain('/files/upload');
    });

    test('sends Dropbox-API-Arg header with path and mode', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(makeFileEntry()));

      await callTool('dropbox_upload_file', {
        path: '/new-file.txt',
        content: 'content',
        mode: 'overwrite',
      });

      const [, init] = mockFetch.mock.calls[0];
      const headers = (init as RequestInit).headers as Record<string, string>;
      const apiArg = JSON.parse(headers['Dropbox-API-Arg']);
      expect(apiArg.path).toBe('/new-file.txt');
      expect(apiArg.mode).toBe('overwrite');
    });

    test('defaults to "add" mode when not specified', async () => {
      mockFetch.mockResolvedValueOnce(makeJsonResponse(makeFileEntry()));

      await callTool('dropbox_upload_file', { path: '/file.txt', content: 'data' });

      const [, init] = mockFetch.mock.calls[0];
      const headers = (init as RequestInit).headers as Record<string, string>;
      const apiArg = JSON.parse(headers['Dropbox-API-Arg']);
      expect(apiArg.mode).toBe('add');
    });

    test('returns error when upload fails', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Conflict', { status: 409 }));

      const result = await callTool('dropbox_upload_file', {
        path: '/file.txt',
        content: 'data',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error uploading file');
    });
  });

  // ---------- dropbox_get_space_usage ----------

  describe('dropbox_get_space_usage', () => {
    test('returns human-readable space usage for individual account', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(makeSpaceUsageResponse(2_147_483_648, 10_737_418_240)) // 2GB used of 10GB
      );

      const result = await callTool('dropbox_get_space_usage', {});

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('Space Usage');
      expect(text).toContain('GB');
      expect(text).toContain('%');
      expect(text).toContain('Free');
    });

    test('formats small storage in KB or MB', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(makeSpaceUsageResponse(512_000, 2_097_152_000))
      );

      const result = await callTool('dropbox_get_space_usage', {});

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('KB');
    });

    test('handles team allocation type', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse({
          used: 1_073_741_824,
          allocation: {
            '.tag': 'team',
            used: 5_368_709_120,
            allocated: 107_374_182_400,
          },
        })
      );

      const result = await callTool('dropbox_get_space_usage', {});

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('Team');
    });

    test('sends POST to /users/get_space_usage', async () => {
      mockFetch.mockResolvedValueOnce(
        makeJsonResponse(makeSpaceUsageResponse(1000, 10_000_000))
      );

      await callTool('dropbox_get_space_usage', {});

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/users/get_space_usage');
    });

    test('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

      const result = await callTool('dropbox_get_space_usage', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error getting space usage');
    });
  });

  // ---------- connector structure ----------

  describe('createDropboxTools', () => {
    test('returns all six tools', () => {
      const tools = createDropboxTools(fakeDb);
      const names = tools.map((t) => t.name);
      expect(names).toContain('dropbox_list_folder');
      expect(names).toContain('dropbox_search');
      expect(names).toContain('dropbox_get_metadata');
      expect(names).toContain('dropbox_read_file');
      expect(names).toContain('dropbox_upload_file');
      expect(names).toContain('dropbox_get_space_usage');
      expect(tools).toHaveLength(6);
    });

    test('each tool has name, description, and sdkTool', () => {
      const tools = createDropboxTools(fakeDb);
      for (const t of tools) {
        expect(typeof t.name).toBe('string');
        expect(t.name.length).toBeGreaterThan(0);
        expect(typeof t.description).toBe('string');
        expect(t.sdkTool).toBeDefined();
      }
    });
  });

  // ---------- dropboxConnectorFactory ----------

  describe('dropboxConnectorFactory', () => {
    test('creates connector with correct name and category', () => {
      const connector = dropboxConnectorFactory(fakeDb);
      expect(connector.name).toBe('dropbox');
      expect(connector.category).toBe('storage');
    });

    test('connector has the box icon', () => {
      const connector = dropboxConnectorFactory(fakeDb);
      expect(connector.icon).toBe('📦');
    });

    test('connector requires auth', () => {
      const connector = dropboxConnectorFactory(fakeDb);
      expect(connector.requiresAuth).toBe(true);
    });

    test('connector includes all six tools', () => {
      const connector = dropboxConnectorFactory(fakeDb);
      expect(connector.tools).toHaveLength(6);
    });

    test('connector has displayName and description', () => {
      const connector = dropboxConnectorFactory(fakeDb);
      expect(connector.displayName).toBeTruthy();
      expect(connector.description).toBeTruthy();
    });
  });

  // ---------- error handling / edge cases ----------

  describe('error handling', () => {
    test('sanitizes token from error messages', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Bearer secret-token-123 is invalid'));

      const result = await callTool('dropbox_list_folder', { path: '/' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).not.toContain('secret-token-123');
    });

    test('returns error when DROPBOX_ACCESS_TOKEN is not set', async () => {
      const original = process.env.DROPBOX_ACCESS_TOKEN;
      delete process.env.DROPBOX_ACCESS_TOKEN;

      try {
        const result = await callTool('dropbox_list_folder', { path: '/' });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('DROPBOX_ACCESS_TOKEN');
      } finally {
        process.env.DROPBOX_ACCESS_TOKEN = original;
      }
    });
  });
});
