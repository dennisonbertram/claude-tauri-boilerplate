import { query } from '@anthropic-ai/claude-agent-sdk';

const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';

export async function generateContextSummary(
  messages: Array<{ role: string; content: string }>,
  model = SUMMARY_MODEL,
  // Injected for testing; defaults to the real SDK query
  queryFn: typeof query = query
): Promise<string | null> {
  // Use up to 10 messages for context, keeping cost low
  const context = messages.slice(0, 10);

  const conversationText = context
    .map((m) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content.slice(0, 500)}`)
    .join('\n');

  const prompt = `Summarize what this conversation is about in one short phrase (max 10 words). Be specific and concise. No punctuation at the end.\n\nConversation:\n${conversationText}`;

  const savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = '';

  const stream = queryFn({
    prompt,
    options: {
      model,
      maxTurns: 1,
    },
  });

  let summary = '';

  try {
    for await (const event of stream) {
      if (event.type === 'result' && event.subtype === 'success' && event.result) {
        summary = String(event.result);
      }
    }
  } finally {
    process.env.ANTHROPIC_API_KEY = savedKey ?? '';
  }

  summary = summary.trim();

  if (!summary) {
    return null;
  }

  return summary.slice(0, 80); // cap at 80 chars
}
