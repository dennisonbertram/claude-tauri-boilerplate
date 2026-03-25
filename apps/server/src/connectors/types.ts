import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';

export type ConnectorCategory =
  | 'communication'
  | 'productivity'
  | 'finance'
  | 'lifestyle'
  | 'developer';

/**
 * A tool definition within a connector.
 * Wraps the SDK's SdkMcpToolDefinition with connector-specific metadata.
 */
export interface ConnectorToolDefinition {
  /** Tool name as exposed to the LLM (e.g. 'weather_current') */
  name: string;
  /** Human-readable description */
  description: string;
  /** The actual SDK tool definition passed to createSdkMcpServer */
  sdkTool: SdkMcpToolDefinition<any>;
}

/**
 * A connector definition. Connectors are in-process MCP servers that
 * provide tools to Claude sessions.
 */
export interface ConnectorDefinition {
  /** Unique identifier, e.g. 'weather' */
  name: string;
  /** Human-readable label for UI, e.g. 'Weather' */
  displayName: string;
  /** What this connector does */
  description: string;
  /** Emoji or icon name */
  icon?: string;
  /** Connector category */
  category: ConnectorCategory;
  /** Whether this connector requires OAuth or API key */
  requiresAuth: boolean;
  /** The tool definitions this connector provides */
  tools: ConnectorToolDefinition[];
}

/**
 * Serializable connector info for the frontend (no tool implementations).
 */
export interface ConnectorInfo {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
  category: ConnectorCategory;
  requiresAuth: boolean;
  toolNames: string[];
}
