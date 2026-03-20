import { query } from '@anthropic-ai/claude-agent-sdk';
import { buildSubscriptionSdkEnv } from './sdk-env';

export async function generateSessionTitle(
  messages: Array<{ role: string; content: string }>,
  model = 'claude-haiku-4-5-20251001',
  queryFn: typeof query = query
): Promise<string> {
  // Take first 4-6 messages max to keep it cheap
  const context = messages.slice(0, 6);

  const prompt = `Generate a short title (3-6 words) for this conversation. Return ONLY the title, no quotes, no punctuation at the end.\n\nConversation:\n${context.map((m) => `${m.role}: ${m.content}`).join('\n')}`;

  const stream = queryFn({
    prompt,
    options: {
      env: buildSubscriptionSdkEnv(),
      model,
      maxTurns: 1,
    },
  });

  let title = '';

  for await (const event of stream) {
    if (event.type === 'result' && event.subtype === 'success' && event.result) {
      title = String(event.result);
    }
  }

  title = stripMarkdown(title.trim());

  if (!title) {
    return 'Chat Session';
  }

  return title.slice(0, 60); // cap at 60 chars
}

/** Remove common markdown syntax from a plain-text title. */
function stripMarkdown(text: string): string {
  return text
    // [text](url) links → just the text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // **bold** / __bold__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // *italic* / _italic_
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // `code`
    .replace(/`([^`]+)`/g, '$1')
    // # headers (leading hashes + optional space)
    .replace(/^#{1,6}\s*/gm, '')
    // > blockquotes
    .replace(/^>\s?/gm, '')
    .trim();
}
