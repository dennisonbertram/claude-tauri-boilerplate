import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';
import { runJxa } from './jxa';

// ---------------------------------------------------------------------------
// Google People API helper
// ---------------------------------------------------------------------------

export async function searchGoogleContacts(
  accessToken: string,
  query: string,
  pageSize = 20
): Promise<GooglePerson[]> {
  const url =
    `https://people.googleapis.com/v1/people:searchContacts` +
    `?query=${encodeURIComponent(query)}&pageSize=${pageSize}` +
    `&readMask=names,emailAddresses,phoneNumbers,organizations,resourceName`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google People API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { results?: Array<{ person: GooglePerson }> };
  return (data.results ?? []).map((r) => r.person);
}

export async function listGoogleContactGroups(accessToken: string): Promise<GoogleContactGroup[]> {
  const url = `https://people.googleapis.com/v1/contactGroups?pageSize=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google People API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { contactGroups?: GoogleContactGroup[] };
  return data.contactGroups ?? [];
}

export async function getGoogleContact(
  accessToken: string,
  resourceName: string
): Promise<GooglePerson> {
  const url =
    `https://people.googleapis.com/v1/${resourceName}` +
    `?personFields=names,emailAddresses,phoneNumbers,organizations,addresses,birthdays,biographies`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google People API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as GooglePerson;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GooglePerson {
  resourceName?: string;
  names?: Array<{ displayName?: string; givenName?: string; familyName?: string }>;
  emailAddresses?: Array<{ value?: string; type?: string }>;
  phoneNumbers?: Array<{ value?: string; type?: string }>;
  organizations?: Array<{ name?: string; title?: string }>;
  addresses?: Array<{ formattedValue?: string; type?: string }>;
  birthdays?: Array<{ date?: { year?: number; month?: number; day?: number } }>;
  biographies?: Array<{ value?: string }>;
}

interface GoogleContactGroup {
  resourceName?: string;
  name?: string;
  formattedName?: string;
  groupType?: string;
  memberCount?: number;
}

// ---------------------------------------------------------------------------
// contacts_search
// ---------------------------------------------------------------------------

function createSearchTool(_db: Database) {
  return tool(
    'contacts_search',
    'Search contacts by name, email, or phone number. Uses Apple Contacts on macOS via osascript, or Google Contacts via the People API as an alternative.',
    {
      query: z.string().describe('Search term: a name, email address, or phone number'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum results to return (1-50, default 20)'),
      googleAccessToken: z
        .string()
        .optional()
        .describe('Google OAuth access token. If provided, uses Google Contacts instead of Apple Contacts.'),
    },
    async (args) => {
      try {
        const max = args.maxResults ?? 20;

        if (args.googleAccessToken) {
          // --- Google People API path ---
          const people = await searchGoogleContacts(args.googleAccessToken, args.query, max);

          if (people.length === 0) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `No contacts found matching: ${fenceUntrustedContent(args.query, 'contacts.query')}`,
                },
              ],
            };
          }

          const lines: string[] = [
            `Found ${people.length} contact${people.length !== 1 ? 's' : ''} matching ${fenceUntrustedContent(args.query, 'contacts.query')}:`,
            '',
          ];

          for (const p of people) {
            const name = p.names?.[0]?.displayName ?? '(unknown)';
            const email = p.emailAddresses?.[0]?.value ?? '';
            const phone = p.phoneNumbers?.[0]?.value ?? '';
            const org = p.organizations?.[0]?.name ?? '';

            lines.push(
              `ID: ${fenceUntrustedContent(p.resourceName ?? '', 'contacts')}`,
              `Name: ${fenceUntrustedContent(name, 'contacts')}`,
              ...(email ? [`Email: ${fenceUntrustedContent(email, 'contacts')}`] : []),
              ...(phone ? [`Phone: ${fenceUntrustedContent(phone, 'contacts')}`] : []),
              ...(org ? [`Organization: ${fenceUntrustedContent(org, 'contacts')}`] : []),
              ''
            );
          }

          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        }

        // --- Apple Contacts via JXA ---
        const script = `
          var app = Application("Contacts");
          var query = ${JSON.stringify(args.query)};
          var max = ${max};
          var byName = app.people.whose({name: {_contains: query}});
          var byEmail = app.people.whose({emails: {value: {_contains: query}}});
          var byPhone = app.people.whose({phones: {value: {_contains: query}}});

          var seen = {};
          var results = [];

          function addPerson(p) {
            try {
              var id = p.id();
              if (seen[id]) return;
              seen[id] = true;
              if (results.length >= max) return;
              var emails = [];
              var phones = [];
              try { p.emails().forEach(function(e) { emails.push(e.value()); }); } catch(e) {}
              try { p.phones().forEach(function(ph) { phones.push(ph.value()); }); } catch(e) {}
              results.push({
                id: id,
                name: p.name(),
                emails: emails,
                phones: phones,
                organization: (function() { try { return p.organization(); } catch(e) { return ""; } })()
              });
            } catch(e) {}
          }

          [byName, byEmail, byPhone].forEach(function(list) {
            try {
              list.forEach(function(p) { addPerson(p); });
            } catch(e) {}
          });

          JSON.stringify(results);
        `;

        const raw = await runJxa(script);
        const contacts: Array<{
          id: string;
          name: string;
          emails: string[];
          phones: string[];
          organization: string;
        }> = JSON.parse(raw || '[]');

        if (contacts.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No contacts found matching: ${fenceUntrustedContent(args.query, 'contacts.query')}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${contacts.length} contact${contacts.length !== 1 ? 's' : ''} matching ${fenceUntrustedContent(args.query, 'contacts.query')}:`,
          '',
        ];

        for (const c of contacts) {
          lines.push(
            `ID: ${fenceUntrustedContent(c.id, 'contacts')}`,
            `Name: ${fenceUntrustedContent(c.name, 'contacts')}`,
            ...(c.emails.length > 0
              ? [`Email: ${c.emails.map((e) => fenceUntrustedContent(e, 'contacts')).join(', ')}`]
              : []),
            ...(c.phones.length > 0
              ? [`Phone: ${c.phones.map((p) => fenceUntrustedContent(p, 'contacts')).join(', ')}`]
              : []),
            ...(c.organization ? [`Organization: ${fenceUntrustedContent(c.organization, 'contacts')}`] : []),
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching contacts: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Contacts',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// contacts_get
// ---------------------------------------------------------------------------

function createGetTool(_db: Database) {
  return tool(
    'contacts_get',
    'Get full contact details by ID (Apple Contacts UUID or Google resourceName) or by name. Returns all available fields.',
    {
      id: z
        .string()
        .optional()
        .describe('Apple Contacts UUID or Google People resourceName (e.g. "people/c12345")'),
      name: z.string().optional().describe('Contact name to look up (used if id is not provided)'),
      googleAccessToken: z
        .string()
        .optional()
        .describe('Google OAuth access token. Required when looking up a Google contact by resourceName.'),
    },
    async (args) => {
      if (!args.id && !args.name) {
        return {
          content: [{ type: 'text' as const, text: 'Error: provide either "id" or "name".' }],
          isError: true,
        };
      }

      try {
        if (args.googleAccessToken && args.id) {
          // --- Google People API path ---
          const p = await getGoogleContact(args.googleAccessToken, args.id);

          const name = p.names?.[0]?.displayName ?? '(unknown)';
          const emails = p.emailAddresses?.map((e) => `${e.value ?? ''} (${e.type ?? 'other'})`).join(', ') ?? '';
          const phones = p.phoneNumbers?.map((ph) => `${ph.value ?? ''} (${ph.type ?? 'other'})`).join(', ') ?? '';
          const org = p.organizations?.[0]?.name ?? '';
          const title = p.organizations?.[0]?.title ?? '';
          const address = p.addresses?.[0]?.formattedValue ?? '';
          const bio = p.biographies?.[0]?.value ?? '';

          const lines = [
            `ID: ${fenceUntrustedContent(p.resourceName ?? '', 'contacts')}`,
            `Name: ${fenceUntrustedContent(name, 'contacts')}`,
            ...(emails ? [`Email: ${fenceUntrustedContent(emails, 'contacts')}`] : []),
            ...(phones ? [`Phone: ${fenceUntrustedContent(phones, 'contacts')}`] : []),
            ...(org ? [`Organization: ${fenceUntrustedContent(org, 'contacts')}`] : []),
            ...(title ? [`Title: ${fenceUntrustedContent(title, 'contacts')}`] : []),
            ...(address ? [`Address: ${fenceUntrustedContent(address, 'contacts')}`] : []),
            ...(bio ? [`Bio: ${fenceUntrustedContent(bio, 'contacts')}`] : []),
          ];

          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        }

        // --- Apple Contacts via JXA ---
        const lookupExpr = args.id
          ? `app.people.byId(${JSON.stringify(args.id)})`
          : `app.people.whose({name: {_contains: ${JSON.stringify(args.name)}}})[0]`;

        const script = `
          var app = Application("Contacts");
          var p = ${lookupExpr};
          if (!p) throw new Error("Contact not found");

          var emails = [];
          var phones = [];
          var addresses = [];
          var groups = [];

          try { p.emails().forEach(function(e) { emails.push({label: e.label(), value: e.value()}); }); } catch(ex) {}
          try { p.phones().forEach(function(ph) { phones.push({label: ph.label(), value: ph.value()}); }); } catch(ex) {}
          try { p.addresses().forEach(function(a) { addresses.push({label: a.label(), street: a.street(), city: a.city(), state: a.state(), zip: a.zip(), country: a.country()}); }); } catch(ex) {}
          try { p.groups().forEach(function(g) { groups.push(g.name()); }); } catch(ex) {}

          JSON.stringify({
            id: p.id(),
            name: p.name(),
            firstName: (function() { try { return p.firstName(); } catch(ex) { return ""; } })(),
            lastName: (function() { try { return p.lastName(); } catch(ex) { return ""; } })(),
            organization: (function() { try { return p.organization(); } catch(ex) { return ""; } })(),
            jobTitle: (function() { try { return p.jobTitle(); } catch(ex) { return ""; } })(),
            note: (function() { try { return p.note(); } catch(ex) { return ""; } })(),
            birthday: (function() { try { return p.birthdate() ? p.birthdate().toString() : ""; } catch(ex) { return ""; } })(),
            emails: emails,
            phones: phones,
            addresses: addresses,
            groups: groups
          });
        `;

        const raw = await runJxa(script);
        const c = JSON.parse(raw) as {
          id: string;
          name: string;
          firstName: string;
          lastName: string;
          organization: string;
          jobTitle: string;
          note: string;
          birthday: string;
          emails: Array<{ label: string; value: string }>;
          phones: Array<{ label: string; value: string }>;
          addresses: Array<{
            label: string;
            street: string;
            city: string;
            state: string;
            zip: string;
            country: string;
          }>;
          groups: string[];
        };

        const lines: string[] = [
          `ID: ${fenceUntrustedContent(c.id, 'contacts')}`,
          `Name: ${fenceUntrustedContent(c.name, 'contacts')}`,
          ...(c.firstName || c.lastName
            ? [`First/Last: ${fenceUntrustedContent(`${c.firstName} ${c.lastName}`.trim(), 'contacts')}`]
            : []),
          ...(c.organization ? [`Organization: ${fenceUntrustedContent(c.organization, 'contacts')}`] : []),
          ...(c.jobTitle ? [`Title: ${fenceUntrustedContent(c.jobTitle, 'contacts')}`] : []),
          ...(c.birthday ? [`Birthday: ${fenceUntrustedContent(c.birthday, 'contacts')}`] : []),
          ...(c.emails.length > 0
            ? [
                'Emails:',
                ...c.emails.map((e) => `  ${fenceUntrustedContent(e.label, 'contacts')}: ${fenceUntrustedContent(e.value, 'contacts')}`),
              ]
            : []),
          ...(c.phones.length > 0
            ? [
                'Phones:',
                ...c.phones.map((p) => `  ${fenceUntrustedContent(p.label, 'contacts')}: ${fenceUntrustedContent(p.value, 'contacts')}`),
              ]
            : []),
          ...(c.addresses.length > 0
            ? [
                'Addresses:',
                ...c.addresses.map((a) => {
                  const addr = [a.street, a.city, a.state, a.zip, a.country].filter(Boolean).join(', ');
                  return `  ${fenceUntrustedContent(a.label, 'contacts')}: ${fenceUntrustedContent(addr, 'contacts')}`;
                }),
              ]
            : []),
          ...(c.groups.length > 0
            ? [`Groups: ${c.groups.map((g) => fenceUntrustedContent(g, 'contacts')).join(', ')}`]
            : []),
          ...(c.note ? [`Note: ${fenceUntrustedContent(c.note, 'contacts')}`] : []),
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error retrieving contact: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Contact Details',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// contacts_list_groups
// ---------------------------------------------------------------------------

function createListGroupsTool(_db: Database) {
  return tool(
    'contacts_list_groups',
    'List contact groups (Apple Contacts groups or Google Contact labels). Returns group names and member counts where available.',
    {
      googleAccessToken: z
        .string()
        .optional()
        .describe('Google OAuth access token. If provided, lists Google Contact labels instead of Apple groups.'),
    },
    async (args) => {
      try {
        if (args.googleAccessToken) {
          // --- Google People API path ---
          const groups = await listGoogleContactGroups(args.googleAccessToken);

          if (groups.length === 0) {
            return {
              content: [{ type: 'text' as const, text: 'No contact groups found.' }],
            };
          }

          const lines: string[] = [`Found ${groups.length} contact group${groups.length !== 1 ? 's' : ''}:`, ''];

          for (const g of groups) {
            const name = g.formattedName ?? g.name ?? '(unnamed)';
            const count = g.memberCount != null ? ` (${g.memberCount} members)` : '';
            const type = g.groupType ? ` [${g.groupType}]` : '';
            lines.push(`${fenceUntrustedContent(name, 'contacts')}${count}${type}`);
          }

          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        }

        // --- Apple Contacts via JXA ---
        const script = `
          var app = Application("Contacts");
          var groups = app.groups();
          var result = [];
          groups.forEach(function(g) {
            try {
              var memberCount = 0;
              try { memberCount = g.people().length; } catch(e) {}
              result.push({ id: g.id(), name: g.name(), memberCount: memberCount });
            } catch(e) {}
          });
          JSON.stringify(result);
        `;

        const raw = await runJxa(script);
        const groups: Array<{ id: string; name: string; memberCount: number }> = JSON.parse(raw || '[]');

        if (groups.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No contact groups found.' }],
          };
        }

        const lines: string[] = [`Found ${groups.length} contact group${groups.length !== 1 ? 's' : ''}:`, ''];

        for (const g of groups) {
          lines.push(
            `ID: ${fenceUntrustedContent(g.id, 'contacts')}`,
            `Name: ${fenceUntrustedContent(g.name, 'contacts')}`,
            `Members: ${g.memberCount}`,
            ''
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error listing contact groups: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Contact Groups',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// contacts_create
// ---------------------------------------------------------------------------

function createCreateTool(_db: Database) {
  return tool(
    'contacts_create',
    'Create a new contact. Uses Apple Contacts on macOS. Requires at least a first name or last name.',
    {
      firstName: z.string().optional().describe('Contact first name'),
      lastName: z.string().optional().describe('Contact last name'),
      email: z.string().optional().describe('Primary email address'),
      phone: z.string().optional().describe('Primary phone number'),
      organization: z.string().optional().describe('Company or organization name'),
      jobTitle: z.string().optional().describe('Job title'),
      note: z.string().optional().describe('Notes about the contact'),
    },
    async (args) => {
      if (!args.firstName && !args.lastName) {
        return {
          content: [
            { type: 'text' as const, text: 'Error: at least one of "firstName" or "lastName" is required.' },
          ],
          isError: true,
        };
      }

      try {
        const script = `
          var app = Application("Contacts");

          var props = {};
          ${args.firstName ? `props.firstName = ${JSON.stringify(args.firstName)};` : ''}
          ${args.lastName ? `props.lastName = ${JSON.stringify(args.lastName)};` : ''}
          ${args.organization ? `props.organization = ${JSON.stringify(args.organization)};` : ''}
          ${args.jobTitle ? `props.jobTitle = ${JSON.stringify(args.jobTitle)};` : ''}
          ${args.note ? `props.note = ${JSON.stringify(args.note)};` : ''}

          var person = app.Person(props);
          app.add(person);

          ${
            args.email
              ? `
          var emailEntry = app.Email({label: "work", value: ${JSON.stringify(args.email)}});
          app.add(emailEntry, {to: person.emails});
          `
              : ''
          }

          ${
            args.phone
              ? `
          var phoneEntry = app.Phone({label: "mobile", value: ${JSON.stringify(args.phone)}});
          app.add(phoneEntry, {to: person.phones});
          `
              : ''
          }

          app.save();
          JSON.stringify({ id: person.id(), name: person.name() });
        `;

        const raw = await runJxa(script);
        const created = JSON.parse(raw) as { id: string; name: string };

        const lines = [
          'Contact created successfully.',
          `ID: ${fenceUntrustedContent(created.id, 'contacts')}`,
          `Name: ${fenceUntrustedContent(created.name, 'contacts')}`,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            { type: 'text' as const, text: `Error creating contact: ${sanitizeError(error)}` },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Create Contact',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createContactsTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'contacts_search',
      description: 'Search contacts by name, email, or phone',
      sdkTool: createSearchTool(db),
    },
    {
      name: 'contacts_get',
      description: 'Get full contact details by ID or name',
      sdkTool: createGetTool(db),
    },
    {
      name: 'contacts_list_groups',
      description: 'List contact groups or labels',
      sdkTool: createListGroupsTool(db),
    },
    {
      name: 'contacts_create',
      description: 'Create a new contact',
      sdkTool: createCreateTool(db),
    },
  ];
}
