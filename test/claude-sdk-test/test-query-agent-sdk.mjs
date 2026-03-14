import { query } from "@anthropic-ai/claude-agent-sdk";

console.log("Testing query() from @anthropic-ai/claude-agent-sdk...");
try {
  const stream = query({
    prompt: "Say 'hello world' and nothing else.",
    options: {
      abortController: new AbortController(),
      maxTurns: 1,
    }
  });

  for await (const event of stream) {
    console.log("Event type:", event.type);
    if (event.type === "assistant" && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === "text") {
          console.log("Text:", block.text);
        }
      }
    }
    if (event.type === "result") {
      console.log("Result:", event.subtype, "Cost:", event.total_cost_usd);
      break;
    }
  }
} catch (err) {
  console.error("query() error:", err.message);
}
