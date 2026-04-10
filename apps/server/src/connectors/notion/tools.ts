import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const MAX_CONTENT_LENGTH = 50_000; // ~50KB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getToken(): string {
  const token = process.env.NOTION_API_TOKEN;
  if (!token) throw new Error('NOTION_API_TOKEN is not configured');
  return token;
}

function notionHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionFetch(path: string, options?: RequestInit): Promise<unknown> {
  const url = `${NOTION_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...notionHeaders(),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API error ${res.status}: ${body.substring(0, 200)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Block content extraction
// ---------------------------------------------------------------------------

interface RichTextItem {
  plain_text?: string;
}

interface Block {
  type?: string;
  paragraph?: { rich_text?: RichTextItem[] };
  heading_1?: { rich_text?: RichTextItem[] };
  heading_2?: { rich_text?: RichTextItem[] };
  heading_3?: { rich_text?: RichTextItem[] };
  bulleted_list_item?: { rich_text?: RichTextItem[] };
  numbered_list_item?: { rich_text?: RichTextItem[] };
  to_do?: { rich_text?: RichTextItem[]; checked?: boolean };
  toggle?: { rich_text?: RichTextItem[] };
  quote?: { rich_text?: RichTextItem[] };
  callout?: { rich_text?: RichTextItem[] };
  code?: { rich_text?: RichTextItem[]; language?: string };
  child_page?: { title?: string };
  child_database?: { title?: string };
  [key: string]: unknown;
}

function extractRichText(items?: RichTextItem[]): string {
  if (!items || items.length === 0) return '';
  return items.map((item) => item.plain_text ?? '').join('');
}

export function extractBlockText(block: Block): string {
  const type = block.type;
  if (!type) return '';

  switch (type) {
    case 'paragraph':
      return extractRichText(block.paragraph?.rich_text);
    case 'heading_1':
      return `# ${extractRichText(block.heading_1?.rich_text)}`;
    case 'heading_2':
      return `## ${extractRichText(block.heading_2?.rich_text)}`;
    case 'heading_3':
      return `### ${extractRichText(block.heading_3?.rich_text)}`;
    case 'bulleted_list_item':
      return `- ${extractRichText(block.bulleted_list_item?.rich_text)}`;
    case 'numbered_list_item':
      return `1. ${extractRichText(block.numbered_list_item?.rich_text)}`;
    case 'to_do': {
      const checked = block.to_do?.checked ? '[x]' : '[ ]';
      return `${checked} ${extractRichText(block.to_do?.rich_text)}`;
    }
    case 'toggle':
      return `> ${extractRichText(block.toggle?.rich_text)}`;
    case 'quote':
      return `> ${extractRichText(block.quote?.rich_text)}`;
    case 'callout':
      return `💡 ${extractRichText(block.callout?.rich_text)}`;
    case 'code': {
      const lang = block.code?.language ?? '';
      const code = extractRichText(block.code?.rich_text);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case 'child_page':
      return `[Page: ${block.child_page?.title ?? '(untitled)'}]`;
    case 'child_database':
      return `[Database: ${block.child_database?.title ?? '(untitled)'}]`;
    case 'divider':
      return '---';
    default:
      return `[${type} block]`;
  }
}

// ---------------------------------------------------------------------------
// Markdown-like content to Notion blocks
// ---------------------------------------------------------------------------

function textToNotionBlocks(content: string): unknown[] {
  const lines = content.split('\n');
  const blocks: unknown[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] },
      });
    } else if (line.startsWith('## ')) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] },
      });
    } else if (line.startsWith('### ')) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] },
      });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] },
      });
    } else if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\. /, '');
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: [{ type: 'text', text: { content: text } }] },
      });
    } else {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: line ? [{ type: 'text', text: { content: line } }] : [] },
      });
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// notion_search
// ---------------------------------------------------------------------------

function createSearchTool(_db: Database) {
  return tool(
    'notion_search',
    'Search across all Notion pages and databases accessible to the integration. Note: Notion API rate limit is ~3 req/sec.',
    {
      query: z
        .string()
        .describe('Text to search for across page and database titles and content'),
      filter: z
        .enum(['page', 'database'])
        .optional()
        .describe('Filter results to only pages or only databases. Omit for both.'),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of results to return (1-100, default 20)'),
      startCursor: z
        .string()
        .optional()
        .describe('Pagination cursor from a previous response'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = {
          query: args.query,
          page_size: args.pageSize ?? 20,
        };
        if (args.filter) {
          body.filter = { value: args.filter, property: 'object' };
        }
        if (args.startCursor) {
          body.start_cursor = args.startCursor;
        }

        const data = (await notionFetch('/search', {
          method: 'POST',
          body: JSON.stringify(body),
        })) as {
          results: Array<{
            id: string;
            object: string;
            url?: string;
            properties?: Record<string, { title?: Array<{ plain_text?: string }> }>;
            title?: Array<{ plain_text?: string }>;
          }>;
          has_more: boolean;
          next_cursor?: string;
        };

        if (data.results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No results found for query: ${fenceUntrustedContent(args.query, 'notion.search')}`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${data.results.length} result${data.results.length !== 1 ? 's' : ''} for "${fenceUntrustedContent(args.query, 'notion.search')}":`,
          '',
        ];

        for (const item of data.results) {
          let title = '(untitled)';
          if (item.object === 'page' && item.properties) {
            const titleProp = Object.values(item.properties).find((p) => Array.isArray(p.title));
            if (titleProp?.title) {
              title = titleProp.title.map((t) => t.plain_text ?? '').join('');
            }
          } else if (item.object === 'database' && item.title) {
            title = item.title.map((t) => t.plain_text ?? '').join('');
          }

          lines.push(
            `ID: ${item.id}`,
            `Type: ${item.object}`,
            `Title: ${fenceUntrustedContent(title, 'Notion')}`,
            `URL: ${item.url ?? 'N/A'}`,
            ''
          );
        }

        if (data.has_more && data.next_cursor) {
          lines.push(`Next cursor: ${data.next_cursor}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error searching Notion: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search Notion',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notion_get_page
// ---------------------------------------------------------------------------

function createGetPageTool(_db: Database) {
  return tool(
    'notion_get_page',
    'Get a Notion page including its properties and first-level block content. Content is truncated at 50KB. Note: Notion API rate limit is ~3 req/sec.',
    {
      pageId: z.string().describe('The Notion page ID to retrieve'),
    },
    async (args) => {
      try {
        const [pageData, blocksData] = await Promise.all([
          notionFetch(`/pages/${args.pageId}`) as Promise<{
            id: string;
            url?: string;
            created_time?: string;
            last_edited_time?: string;
            archived?: boolean;
            properties?: Record<
              string,
              {
                type?: string;
                title?: Array<{ plain_text?: string }>;
                rich_text?: Array<{ plain_text?: string }>;
                number?: number | null;
                select?: { name?: string } | null;
                multi_select?: Array<{ name?: string }>;
                date?: { start?: string; end?: string } | null;
                checkbox?: boolean;
                url?: string | null;
                email?: string | null;
              }
            >;
          }>,
          notionFetch(`/blocks/${args.pageId}/children?page_size=100`) as Promise<{
            results: Block[];
            has_more: boolean;
          }>,
        ]);

        const lines: string[] = [
          `Page ID: ${pageData.id}`,
          `URL: ${pageData.url ?? 'N/A'}`,
          `Created: ${pageData.created_time ?? 'N/A'}`,
          `Last edited: ${pageData.last_edited_time ?? 'N/A'}`,
          `Archived: ${pageData.archived ?? false}`,
          '',
          '--- Properties ---',
        ];

        if (pageData.properties) {
          for (const [key, prop] of Object.entries(pageData.properties)) {
            let value = '';
            switch (prop.type) {
              case 'title':
                value = (prop.title ?? []).map((t) => t.plain_text ?? '').join('');
                break;
              case 'rich_text':
                value = (prop.rich_text ?? []).map((t) => t.plain_text ?? '').join('');
                break;
              case 'number':
                value = prop.number != null ? String(prop.number) : '';
                break;
              case 'select':
                value = prop.select?.name ?? '';
                break;
              case 'multi_select':
                value = (prop.multi_select ?? []).map((s) => s.name ?? '').join(', ');
                break;
              case 'date':
                value = prop.date
                  ? `${prop.date.start ?? ''}${prop.date.end ? ` → ${prop.date.end}` : ''}`
                  : '';
                break;
              case 'checkbox':
                value = prop.checkbox ? 'true' : 'false';
                break;
              case 'url':
                value = prop.url ?? '';
                break;
              case 'email':
                value = prop.email ?? '';
                break;
              default:
                value = `[${prop.type ?? 'unknown'} property]`;
            }
            if (value) {
              lines.push(`${key}: ${fenceUntrustedContent(value, 'Notion')}`);
            }
          }
        }

        lines.push('', '--- Content ---');

        const blockLines: string[] = [];
        for (const block of blocksData.results) {
          const text = extractBlockText(block);
          if (text) blockLines.push(text);
        }

        if (blocksData.has_more) {
          blockLines.push('\n[Content truncated — use block pagination to retrieve more]');
        }

        let content = blockLines.join('\n');
        if (content.length > MAX_CONTENT_LENGTH) {
          content = content.slice(0, MAX_CONTENT_LENGTH) + `\n\n[Content truncated at ${MAX_CONTENT_LENGTH} characters]`;
        }

        lines.push(fenceUntrustedContent(content, 'Notion'));

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving page: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Notion Page',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notion_create_page
// ---------------------------------------------------------------------------

function createCreatePageTool(_db: Database) {
  return tool(
    'notion_create_page',
    'Create a new page in Notion under a parent page or database. Content is converted from markdown-like syntax to Notion blocks. Note: Notion API rate limit is ~3 req/sec.',
    {
      parentId: z
        .string()
        .describe('ID of the parent page or database where the new page will be created'),
      parentType: z
        .enum(['page', 'database'])
        .describe('Whether the parent is a page or a database'),
      title: z.string().max(2000).describe('Title of the new page'),
      content: z
        .string()
        .max(50000)
        .optional()
        .describe(
          'Page content in markdown-like syntax. Supports headings (#, ##, ###), bullet lists (- or *), numbered lists, and paragraphs.'
        ),
    },
    async (args) => {
      try {
        const parent =
          args.parentType === 'database'
            ? { database_id: args.parentId }
            : { page_id: args.parentId };

        const properties: Record<string, unknown> = {
          title: {
            title: [{ type: 'text', text: { content: args.title } }],
          },
        };

        const children = args.content ? textToNotionBlocks(args.content) : [];

        const body: Record<string, unknown> = { parent, properties };
        if (children.length > 0) {
          body.children = children;
        }

        const result = (await notionFetch('/pages', {
          method: 'POST',
          body: JSON.stringify(body),
        })) as { id: string; url?: string; created_time?: string };

        const text = [
          'Page created successfully.',
          `Page ID: ${result.id}`,
          `URL: ${result.url ?? 'N/A'}`,
          `Created: ${result.created_time ?? 'N/A'}`,
        ].join('\n');

        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error creating page: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Create Notion Page',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notion_update_page
// ---------------------------------------------------------------------------

function createUpdatePageTool(_db: Database) {
  return tool(
    'notion_update_page',
    'Update properties of an existing Notion page, or archive/unarchive it. Note: Notion API rate limit is ~3 req/sec.',
    {
      pageId: z.string().describe('The Notion page ID to update'),
      title: z
        .string()
        .max(2000)
        .optional()
        .describe('New title for the page (only applicable for pages with a title property)'),
      archived: z
        .boolean()
        .optional()
        .describe('Set to true to archive (soft-delete) the page, false to unarchive'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = {};

        if (args.archived !== undefined) {
          body.archived = args.archived;
        }

        if (args.title !== undefined) {
          body.properties = {
            title: {
              title: [{ type: 'text', text: { content: args.title } }],
            },
          };
        }

        if (Object.keys(body).length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'Error: No updates specified. Provide title or archived.' }],
            isError: true,
          };
        }

        const result = (await notionFetch(`/pages/${args.pageId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })) as { id: string; url?: string; archived?: boolean; last_edited_time?: string };

        const text = [
          'Page updated successfully.',
          `Page ID: ${result.id}`,
          `URL: ${result.url ?? 'N/A'}`,
          `Archived: ${result.archived ?? false}`,
          `Last edited: ${result.last_edited_time ?? 'N/A'}`,
        ].join('\n');

        return { content: [{ type: 'text' as const, text }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error updating page: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Update Notion Page',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notion_query_database
// ---------------------------------------------------------------------------

function createQueryDatabaseTool(_db: Database) {
  return tool(
    'notion_query_database',
    'Query a Notion database with optional filters and sorts to retrieve matching pages. Note: Notion API rate limit is ~3 req/sec.',
    {
      databaseId: z.string().describe('The Notion database ID to query'),
      filter: z
        .string()
        .optional()
        .describe(
          'JSON string representing a Notion filter object (e.g. {"property":"Status","select":{"equals":"Done"}}). Refer to Notion API docs for filter syntax.'
        ),
      sorts: z
        .string()
        .optional()
        .describe(
          'JSON string representing an array of Notion sort objects (e.g. [{"property":"Date","direction":"descending"}])'
        ),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of results per page (1-100, default 20)'),
      startCursor: z.string().optional().describe('Pagination cursor from a previous response'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = {
          page_size: args.pageSize ?? 20,
        };

        if (args.filter) {
          try {
            body.filter = JSON.parse(args.filter);
          } catch {
            return {
              content: [{ type: 'text' as const, text: 'Error: filter must be a valid JSON string' }],
              isError: true,
            };
          }
        }

        if (args.sorts) {
          try {
            body.sorts = JSON.parse(args.sorts);
          } catch {
            return {
              content: [{ type: 'text' as const, text: 'Error: sorts must be a valid JSON string' }],
              isError: true,
            };
          }
        }

        if (args.startCursor) {
          body.start_cursor = args.startCursor;
        }

        const data = (await notionFetch(`/databases/${args.databaseId}/query`, {
          method: 'POST',
          body: JSON.stringify(body),
        })) as {
          results: Array<{
            id: string;
            url?: string;
            created_time?: string;
            last_edited_time?: string;
            properties?: Record<
              string,
              {
                type?: string;
                title?: Array<{ plain_text?: string }>;
                rich_text?: Array<{ plain_text?: string }>;
                number?: number | null;
                select?: { name?: string } | null;
                multi_select?: Array<{ name?: string }>;
                date?: { start?: string } | null;
                checkbox?: boolean;
                url?: string | null;
              }
            >;
          }>;
          has_more: boolean;
          next_cursor?: string;
        };

        if (data.results.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No results found in database query.' }],
          };
        }

        const lines: string[] = [
          `Found ${data.results.length} result${data.results.length !== 1 ? 's' : ''}:`,
          '',
        ];

        for (const page of data.results) {
          lines.push(`ID: ${page.id}`, `URL: ${page.url ?? 'N/A'}`);

          if (page.properties) {
            for (const [key, prop] of Object.entries(page.properties)) {
              let value = '';
              switch (prop.type) {
                case 'title':
                  value = (prop.title ?? []).map((t) => t.plain_text ?? '').join('');
                  break;
                case 'rich_text':
                  value = (prop.rich_text ?? []).map((t) => t.plain_text ?? '').join('');
                  break;
                case 'number':
                  value = prop.number != null ? String(prop.number) : '';
                  break;
                case 'select':
                  value = prop.select?.name ?? '';
                  break;
                case 'multi_select':
                  value = (prop.multi_select ?? []).map((s) => s.name ?? '').join(', ');
                  break;
                case 'date':
                  value = prop.date?.start ?? '';
                  break;
                case 'checkbox':
                  value = prop.checkbox ? 'true' : 'false';
                  break;
                case 'url':
                  value = prop.url ?? '';
                  break;
              }
              if (value) {
                lines.push(`  ${key}: ${fenceUntrustedContent(value, 'Notion')}`);
              }
            }
          }
          lines.push('');
        }

        if (data.has_more && data.next_cursor) {
          lines.push(`Next cursor: ${data.next_cursor}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error querying database: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Query Notion Database',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// notion_get_database
// ---------------------------------------------------------------------------

function createGetDatabaseTool(_db: Database) {
  return tool(
    'notion_get_database',
    'Get a Notion database schema including all property definitions. Use this to understand the structure before querying. Note: Notion API rate limit is ~3 req/sec.',
    {
      databaseId: z.string().describe('The Notion database ID to retrieve'),
    },
    async (args) => {
      try {
        const data = (await notionFetch(`/databases/${args.databaseId}`)) as {
          id: string;
          url?: string;
          created_time?: string;
          last_edited_time?: string;
          title?: Array<{ plain_text?: string }>;
          description?: Array<{ plain_text?: string }>;
          properties?: Record<
            string,
            {
              type?: string;
              id?: string;
              name?: string;
              select?: { options?: Array<{ name?: string; color?: string }> };
              multi_select?: { options?: Array<{ name?: string; color?: string }> };
              status?: { options?: Array<{ name?: string; color?: string }> };
              relation?: { database_id?: string };
            }
          >;
        };

        const title = (data.title ?? []).map((t) => t.plain_text ?? '').join('') || '(untitled)';
        const description = (data.description ?? []).map((t) => t.plain_text ?? '').join('');

        const lines: string[] = [
          `Database ID: ${data.id}`,
          `Title: ${fenceUntrustedContent(title, 'Notion')}`,
        ];

        if (description) {
          lines.push(`Description: ${fenceUntrustedContent(description, 'Notion')}`);
        }

        lines.push(
          `URL: ${data.url ?? 'N/A'}`,
          `Created: ${data.created_time ?? 'N/A'}`,
          `Last edited: ${data.last_edited_time ?? 'N/A'}`,
          '',
          '--- Properties ---'
        );

        if (data.properties) {
          for (const [name, prop] of Object.entries(data.properties)) {
            const type = prop.type ?? 'unknown';
            let extra = '';

            if (type === 'select' && prop.select?.options) {
              const opts = prop.select.options.map((o) => o.name ?? '').filter(Boolean);
              if (opts.length > 0) extra = ` (options: ${opts.join(', ')})`;
            } else if (type === 'multi_select' && prop.multi_select?.options) {
              const opts = prop.multi_select.options.map((o) => o.name ?? '').filter(Boolean);
              if (opts.length > 0) extra = ` (options: ${opts.join(', ')})`;
            } else if (type === 'status' && prop.status?.options) {
              const opts = prop.status.options.map((o) => o.name ?? '').filter(Boolean);
              if (opts.length > 0) extra = ` (options: ${opts.join(', ')})`;
            } else if (type === 'relation' && prop.relation?.database_id) {
              extra = ` (related database: ${prop.relation.database_id})`;
            }

            lines.push(`  ${fenceUntrustedContent(name, 'Notion')}: ${type}${extra}`);
          }
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving database: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Notion Database',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'notion_search',
      description: 'Search across Notion pages and databases',
      sdkTool: createSearchTool(db),
    },
    {
      name: 'notion_get_page',
      description: 'Get a Notion page with its properties and content',
      sdkTool: createGetPageTool(db),
    },
    {
      name: 'notion_create_page',
      description: 'Create a new Notion page',
      sdkTool: createCreatePageTool(db),
    },
    {
      name: 'notion_update_page',
      description: 'Update properties or archive a Notion page',
      sdkTool: createUpdatePageTool(db),
    },
    {
      name: 'notion_query_database',
      description: 'Query a Notion database with filters and sorts',
      sdkTool: createQueryDatabaseTool(db),
    },
    {
      name: 'notion_get_database',
      description: 'Get a Notion database schema/properties',
      sdkTool: createGetDatabaseTool(db),
    },
  ];
}
