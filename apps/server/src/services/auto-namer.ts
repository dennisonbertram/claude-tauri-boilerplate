import { query } from '@anthropic-ai/claude-agent-sdk';

export async function generateSessionTitle(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // Take first 4-6 messages max to keep it cheap
  const context = messages.slice(0, 6);

  const prompt = `Generate a short title (3-6 words) for this conversation. Return ONLY the title, no quotes, no punctuation at the end.\n\nConversation:\n${context.map((m) => `${m.role}: ${m.content}`).join('\n')}`;

  const stream = query({
    prompt,
    options: {
      model: 'claude-haiku-4-5-20251001',
      maxTurns: 1,
    },
  });

  let title = '';

  for await (const event of stream) {
    if (
      event.type === 'stream_event' &&
      event.event.type === 'content_block_delta' &&
      event.event.delta.type === 'text_delta'
    ) {
      title += event.event.delta.text;
    }
  }

  title = title.trim();

  if (!title) {
    return 'Chat Session';
  }

  return title.slice(0, 60); // cap at 60 chars
}
