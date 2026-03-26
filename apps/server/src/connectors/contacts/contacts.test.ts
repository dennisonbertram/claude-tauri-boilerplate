import { describe, test, expect, mock, beforeAll, afterEach } from 'bun:test';
import type { Database } from 'bun:sqlite';

// ---------------------------------------------------------------------------
// Mock ./jxa so osascript never actually runs
// ---------------------------------------------------------------------------

// Mutable holder: tests swap this to change the JXA return value.
let _jxaImpl: (script: string) => Promise<string> = async () => JSON.stringify([]);

mock.module('./jxa', () => ({
  runJxa: (script: string) => _jxaImpl(script),
}));

// ---------------------------------------------------------------------------
// Mock fetch for Google People API
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = mock(handler as any) as any;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// ---------------------------------------------------------------------------
// Import tools AFTER mocks are installed
// ---------------------------------------------------------------------------

const { createContactsTools } = await import('./tools');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeDb = {} as Database;

async function callTool(
  tools: ReturnType<typeof createContactsTools>,
  name: string,
  args: Record<string, unknown>
) {
  const t = tools.find((t) => t.name === name);
  if (!t) throw new Error(`Tool "${name}" not found`);
  return t.sdkTool.handler(args);
}

function setJxaResult(value: unknown) {
  _jxaImpl = async () => JSON.stringify(value);
}

function setJxaError(message: string) {
  _jxaImpl = async () => {
    throw new Error(message);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Contacts Connector Tools', () => {
  let tools: ReturnType<typeof createContactsTools>;

  beforeAll(() => {
    tools = createContactsTools(fakeDb);
  });

  afterEach(() => {
    restoreFetch();
    setJxaResult([]);
  });

  // ---------- Tool registration ----------

  describe('createContactsTools', () => {
    test('returns 4 tools', () => {
      expect(tools).toHaveLength(4);
    });

    test('has expected tool names', () => {
      const names = tools.map((t) => t.name);
      expect(names).toContain('contacts_search');
      expect(names).toContain('contacts_get');
      expect(names).toContain('contacts_list_groups');
      expect(names).toContain('contacts_create');
    });

    test('each tool has required fields', () => {
      for (const t of tools) {
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.sdkTool).toBeDefined();
        expect(t.sdkTool.name).toBe(t.name);
        expect(typeof t.sdkTool.handler).toBe('function');
      }
    });

    test('read-only tools have readOnlyHint: true', () => {
      const readOnlyNames = ['contacts_search', 'contacts_get', 'contacts_list_groups'];
      for (const name of readOnlyNames) {
        const t = tools.find((t) => t.name === name)!;
        expect((t.sdkTool as any).annotations?.readOnlyHint).toBe(true);
      }
    });

    test('contacts_create has readOnlyHint: false', () => {
      const t = tools.find((t) => t.name === 'contacts_create')!;
      expect((t.sdkTool as any).annotations?.readOnlyHint).toBe(false);
    });

    test('all tools have openWorldHint: true', () => {
      for (const t of tools) {
        expect((t.sdkTool as any).annotations?.openWorldHint).toBe(true);
      }
    });
  });

  // ---------- contacts_search (Apple Contacts) ----------

  describe('contacts_search — Apple Contacts', () => {
    test('returns formatted results for matching contacts', async () => {
      setJxaResult([
        {
          id: 'abc-123',
          name: 'Alice Smith',
          emails: ['alice@example.com'],
          phones: ['+1-555-0100'],
          organization: 'Acme Corp',
        },
      ]);

      const result = await callTool(tools, 'contacts_search', { query: 'Alice' });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('Alice Smith');
      expect(text).toContain('alice@example.com');
      expect(text).toContain('+1-555-0100');
    });

    test('returns empty message when no contacts found', async () => {
      setJxaResult([]);

      const result = await callTool(tools, 'contacts_search', { query: 'Nonexistent' });

      expect(result.content[0].text).toContain('No contacts found');
      expect(result.isError).toBeFalsy();
    });

    test('fences name in output to prevent prompt injection', async () => {
      setJxaResult([
        {
          id: 'abc-999',
          name: '<script>alert(1)</script>',
          emails: [],
          phones: [],
          organization: '',
        },
      ]);

      const result = await callTool(tools, 'contacts_search', { query: 'test' });
      const text = result.content[0].text as string;

      // Payload must appear inside fence markers
      expect(text).toContain('UNTRUSTED_BEGIN');
      expect(text).toContain('<script>alert(1)</script>');
    });

    test('returns error result when osascript fails', async () => {
      setJxaError('osascript: execution error');

      const result = await callTool(tools, 'contacts_search', { query: 'test' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error searching contacts');
    });

    test('contact count is included in header line', async () => {
      setJxaResult([
        { id: '1', name: 'A', emails: [], phones: [], organization: '' },
        { id: '2', name: 'B', emails: [], phones: [], organization: '' },
      ]);

      const result = await callTool(tools, 'contacts_search', { query: 'test' });
      const text = result.content[0].text as string;
      expect(text).toContain('Found 2 contacts');
    });
  });

  // ---------- contacts_search (Google Contacts) ----------

  describe('contacts_search — Google Contacts', () => {
    test('calls Google People API and formats results', async () => {
      mockFetch(() =>
        new Response(
          JSON.stringify({
            results: [
              {
                person: {
                  resourceName: 'people/c987',
                  names: [{ displayName: 'Bob Jones' }],
                  emailAddresses: [{ value: 'bob@example.com', type: 'work' }],
                  phoneNumbers: [{ value: '+1-555-0200', type: 'mobile' }],
                  organizations: [{ name: 'Globex', title: 'Engineer' }],
                },
              },
            ],
          }),
          { status: 200 }
        )
      );

      const result = await callTool(tools, 'contacts_search', {
        query: 'Bob',
        googleAccessToken: 'fake-token',
      });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('Bob Jones');
      expect(text).toContain('bob@example.com');
      expect(text).toContain('+1-555-0200');
    });

    test('returns empty message when Google returns no results', async () => {
      mockFetch(() => new Response(JSON.stringify({ results: [] }), { status: 200 }));

      const result = await callTool(tools, 'contacts_search', {
        query: 'Nobody',
        googleAccessToken: 'fake-token',
      });

      expect(result.content[0].text).toContain('No contacts found');
    });

    test('returns error when Google People API returns HTTP error', async () => {
      mockFetch(() => new Response('Unauthorized', { status: 401 }));

      const result = await callTool(tools, 'contacts_search', {
        query: 'Alice',
        googleAccessToken: 'bad-token',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error searching contacts');
    });

    test('fences Google contact fields', async () => {
      mockFetch(() =>
        new Response(
          JSON.stringify({
            results: [
              {
                person: {
                  resourceName: 'people/c1',
                  names: [{ displayName: '<b>Injected Name</b>' }],
                  emailAddresses: [],
                  phoneNumbers: [],
                  organizations: [],
                },
              },
            ],
          }),
          { status: 200 }
        )
      );

      const result = await callTool(tools, 'contacts_search', {
        query: 'Injected',
        googleAccessToken: 'fake-token',
      });

      const text = result.content[0].text as string;
      expect(text).toContain('UNTRUSTED_BEGIN');
      expect(text).toContain('<b>Injected Name</b>');
    });
  });

  // ---------- contacts_get ----------

  describe('contacts_get', () => {
    test('returns error when neither id nor name is provided', async () => {
      const result = await callTool(tools, 'contacts_get', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('provide either');
    });

    test('returns full contact detail for Apple contact by name', async () => {
      const detail = {
        id: 'abc-123',
        name: 'Alice Smith',
        firstName: 'Alice',
        lastName: 'Smith',
        organization: 'Acme Corp',
        jobTitle: 'Engineer',
        note: 'Met at conference',
        birthday: '',
        emails: [{ label: 'work', value: 'alice@example.com' }],
        phones: [{ label: 'mobile', value: '+1-555-0100' }],
        addresses: [
          {
            label: 'home',
            street: '123 Main St',
            city: 'Springfield',
            state: 'IL',
            zip: '62701',
            country: 'US',
          },
        ],
        groups: ['Friends'],
      };
      _jxaImpl = async () => JSON.stringify(detail);

      const result = await callTool(tools, 'contacts_get', { name: 'Alice Smith' });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('Alice Smith');
      expect(text).toContain('alice@example.com');
      expect(text).toContain('+1-555-0100');
      expect(text).toContain('123 Main St');
      expect(text).toContain('Friends');
    });

    test('fences all fields in contact detail output', async () => {
      const detail = {
        id: 'abc-123',
        name: 'Injected <script>pwn()</script>',
        firstName: 'Injected',
        lastName: '<script>pwn()</script>',
        organization: '',
        jobTitle: '',
        note: '',
        birthday: '',
        emails: [],
        phones: [],
        addresses: [],
        groups: [],
      };
      _jxaImpl = async () => JSON.stringify(detail);

      const result = await callTool(tools, 'contacts_get', { name: 'Injected' });
      const text = result.content[0].text as string;

      expect(text).toContain('UNTRUSTED_BEGIN');
      expect(text).toContain('<script>pwn()</script>');
    });

    test('returns error when JXA throws', async () => {
      setJxaError('Contact not found');

      const result = await callTool(tools, 'contacts_get', { id: 'bad-id' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error retrieving contact');
    });

    test('uses Google People API when googleAccessToken is provided', async () => {
      mockFetch(() =>
        new Response(
          JSON.stringify({
            resourceName: 'people/c123',
            names: [{ displayName: 'Carol White' }],
            emailAddresses: [{ value: 'carol@example.com', type: 'home' }],
            phoneNumbers: [],
            organizations: [],
          }),
          { status: 200 }
        )
      );

      const result = await callTool(tools, 'contacts_get', {
        id: 'people/c123',
        googleAccessToken: 'fake-token',
      });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('Carol White');
      expect(text).toContain('carol@example.com');
    });
  });

  // ---------- contacts_list_groups ----------

  describe('contacts_list_groups', () => {
    test('returns Apple contact groups', async () => {
      setJxaResult([
        { id: 'grp-1', name: 'Family', memberCount: 5 },
        { id: 'grp-2', name: 'Work', memberCount: 12 },
      ]);

      const result = await callTool(tools, 'contacts_list_groups', {});

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('Family');
      expect(text).toContain('Work');
      expect(text).toContain('12');
    });

    test('returns empty message when no groups exist', async () => {
      setJxaResult([]);

      const result = await callTool(tools, 'contacts_list_groups', {});

      expect(result.content[0].text).toContain('No contact groups found');
    });

    test('fences group names', async () => {
      setJxaResult([{ id: 'grp-1', name: '<b>Injected</b>', memberCount: 1 }]);

      const result = await callTool(tools, 'contacts_list_groups', {});
      const text = result.content[0].text as string;

      expect(text).toContain('UNTRUSTED_BEGIN');
      expect(text).toContain('<b>Injected</b>');
    });

    test('returns error when osascript fails', async () => {
      setJxaError('osascript: error');

      const result = await callTool(tools, 'contacts_list_groups', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error listing contact groups');
    });

    test('uses Google People API when googleAccessToken provided', async () => {
      mockFetch(() =>
        new Response(
          JSON.stringify({
            contactGroups: [
              {
                resourceName: 'contactGroups/1',
                name: 'starred',
                formattedName: 'Starred',
                groupType: 'SYSTEM_CONTACT_GROUP',
                memberCount: 3,
              },
              {
                resourceName: 'contactGroups/2',
                name: 'friends',
                formattedName: 'Friends',
                groupType: 'USER_CONTACT_GROUP',
                memberCount: 7,
              },
            ],
          }),
          { status: 200 }
        )
      );

      const result = await callTool(tools, 'contacts_list_groups', {
        googleAccessToken: 'fake-token',
      });

      const text = result.content[0].text as string;
      expect(text).toContain('Starred');
      expect(text).toContain('Friends');
      expect(text).toContain('7');
    });
  });

  // ---------- contacts_create ----------

  describe('contacts_create', () => {
    test('returns error when neither firstName nor lastName provided', async () => {
      const result = await callTool(tools, 'contacts_create', { email: 'x@x.com' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('firstName');
    });

    test('creates contact and returns id and name', async () => {
      _jxaImpl = async () => JSON.stringify({ id: 'new-1', name: 'Dave Lee' });

      const result = await callTool(tools, 'contacts_create', {
        firstName: 'Dave',
        lastName: 'Lee',
        email: 'dave@example.com',
        phone: '+1-555-0300',
      });

      expect(result.content[0].type).toBe('text');
      const text = result.content[0].text as string;
      expect(text).toContain('Contact created successfully');
      expect(text).toContain('Dave Lee');
      expect(text).toContain('new-1');
    });

    test('works with only firstName provided', async () => {
      _jxaImpl = async () => JSON.stringify({ id: 'new-5', name: 'Eve' });

      const result = await callTool(tools, 'contacts_create', { firstName: 'Eve' });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Contact created successfully');
    });

    test('works with only lastName provided', async () => {
      _jxaImpl = async () => JSON.stringify({ id: 'new-6', name: 'Green' });

      const result = await callTool(tools, 'contacts_create', { lastName: 'Green' });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Contact created successfully');
    });

    test('fences created contact name in response', async () => {
      _jxaImpl = async () =>
        JSON.stringify({ id: 'new-4', name: '<script>alert(2)</script>' });

      const result = await callTool(tools, 'contacts_create', { firstName: 'Test' });
      const text = result.content[0].text as string;

      expect(text).toContain('UNTRUSTED_BEGIN');
      expect(text).toContain('<script>alert(2)</script>');
    });

    test('returns error when osascript fails', async () => {
      setJxaError('Permission denied');

      const result = await callTool(tools, 'contacts_create', {
        firstName: 'TestUser',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error creating contact');
    });
  });
});
