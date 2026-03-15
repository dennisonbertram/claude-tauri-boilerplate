import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // uses ANTHROPIC_API_KEY from env

export async function generateSessionTitle(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // Take first 4-6 messages max to keep it cheap
  const context = messages.slice(0, 6);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 30,
    messages: [
      {
        role: "user",
        content: `Generate a short title (3-6 words) for this conversation. Return ONLY the title, no quotes, no punctuation at the end.\n\nConversation:\n${context.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
      },
    ],
  });

  const text = response.content[0];
  if (text.type === "text") {
    return text.text.trim().slice(0, 60); // cap at 60 chars
  }
  return "Chat Session";
}
