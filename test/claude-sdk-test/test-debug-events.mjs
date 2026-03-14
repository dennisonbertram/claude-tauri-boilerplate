import { query } from "@anthropic-ai/claude-agent-sdk";

console.log("\n=== DEBUG: ALL EVENTS FROM SINGLE TURN ===\n");

const turn1 = query({
  prompt: "What is 2 + 2? Answer in one sentence.",
  options: {
    includePartialMessages: true,
    maxTurns: 1,
  }
});

const eventLog = [];

for await (const event of turn1) {
  const summary = {
    type: event.type,
    subtype: event.subtype,
  };

  if (event.type === "stream_event") {
    summary.eventType = event.event?.type;
    summary.deltaType = event.event?.delta?.type;
    if (event.event?.delta?.type === "text_delta") {
      summary.text = event.event.delta.text;
    }
  }

  if (event.type === "assistant") {
    summary.contentTypes = event.message?.content?.map(b => b.type);
    summary.textLength = event.message?.content?.find(b => b.type === "text")?.text?.length;
    summary.firstChars = event.message?.content?.find(b => b.type === "text")?.text?.substring(0, 50);
  }

  if (event.type === "result") {
    summary.subtype = event.subtype;
    summary.cost = event.total_cost_usd;
    summary.sessionId = event.session_id;
  }

  if (event.type === "system") {
    summary.sessionId = event.session_id;
  }

  eventLog.push(summary);

  // Print non-text-delta events immediately
  if (!(event.type === "stream_event" && event.event?.delta?.type === "text_delta")) {
    console.log("EVENT:", JSON.stringify(summary, null, 2));
  } else {
    process.stdout.write(summary.text || "");
  }
}

console.log("\n\n=== EVENT TYPE SUMMARY ===");
const counts = {};
for (const e of eventLog) {
  const key = e.type + (e.eventType ? ":"+e.eventType : "") + (e.deltaType ? ":"+e.deltaType : "");
  counts[key] = (counts[key] || 0) + 1;
}
console.log(counts);
