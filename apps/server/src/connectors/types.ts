import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';

export type ConnectorCategory =
  | 'communication'
  | 'productivity'
  | 'finance'
  | 'lifestyle'
  | 'developer'
  | 'social-media'
  | 'travel'
  | 'storage'
  | 'smart-home'
  | 'shopping'
  | 'health'
  | 'subscriptions'
  | 'contacts';

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
  /** The name of the connector this tool belongs to (e.g. 'weather', 'gmail') */
  connectorName?: string;
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
 * A factory function that creates a ConnectorDefinition with injected dependencies.
 * Used by connectors that need database access (e.g., Gmail, Calendar, Plaid).
 */
export type ConnectorFactory = (db: Database) => ConnectorDefinition;

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
