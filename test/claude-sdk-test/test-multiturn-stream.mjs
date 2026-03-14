/**
 * Multi-turn streaming test for @anthropic-ai/claude-agent-sdk
 *
 * Tests:
 * 1. Authentication via Claude Code subscription (no API key needed)
 * 2. Token-level streaming via includePartialMessages + stream_event + content_block_delta
 * 3. Multi-turn conversation via options.resume (session_id from init event)
 *
 * Run: node test-multiturn-stream.mjs
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

const results = {
  auth: false,
  streaming: false,
  streamingChars: 0,
  multiTurn: false,
  turn1Text: "",
  turn2Text: "",
  sessionId: null,
  errors: [],
};

// ─── Helper: run a single query turn ─────────────────────────────────────────
async function runTurn(label, prompt, options = {}) {
  console.log(`\n=== ${label} ===`);
  console.log(`Prompt: "${typeof prompt === "string" ? prompt : "[AsyncIterable]"}"`);
  if (options.resume) console.log(`Resuming session: ${options.resume}`);
  console.log();

  let sessionIdFromEvent = null;
  let fullText = "";
  let streamingChars = 0;
  let gotResult = false;

  const turn = query({
    prompt,
    options: {
      includePartialMessages: true,
      maxTurns: 1,
      effort: "low",          // faster responses for test
      thinking: { type: "disabled" }, // no extended thinking for test
      ...options,
    },
  });

  process.stdout.write("Streaming: ");

  for await (const event of turn) {
    // Capture session_id from init event
    if (event.type === "system" && event.subtype === "init") {
      sessionIdFromEvent = event.session_id;
      console.log(`[Session: ${sessionIdFromEvent}]`);
      process.stdout.write("Streaming: ");
    }

    // Stream partial text deltas (token-level) — the primary streaming path
    if (event.type === "stream_event") {
      const e = event.event;
      if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
        process.stdout.write(e.delta.text);
        fullText += e.delta.text;
        streamingChars++;
      }
    }

    // Full assistant message fallback (if stream_event didn't fire)
    if (event.type === "assistant") {
      const content = event.message?.content;
      if (Array.isArray(content) && !fullText) {
        for (const block of content) {
          if (block.type === "text") {
            fullText += block.text;
          }
        }
        if (fullText) {
          process.stdout.write("[via assistant event] " + fullText);
        }
      }
    }

    // Result event
    if (event.type === "result") {
      const cost = event.total_cost_usd?.toFixed(6) ?? "?";
      console.log(`\n[Done - ${event.subtype}, cost: $${cost}]`);
      gotResult = true;
    }
  }

  if (!gotResult) {
    console.log("\n[WARNING: No result event received]");
  }

  return { sessionId: sessionIdFromEvent, fullText, streamingChars };
}

// ─── TURN 1 ──────────────────────────────────────────────────────────────────
let turn1;
try {
  turn1 = await runTurn(
    "TURN 1",
    "What is 2 + 2? Answer in exactly one sentence."
  );

  results.turn1Text = turn1.fullText;
  results.sessionId = turn1.sessionId;
  results.streamingChars = turn1.streamingChars;

  // Auth check: successful response without credit error
  if (turn1.fullText && !turn1.fullText.toLowerCase().includes("credit balance")) {
    results.auth = true;
  }

  // Streaming check: stream_event content_block_delta fired
  if (turn1.streamingChars > 0) {
    results.streaming = true;
  }

  console.log(`\nStreaming chars: ${turn1.streamingChars}`);
  console.log(`Full text: "${turn1.fullText}"`);
} catch (err) {
  results.errors.push(`Turn 1 error: ${err.message}`);
  console.error("Turn 1 failed:", err.message);
}

// ─── TURN 2 (resume) ─────────────────────────────────────────────────────────
if (results.sessionId) {
  let turn2;
  try {
    turn2 = await runTurn(
      "TURN 2 (resume via options.resume)",
      "What was the math question I just asked you? Repeat the exact numbers.",
      { resume: results.sessionId }
    );

    results.turn2Text = turn2.fullText;

    // Multi-turn check: Turn 2 remembers Turn 1 context
    const t2Lower = turn2.fullText.toLowerCase();
    const remembers =
      t2Lower.includes("2") ||
      t2Lower.includes("two") ||
      t2Lower.includes("4") ||
      t2Lower.includes("four") ||
      t2Lower.includes("plus") ||
      t2Lower.includes("add") ||
      t2Lower.includes("equal");

    results.multiTurn = remembers;

    console.log(`\nFull text: "${turn2.fullText}"`);
  } catch (err) {
    results.errors.push(`Turn 2 error: ${err.message}`);
    console.error("Turn 2 failed:", err.message);
  }
} else {
  results.errors.push("No session_id from Turn 1 — cannot test multi-turn");
  console.log("\nSkipping Turn 2: no session_id captured from Turn 1");
}

// ─── FINAL RESULTS ───────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log("FINAL TEST RESULTS");
console.log("=".repeat(50));
console.log(`1. Auth (Claude Code subscription): ${results.auth ? "PASS" : "FAIL"}`);
console.log(`2. Token-level streaming:            ${results.streaming ? "PASS" : "FAIL"} (${results.streamingChars} stream chars)`);
console.log(`3. Multi-turn context retention:     ${results.multiTurn ? "PASS" : "FAIL"}`);
console.log();
console.log(`Session ID captured: ${results.sessionId}`);
console.log(`Turn 1: "${results.turn1Text.substring(0, 100)}"`);
console.log(`Turn 2: "${results.turn2Text.substring(0, 100)}"`);

if (results.errors.length > 0) {
  console.log("\nErrors:");
  for (const e of results.errors) console.log("  -", e);
}

const allPass = results.auth && results.streaming && results.multiTurn;
console.log(`\nOverall: ${allPass ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);
