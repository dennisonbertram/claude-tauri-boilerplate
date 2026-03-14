import { query } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "crypto";

const sid = randomUUID();
console.log("Session:", sid);

// Turn 1: set sessionId
let t1text = "";
for await (const e of query({
  prompt: "Remember: my lucky number is 42. Say OK.",
  options: { sessionId: sid, maxTurns: 1, includePartialMessages: true }
})) {
  if (e.type === "stream_event" && e.event?.delta?.type === "text_delta") {
    process.stdout.write(e.event.delta.text);
    t1text += e.event.delta.text;
  }
  if (e.type === "result") console.log("\nT1 done, cost:", e.total_cost_usd);
}
console.log("T1 full:", t1text);

// Wait briefly
await new Promise(r => setTimeout(r, 500));

// Turn 2: same sessionId - does Claude remember?
let t2text = "";
for await (const e of query({
  prompt: "What is my lucky number?",
  options: { sessionId: sid, maxTurns: 1, includePartialMessages: true }
})) {
  if (e.type === "stream_event" && e.event?.delta?.type === "text_delta") {
    process.stdout.write(e.event.delta.text);
    t2text += e.event.delta.text;
  }
  if (e.type === "result") console.log("\nT2 done, cost:", e.total_cost_usd);
}
console.log("T2 full:", t2text);
console.log("Remembered 42?", t2text.includes("42"));
