import type { CanvasNodeType } from '../components/agent-builder/types/canvas';

// Valid connection combinations
const VALID_CONNECTIONS: Record<CanvasNodeType, CanvasNodeType[]> = {
  trigger: ['condition', 'action'],
  condition: ['action'],
  action: [], // leaf node, no outgoing connections
};

/**
 * Returns true if a connection from sourceType to targetType is valid.
 * Used as the isValidConnection prop on ReactFlow.
 */
export function isValidConnection(
  sourceType: CanvasNodeType,
  targetType: CanvasNodeType
): boolean {
  return VALID_CONNECTIONS[sourceType]?.includes(targetType) ?? false;
}

/**
 * Returns a human-readable reason why a connection is invalid.
 */
export function getInvalidConnectionReason(
  sourceType: CanvasNodeType,
  targetType: CanvasNodeType
): string {
  if (sourceType === 'action') {
    return 'Action nodes are leaf nodes — they cannot have outgoing connections.';
  }
  if (targetType === 'trigger') {
    return 'Trigger nodes cannot be targets — they are always the start of a flow.';
  }
  if (sourceType === 'condition' && targetType === 'condition') {
    return 'Conditions cannot connect to other conditions.';
  }
  return `Cannot connect ${sourceType} → ${targetType}.`;
}
