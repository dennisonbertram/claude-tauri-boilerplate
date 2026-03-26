import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';
import { listMessages } from '../../services/google/gmail';

// ---------------------------------------------------------------------------
// LinkedIn API helpers
// ---------------------------------------------------------------------------

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

function getToken(): string {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    throw new Error('LINKEDIN_ACCESS_TOKEN is not set');
  }
  return token;
}

async function linkedinGet<T = unknown>(path: string): Promise<T> {
  const token = getToken();
  const url = `${LINKEDIN_API_BASE}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`LinkedIn API error ${response.status}: ${body.substring(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

async function linkedinPost<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = getToken();
  const url = `${LINKEDIN_API_BASE}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const respBody = await response.text().catch(() => '');
    throw new Error(`LinkedIn API error ${response.status}: ${respBody.substring(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// linkedin_get_profile
// ---------------------------------------------------------------------------

function createGetProfileTool(_db: Database) {
  return tool(
    'linkedin_get_profile',
    'Get the authenticated user\'s basic LinkedIn profile information via OpenID Connect userinfo endpoint. Returns name, email, and profile picture URL. Note: LinkedIn API access is very restricted — only basic profile info is available without partner access.',
    {},
    async (_args) => {
      try {
        const profile = await linkedinGet<{
          sub?: string;
          name?: string;
          given_name?: string;
          family_name?: string;
          email?: string;
          email_verified?: boolean;
          picture?: string;
          locale?: string;
        }>('/userinfo');

        const fullName =
          profile.name ??
          (`${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim() || '(not available)');

        const lines = [
          'LinkedIn Profile:',
          `Name: ${fenceUntrustedContent(fullName, 'LinkedIn')}`,
          `Email: ${profile.email ?? '(not available)'}`,
          `Email Verified: ${profile.email_verified ?? 'unknown'}`,
          `Picture: ${profile.picture ?? '(not available)'}`,
          `Locale: ${profile.locale ?? '(not available)'}`,
          `Sub (ID): ${profile.sub ?? '(not available)'}`,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error getting LinkedIn profile: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get LinkedIn Profile',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// linkedin_get_connections_count
// ---------------------------------------------------------------------------

function createGetConnectionsCountTool(_db: Database) {
  return tool(
    'linkedin_get_connections_count',
    'Get the approximate count of the authenticated user\'s LinkedIn connections. Note: LinkedIn API restricts connection data — this endpoint may return a 403 Forbidden unless your app has been granted partner access with the r_network_size scope.',
    {},
    async (_args) => {
      try {
        const data = await linkedinGet<{
          paging?: { total?: number };
          elements?: unknown[];
          [key: string]: unknown;
        }>('/connections?q=viewer&start=0&count=0');

        const total = data.paging?.total;
        if (total !== undefined) {
          return {
            content: [{ type: 'text' as const, text: `LinkedIn connections count: ${total}` }],
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: 'LinkedIn connections count is not available. The API returned a response but no total count was found. This endpoint requires the r_network_size scope and may require LinkedIn Partner Program access.',
            },
          ],
        };
      } catch (error) {
        const errMsg = sanitizeError(error);
        const isRestricted =
          errMsg.includes('403') || errMsg.includes('forbidden') || errMsg.includes('MEMBER_CONNECTIONS');
        const explanation = isRestricted
          ? ' LinkedIn restricts connection data to partner apps only. You would need to apply for LinkedIn Partner Program access to retrieve connection counts.'
          : '';

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error getting connections count: ${errMsg}${explanation}`,
            },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get LinkedIn Connections Count',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// linkedin_share_post
// ---------------------------------------------------------------------------

const MAX_POST_LENGTH = 3000;

function createSharePostTool(_db: Database) {
  return tool(
    'linkedin_share_post',
    'Share a text post on LinkedIn on behalf of the authenticated user. Requires the w_member_social OAuth scope. Note: This scope may require LinkedIn Partner Program access and is not available to all apps.',
    {
      text: z
        .string()
        .max(MAX_POST_LENGTH)
        .describe(`The text content of the post (max ${MAX_POST_LENGTH} characters)`),
      authorUrn: z
        .string()
        .optional()
        .describe(
          'LinkedIn URN of the author, e.g. "urn:li:person:ABC123". If omitted the connector will attempt to derive it from the userinfo endpoint.'
        ),
    },
    async (args) => {
      try {
        // Derive author URN if not provided
        let authorUrn = args.authorUrn;
        if (!authorUrn) {
          const profile = await linkedinGet<{ sub?: string }>('/userinfo');
          if (!profile.sub) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'Error: Could not determine author URN. Please provide the authorUrn parameter (e.g. "urn:li:person:ABC123").',
                },
              ],
              isError: true,
            };
          }
          authorUrn = `urn:li:person:${profile.sub}`;
        }

        const postBody = {
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: args.text,
              },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        };

        const result = await linkedinPost<{ id?: string }>('/ugcPosts', postBody);

        const lines = [
          'LinkedIn post shared successfully.',
          `Post ID: ${result.id ?? '(not returned)'}`,
          `Text: ${args.text.substring(0, 100)}${args.text.length > 100 ? '...' : ''}`,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        const errMsg = sanitizeError(error);
        const isRestricted =
          errMsg.includes('403') || errMsg.includes('MEMBER_SOCIAL');
        const explanation = isRestricted
          ? ' This may be because the w_member_social scope requires LinkedIn Partner Program access for some apps.'
          : '';

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error sharing LinkedIn post: ${errMsg}${explanation}`,
            },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Share LinkedIn Post',
        readOnlyHint: false,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// linkedin_search_emails
// ---------------------------------------------------------------------------

function createSearchEmailsTool(db: Database) {
  return tool(
    'linkedin_search_emails',
    'Search Gmail for LinkedIn notification emails (from:notifications@linkedin.com). Parses results for connection requests, messages, job alerts, and other LinkedIn activity. Uses Gmail API via Google OAuth — requires Gmail connector to be authenticated.',
    {
      query: z
        .string()
        .optional()
        .describe(
          'Additional search terms to narrow results (e.g. "connection request", "new message", "job alert"). Automatically scoped to from:notifications@linkedin.com.'
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum number of emails to return (1-50, default 20)'),
    },
    async (args) => {
      try {
        const baseQuery = 'from:notifications@linkedin.com';
        const fullQuery = args.query
          ? `${baseQuery} ${args.query}`
          : baseQuery;

        const { messages, nextPageToken } = await listMessages(
          db,
          fullQuery,
          undefined,
          args.maxResults ?? 20
        );

        if (messages.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No LinkedIn notification emails found${args.query ? ` matching "${fenceUntrustedContent(args.query, 'linkedin.query')}"` : ''}.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${messages.length} LinkedIn notification email${messages.length !== 1 ? 's' : ''}${args.query ? ` matching "${fenceUntrustedContent(args.query, 'linkedin.query')}"` : ''}:`,
          '',
        ];

        for (const msg of messages) {
          lines.push(
            `ID: ${msg.id}`,
            `Subject: ${fenceUntrustedContent(msg.subject, 'LinkedIn')}`,
            `Date: ${fenceUntrustedContent(msg.date, 'LinkedIn')}`,
            `Snippet: ${fenceUntrustedContent(msg.snippet, 'LinkedIn')}`,
            ''
          );
        }

        if (nextPageToken) {
          lines.push(`Next page token: ${nextPageToken}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error searching LinkedIn emails: ${sanitizeError(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Search LinkedIn Notification Emails',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createLinkedinTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'linkedin_get_profile',
      description: 'Get the authenticated user\'s basic LinkedIn profile info',
      sdkTool: createGetProfileTool(db),
    },
    {
      name: 'linkedin_get_connections_count',
      description: 'Get the approximate count of LinkedIn connections (may be restricted)',
      sdkTool: createGetConnectionsCountTool(db),
    },
    {
      name: 'linkedin_share_post',
      description: 'Share a text post on LinkedIn',
      sdkTool: createSharePostTool(db),
    },
    {
      name: 'linkedin_search_emails',
      description: 'Search Gmail for LinkedIn notification emails',
      sdkTool: createSearchEmailsTool(db),
    },
  ];
}
