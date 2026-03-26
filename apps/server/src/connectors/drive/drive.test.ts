import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { Database } from 'bun:sqlite';
import type { DriveFile, DriveFileContent } from '../../services/google/drive';

// ---------------------------------------------------------------------------
// Mock the drive service before importing the tools
// ---------------------------------------------------------------------------

const mockListFiles = mock(async (..._args: any[]) => ({ files: [], nextPageToken: undefined }));
const mockGetFile = mock(async (..._args: any[]) => ({} as DriveFile));
const mockGetFileContent = mock(async (..._args: any[]) => ({} as DriveFileContent));
const mockUploadFile = mock(async (..._args: any[]) => ({} as DriveFile));

mock.module('../../services/google/drive', () => ({
  listFiles: mockListFiles,
  getFile: mockGetFile,
  getFileContent: mockGetFileContent,
  uploadFile: mockUploadFile,
}));

// Import after mocking
const { createDriveTools } = await import('./tools');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal fake Database to satisfy the type parameter */
const fakeDb = {} as Database;

/** Call the tool handler by name and return the raw result */
async function callTool(toolName: string, args: Record<string, unknown>) {
  const tools = createDriveTools(fakeDb);
  const def = tools.find((t) => t.name === toolName);
  if (!def) throw new Error(`Tool ${toolName} not found`);
  // sdkTool.handler is the tool's async function
  const sdkTool = def.sdkTool as any;
  return sdkTool.handler(args);
}

function makeFile(overrides: Partial<DriveFile> = {}): DriveFile {
  return {
    id: 'file-id-1',
    name: 'Test Document',
    mimeType: 'application/vnd.google-apps.document',
    size: undefined,
    modifiedTime: '2024-01-15T12:00:00Z',
    webViewLink: 'https://docs.google.com/document/d/file-id-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('drive connector tools', () => {
  beforeEach(() => {
    mockListFiles.mockReset();
    mockGetFile.mockReset();
    mockGetFileContent.mockReset();
    mockUploadFile.mockReset();
  });

  // ---------- drive_search_files ----------

  describe('drive_search_files', () => {
    test('returns formatted file list when files found', async () => {
      const files: DriveFile[] = [
        makeFile({ id: 'id1', name: 'Report Q1', mimeType: 'application/vnd.google-apps.document' }),
        makeFile({ id: 'id2', name: 'Budget.csv', mimeType: 'text/csv', size: '2048', webViewLink: undefined }),
      ];
      mockListFiles.mockResolvedValueOnce({ files, nextPageToken: undefined });

      const result = await callTool('drive_search_files', { query: 'name contains "Report"' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('2 result');
      expect(text).toContain('Report Q1');
      expect(text).toContain('Google Doc');
      expect(text).toContain('Budget.csv');
      expect(text).toContain('CSV');
    });

    test('shows pagination token when more results exist', async () => {
      mockListFiles.mockResolvedValueOnce({
        files: [makeFile()],
        nextPageToken: 'next-page-abc',
      });

      const result = await callTool('drive_search_files', {});

      expect(result.content[0].text).toContain('next-page-abc');
    });

    test('returns empty message when no files found', async () => {
      mockListFiles.mockResolvedValueOnce({ files: [], nextPageToken: undefined });

      const result = await callTool('drive_search_files', { query: 'nonexistent' });

      expect(result.content[0].text).toContain('No files found');
      expect(result.content[0].text).toContain('nonexistent');
    });

    test('returns empty message without query when no files', async () => {
      mockListFiles.mockResolvedValueOnce({ files: [], nextPageToken: undefined });

      const result = await callTool('drive_search_files', {});

      expect(result.content[0].text).toContain('No files found in Google Drive');
    });

    test('returns error on drive service failure', async () => {
      mockListFiles.mockRejectedValueOnce(new Error('Drive API unavailable'));

      const result = await callTool('drive_search_files', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error: Drive API unavailable');
    });

    test('passes query, pageToken, and maxResults to listFiles', async () => {
      mockListFiles.mockResolvedValueOnce({ files: [], nextPageToken: undefined });

      await callTool('drive_search_files', {
        query: 'mimeType = "application/pdf"',
        maxResults: 10,
        pageToken: 'tok123',
      });

      expect(mockListFiles).toHaveBeenCalledWith(
        fakeDb,
        'mimeType = "application/pdf"',
        'tok123',
        10,
      );
    });
  });

  // ---------- drive_get_file ----------

  describe('drive_get_file', () => {
    test('returns formatted file metadata', async () => {
      mockGetFile.mockResolvedValueOnce(
        makeFile({
          id: 'file-abc',
          name: 'My Spreadsheet',
          mimeType: 'application/vnd.google-apps.spreadsheet',
          modifiedTime: '2024-03-10T08:30:00Z',
        }),
      );

      const result = await callTool('drive_get_file', { fileId: 'file-abc' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('My Spreadsheet');
      expect(text).toContain('file-abc');
      expect(text).toContain('Google Sheet');
    });

    test('includes web view link when present', async () => {
      mockGetFile.mockResolvedValueOnce(
        makeFile({ webViewLink: 'https://docs.google.com/spreadsheets/d/file-abc' }),
      );

      const result = await callTool('drive_get_file', { fileId: 'file-abc' });

      expect(result.content[0].text).toContain('https://docs.google.com/spreadsheets/d/file-abc');
    });

    test('returns error when file not found', async () => {
      mockGetFile.mockRejectedValueOnce(new Error('Drive getFile failed'));

      const result = await callTool('drive_get_file', { fileId: 'missing-id' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });

  // ---------- drive_read_file ----------

  describe('drive_read_file', () => {
    test('returns file content with content-type header', async () => {
      const fileContent: DriveFileContent = {
        content: 'Hello, this is the document content.',
        mimeType: 'text/plain',
      };
      mockGetFileContent.mockResolvedValueOnce(fileContent);

      const result = await callTool('drive_read_file', { fileId: 'file-123' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('[Content-Type: text/plain]');
      expect(text).toContain('Hello, this is the document content.');
    });

    test('passes exportMimeType to getFileContent', async () => {
      mockGetFileContent.mockResolvedValueOnce({ content: 'col1,col2\n1,2', mimeType: 'text/csv' });

      await callTool('drive_read_file', { fileId: 'sheet-id', exportMimeType: 'text/csv' });

      expect(mockGetFileContent).toHaveBeenCalledWith(fakeDb, 'sheet-id', 'text/csv');
    });

    test('returns error when content fetch fails', async () => {
      mockGetFileContent.mockRejectedValueOnce(new Error('Drive getFileContent failed'));

      const result = await callTool('drive_read_file', { fileId: 'bad-id' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });

    test('truncates content exceeding 100KB', async () => {
      const largeContent = 'a'.repeat(120_000);
      mockGetFileContent.mockResolvedValueOnce({ content: largeContent, mimeType: 'text/plain' });

      const result = await callTool('drive_read_file', { fileId: 'large-file' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('[Content truncated');
      expect(text).toContain('120000'); // original length in truncation notice
      // Total length should be header + 100K + truncation notice, not full 120K
      expect(text.length).toBeLessThan(120_000 + 500);
    });

    test('does not truncate content under 100KB', async () => {
      const smallContent = 'Small file content.';
      mockGetFileContent.mockResolvedValueOnce({ content: smallContent, mimeType: 'text/plain' });

      const result = await callTool('drive_read_file', { fileId: 'small-file' });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).not.toContain('[Content truncated');
      expect(text).toContain(smallContent);
    });
  });

  // ---------- drive_upload_file ----------

  describe('drive_upload_file', () => {
    test('returns uploaded file details on success', async () => {
      mockUploadFile.mockResolvedValueOnce(
        makeFile({
          id: 'new-file-id',
          name: 'notes.txt',
          mimeType: 'text/plain',
          size: '100',
          webViewLink: 'https://drive.google.com/file/d/new-file-id',
        }),
      );

      const result = await callTool('drive_upload_file', {
        name: 'notes.txt',
        content: 'Some notes here',
        mimeType: 'text/plain',
      });

      expect(result.isError).toBeFalsy();
      const text: string = result.content[0].text;
      expect(text).toContain('File uploaded successfully');
      expect(text).toContain('notes.txt');
      expect(text).toContain('new-file-id');
      expect(text).toContain('https://drive.google.com/file/d/new-file-id');
    });

    test('passes all parameters including parentId to uploadFile', async () => {
      mockUploadFile.mockResolvedValueOnce(makeFile());

      await callTool('drive_upload_file', {
        name: 'report.csv',
        content: 'a,b,c',
        mimeType: 'text/csv',
        parentId: 'folder-xyz',
      });

      expect(mockUploadFile).toHaveBeenCalledWith(
        fakeDb,
        'report.csv',
        'a,b,c',
        'text/csv',
        'folder-xyz',
      );
    });

    test('returns error when upload fails', async () => {
      mockUploadFile.mockRejectedValueOnce(new Error('Drive uploadFile failed'));

      const result = await callTool('drive_upload_file', {
        name: 'file.txt',
        content: 'data',
        mimeType: 'text/plain',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error:');
    });
  });

  // ---------- connector structure ----------

  describe('createDriveTools', () => {
    test('returns all four tools', () => {
      const tools = createDriveTools(fakeDb);
      const names = tools.map((t) => t.name);
      expect(names).toContain('drive_search_files');
      expect(names).toContain('drive_get_file');
      expect(names).toContain('drive_read_file');
      expect(names).toContain('drive_upload_file');
      expect(tools).toHaveLength(4);
    });

    test('each tool has name, description, and sdkTool', () => {
      const tools = createDriveTools(fakeDb);
      for (const t of tools) {
        expect(typeof t.name).toBe('string');
        expect(t.name.length).toBeGreaterThan(0);
        expect(typeof t.description).toBe('string');
        expect(t.sdkTool).toBeDefined();
      }
    });
  });
});
