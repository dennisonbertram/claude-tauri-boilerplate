import type { Database } from 'bun:sqlite';
import type { AgentProfile } from '@claude-tauri/shared';
import { readMcpJson, isInternalServer, type McpJsonEntry } from './mcp-config';
import { getSessionMcpOverrides } from '../db';

/**
 * Default connectors that are enabled for all sessions unless overridden.
 * In the future this will come from DB/user settings.
 */
const DEFAULT_ENABLED_CONNECTORS = ['weather'];

/** The MCP server name used for in-process connectors. */
const CONNECTOR_SERVER_NAME = 'connectors';

export interface ResolvedMcpServers {
  /** MCP server configs keyed by server name, passed to query() as mcpServers. */
  servers?: Record<string, unknown>;
  /**
   * Tool names from in-process connector MCP servers that should be
   * auto-allowed without permission prompts.
   *
   * Format: `mcp__<serverName>__<toolName>` — the naming convention used
   * by the SDK when registering MCP tools.
   */
  connectorAllowedTools: string[];
}

export async function resolveSessionMcpServers(
  db: Database,
  sessionId: string | undefined,
  agentProfile: AgentProfile | null
): Promise<ResolvedMcpServers> {
  // If profile explicitly defines MCP servers, those take full precedence
  if (agentProfile?.mcpServersJson) {
    return { connectorAllowedTools: [] }; // Let profile handling in claude.ts manage it
  }

  const result: Record<string, unknown> = {};
  const connectorAllowedTools: string[] = [];

  // 1. External MCP servers from .mcp.json
  const globalData = await readMcpJson();
  for (const [name, entry] of Object.entries(globalData.mcpServers)) {
    if (isInternalServer(name, entry)) continue;
    if (entry.disabled) continue;
    result[name] = entry;
  }

  // Apply session overrides for external servers
  if (sessionId) {
    const overrides = getSessionMcpOverrides(db, sessionId);
    for (const override of overrides) {
      if (override.enabled) {
        const entry = globalData.mcpServers[override.serverName];
        if (entry && !isInternalServer(override.serverName, entry)) {
          result[override.serverName] = { ...entry, disabled: undefined };
        }
      } else {
        delete result[override.serverName];
      }
    }
  }

  // 2. In-process connector MCP server (lazy import to avoid module graph issues in tests)
  try {
    const { createConnectorMcpServer, getConnectorTools } = await import('../connectors');
    const connectorServer = createConnectorMcpServer(DEFAULT_ENABLED_CONNECTORS);
    if (connectorServer) {
      result[CONNECTOR_SERVER_NAME] = connectorServer;

      // Collect tool names so they can be auto-allowed in the SDK permission
      // system. The SDK names MCP tools as `mcp__<serverName>__<toolName>`.
      const tools = getConnectorTools(DEFAULT_ENABLED_CONNECTORS);
      for (const t of tools) {
        connectorAllowedTools.push(`mcp__${CONNECTOR_SERVER_NAME}__${t.name}`);
      }
    }
  } catch {
    // If connectors module fails to load (e.g. during certain test scenarios),
    // continue without connectors — external MCP servers still work.
  }

  const servers = Object.keys(result).length > 0 ? result : undefined;
  return { servers, connectorAllowedTools };
}
