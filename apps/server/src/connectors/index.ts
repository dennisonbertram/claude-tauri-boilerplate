import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { ConnectorDefinition, ConnectorInfo, ConnectorToolDefinition } from './types';
import { weatherConnector } from './weather';

// ---------------------------------------------------------------------------
// Connector registry
// ---------------------------------------------------------------------------

/** All registered connectors. Add new connectors here. */
const CONNECTORS: ConnectorDefinition[] = [weatherConnector];

const connectorMap = new Map<string, ConnectorDefinition>(
  CONNECTORS.map((c) => [c.name, c])
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns serializable info for all connectors (for the frontend). */
export function getAllConnectors(): ConnectorInfo[] {
  return CONNECTORS.map((c) => ({
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
      tools.push(...connector.tools);
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
export type { ConnectorDefinition, ConnectorInfo, ConnectorToolDefinition } from './types';
