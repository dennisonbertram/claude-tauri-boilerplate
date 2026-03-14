// Test what @anthropic-ai/claude-agent-sdk exports
import * as agentSdk from "@anthropic-ai/claude-agent-sdk";
console.log("=== @anthropic-ai/claude-agent-sdk exports ===");
console.log("All exports:", Object.keys(agentSdk).sort());
console.log("Has claude:", typeof agentSdk.claude);
console.log("Has query:", typeof agentSdk.query);
