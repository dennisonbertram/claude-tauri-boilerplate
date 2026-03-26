import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorDefinition, ConnectorInfo, ConnectorToolDefinition, ConnectorFactory } from './types';
import { weatherConnector } from './weather';
import { gmailConnectorFactory } from './gmail';
import { calendarConnectorFactory } from './calendar';
import { driveConnectorFactory } from './drive';
import { plaidConnectorFactory } from './plaid';
import { todoistConnectorFactory } from './todoist';
import { notionConnectorFactory } from './notion';
import { slackConnectorFactory } from './slack';
import { blueskyConnectorFactory } from './bluesky';

// ---------------------------------------------------------------------------
// Connector registry
// ---------------------------------------------------------------------------

/** Static connectors (no dependencies needed). */
const STATIC_CONNECTORS: ConnectorDefinition[] = [weatherConnector];

/** Factory connectors (need db injection). Add new factory connectors here. */
const CONNECTOR_FACTORIES: ConnectorFactory[] = [
  gmailConnectorFactory,
  calendarConnectorFactory,
  driveConnectorFactory,
  plaidConnectorFactory,
  todoistConnectorFactory,
  notionConnectorFactory,
  slackConnectorFactory,
  blueskyConnectorFactory,
];

/** All initialized connectors (static + factory-created). */
let allConnectors: ConnectorDefinition[] = [...STATIC_CONNECTORS];
let connectorMap = new Map<string, ConnectorDefinition>(
  allConnectors.map((c) => [c.name, c])
);

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize connectors that require dependencies (db, etc.).
 * Called by mcp-resolver before creating connector MCP servers.
 * Idempotent — safe to call multiple times.
 */
export function initConnectors(db: Database): void {
  const factoryConnectors = CONNECTOR_FACTORIES.map((factory) => factory(db));
  allConnectors = [...STATIC_CONNECTORS, ...factoryConnectors];
  connectorMap = new Map(allConnectors.map((c) => [c.name, c]));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns serializable info for all connectors (for the frontend). */
export function getAllConnectors(): ConnectorInfo[] {
  return allConnectors.map((c) => ({
    name: c.name,
    displayName: c.displayName,
    description: c.description,
    icon: c.icon,
    category: c.category,
    requiresAuth: c.requiresAuth,
    toolNames: c.tools.map((t) => t.name),
  }));
}

/** Returns the SDK tool definitions for the given enabled connector names. */
export function getConnectorTools(
  enabledConnectorNames: string[]
): ConnectorToolDefinition[] {
  const tools: ConnectorToolDefinition[] = [];
  for (const name of enabledConnectorNames) {
    const connector = connectorMap.get(name);
    if (connector) {
      // Tag each tool with its connector name so callers can filter by connector
      tools.push(...connector.tools.map((t) => ({ ...t, connectorName: connector.name })));
    }
  }
  return tools;
}

/**
 * Creates an in-process MCP server containing all tools from the enabled connectors.
 * Returns undefined if no connectors are enabled or no tools are available.
 */
export function createConnectorMcpServer(enabledConnectorNames: string[]) {
  const tools = getConnectorTools(enabledConnectorNames);
  if (tools.length === 0) return undefined;

  return createSdkMcpServer({
    name: 'connectors',
    version: '1.0.0',
    tools: tools.map((t) => t.sdkTool),
  });
}

// Re-export types for convenience
export type { ConnectorDefinition, ConnectorInfo, ConnectorToolDefinition, ConnectorFactory } from './types';
