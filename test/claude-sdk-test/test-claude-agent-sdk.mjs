import { claude } from "@anthropic-ai/claude-agent-sdk";

console.log("Testing claude() from @anthropic-ai/claude-agent-sdk...");
if (typeof claude !== "function") {
  console.log("claude is NOT a function, type:", typeof claude);
  process.exit(0);
}

try {
  const stream = claude("Say 'hello world' and nothing else.", {
    abortController: new AbortController(),
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
      console.log("Result:", event.subtype);
      break;
    }
  }
} catch (err) {
  console.error("claude() error:", err.message);
}
