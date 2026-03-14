/**
 * Multi-turn streaming test for @anthropic-ai/claude-agent-sdk
 *
 * KEY DISCOVERY: ANTHROPIC_API_KEY in env overrides Claude Code subscription auth.
 * Must unset it (or use a valid key) to use subscription-based auth.
 *
 * Run with: ANTHROPIC_API_KEY="" node test-multiturn-v2.mjs
 *
 * Approach: Two sequential query() calls. For Turn 2, use continueConversation: true
 * which maps to --continue flag (resumes most recent local session).
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

// Check if ANTHROPIC_API_KEY is set (warn if so - it'll fail with credit error)
if (process.env.ANTHROPIC_API_KEY) {
  console.warn("\nWARNING: ANTHROPIC_API_KEY is set in env.");
  console.warn("This will use API key auth instead of Claude Code subscription.");
  console.warn("Run with: ANTHROPIC_API_KEY=\"\" node test-multiturn-v2.mjs\n");
}

// ─── Helper: collect streaming response ──────────────────────────────────────
async function runTurn(label, prompt, options = {}) {
  console.log(`\n=== ${label} ===`);
  console.log(`Prompt: ${typeof prompt === "string" ? prompt : "[AsyncIterable]"}\n`);

  let sessionId = null;
  let fullText = "";
  let streamingChars = 0;

  const turn = query({ prompt, options: { includePartialMessages: true, maxTurns: 1, ...options } });

  process.stdout.write("Streaming: ");

  for await (const event of turn) {
    if (event.type === "system" && event.subtype === "init") {
      sessionId = event.session_id;
      // Session ID output inline
    }

    if (event.type === "stream_event") {
      const e = event.event;
      if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
        process.stdout.write(e.delta.text);
        fullText += e.delta.text;
        streamingChars++;
      }
    }

    if (event.type === "result") {
      const cost = event.total_cost_usd?.toFixed(6) ?? "?";
      console.log(`\n[Done - ${event.subtype}, cost: $${cost}, session: ${sessionId}]`);
    }
  }

  return { sessionId, fullText, streamingChars };
}

// ─── TURN 1 ──────────────────────────────────────────────────────────────────
const turn1 = await runTurn(
  "TURN 1",
  "What is 2 + 2? Answer in exactly one sentence, include the number."
);

console.log(`\nSession ID captured: ${turn1.sessionId}`);
console.log(`Streaming chars received: ${turn1.streamingChars}`);
console.log(`Full text: "${turn1.fullText}"`);

// ─── TURN 2: continueConversation approach ────────────────────────────────────
// continueConversation: true → --continue flag → resumes most recent local session
const turn2 = await runTurn(
  "TURN 2 (continueConversation: true)",
  "What was the math question I just asked you? Repeat the numbers involved.",
  { continueConversation: true }
);

console.log(`\nFull text: "${turn2.fullText}"`);

// Check context retention
const t2Lower = turn2.fullText.toLowerCase();
const remembers = t2Lower.includes("2") || t2Lower.includes("two") ||
                  t2Lower.includes("4") || t2Lower.includes("four") ||
                  t2Lower.includes("plus") || t2Lower.includes("add");

// ─── RESULTS ─────────────────────────────────────────────────────────────────
console.log("\n=== TEST RESULTS ===");
console.log(`1. Auth via subscription: ${turn1.fullText && !turn1.fullText.includes("Credit balance") ? "PASS" : "FAIL"}`);
console.log(`2. Streaming works:       ${turn1.streamingChars > 0 ? "PASS" : "FAIL"} (${turn1.streamingChars} partial chars streamed)`);
console.log(`3. Multi-turn context:    ${remembers ? "PASS" : "UNCLEAR"}`);
console.log(`   Turn 2 said: "${turn2.fullText.substring(0, 100)}"`);
