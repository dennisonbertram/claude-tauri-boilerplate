import { google } from 'googleapis';
import type { Database } from 'bun:sqlite';
import { getAuthenticatedClient, classifyGoogleError } from './auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocContent {
  title: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk the structural elements of a Google Doc body and concatenate all
 * text run content into a single string.
 */
function extractTextFromBody(body: any): string {
  if (!body?.content) return '';

  const parts: string[] = [];

  for (const element of body.content) {
    if (element.paragraph) {
      for (const pe of element.paragraph.elements ?? []) {
        if (pe.textRun?.content) {
          parts.push(pe.textRun.content);
        }
      }
    } else if (element.table) {
      // Walk table rows → cells → content (recursive structure)
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          parts.push(extractTextFromBody(cell));
        }
      }
    } else if (element.sectionBreak) {
      // no text content
    }
  }

  return parts.join('');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDocContent(
  db: Database,
  docId: string,
): Promise<DocContent> {
  const client = getAuthenticatedClient(db);
  const docs = google.docs({ version: 'v1', auth: client });

  try {
    const res = await docs.documents.get({ documentId: docId });

    return {
      title: res.data.title ?? '',
      body: extractTextFromBody(res.data.body),
    };
  } catch (err) {
    throw Object.assign(new Error('Docs getDocContent failed'), {
      cause: err,
      classified: classifyGoogleError(err),
    });
  }
}
