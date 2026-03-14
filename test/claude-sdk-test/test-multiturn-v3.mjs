/**
 * Multi-turn streaming test v3 - using sessionId option
 *
 * Discovery: ANTHROPIC_API_KEY in env overrides Claude Code subscription.
 * Run with: ANTHROPIC_API_KEY="" node test-multiturn-v3.mjs
 *
 * Approach: Set a fixed sessionId upfront for both turns. The SDK maps
 * options.sessionId → --session-id flag. This lets both query() calls
 * share the same session on disk.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "crypto";

if (process.env.ANTHROPIC_API_KEY) {
  console.warn("\nWARNING: ANTHROPIC_API_KEY is set - will fail with credit error.");
  console.warn("Run: ANTHROPIC_API_KEY=\"\" node test-multiturn-v3.mjs\n");
}

// Pre-generate a session ID to use for both turns
const sharedSessionId = randomUUID();
console.log(`\nShared session ID: ${sharedSessionId}`);

// ─── Helper: collect streaming response ──────────────────────────────────────
async function runTurn(label, prompt, options = {}) {
  console.log(`\n=== ${label} ===`);
  console.log(`Prompt: "${prompt}"\n`);

  let sessionIdFromEvent = null;
  let fullText = "";
  let streamingChars = 0;

  const turn = query({
    prompt,
    options: {
      includePartialMessages: true,
      maxTurns: 1,
      ...options
    }
  });

  process.stdout.write("Streaming: ");

  for await (const event of turn) {
    if (event.type === "system" && event.subtype === "init") {
      sessionIdFromEvent = event.session_id;
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
      console.log(`\n[Done - ${event.subtype}, cost: $${cost}, session: ${sessionIdFromEvent}]`);
    }
  }

  return { sessionId: sessionIdFromEvent, fullText, streamingChars };
}

// ─── TURN 1: Set session ID explicitly ───────────────────────────────────────
const turn1 = await runTurn(
  "TURN 1",
  "What is 2 + 2? Answer in exactly one sentence, include the number.",
  { sessionId: sharedSessionId }
);

console.log(`\nStreaming chars received: ${turn1.streamingChars}`);
console.log(`Full response: "${turn1.fullText}"`);
console.log(`Session matches: ${turn1.sessionId === sharedSessionId}`);

// ─── TURN 2: Resume same session with continueConversation ───────────────────
// Try using continueConversation with the same sessionId
const turn2 = await runTurn(
  "TURN 2 (resume via sessionId)",
  "What was the math question I just asked you? Include the specific numbers.",
  {
    sessionId: sharedSessionId,
    continueConversation: true
  }
);

console.log(`\nFull response: "${turn2.fullText}"`);

// Check context retention
const t2 = turn2.fullText.toLowerCase();
const remembers = t2.includes("2") || t2.includes("4") || t2.includes("two") ||
                  t2.includes("four") || t2.includes("plus") || t2.includes("equal");

// ─── FINAL RESULTS ───────────────────────────────────────────────────────────
console.log("\n=== TEST RESULTS ===");
console.log(`1. Auth via subscription: ${turn1.fullText && !turn1.fullText.includes("Credit balance") ? "PASS" : "FAIL"}`);
console.log(`2. Token-level streaming: ${turn1.streamingChars > 0 ? "PASS" : "FAIL"} (${turn1.streamingChars} stream events)`);
console.log(`3. Multi-turn context:    ${remembers ? "PASS" : "FAIL - no context retained"}`);
console.log(`   Turn 2 response: "${turn2.fullText.substring(0, 150)}"`);
