import type { ConnectorFactory } from '../types';
import { createTools } from './tools';

export const slackConnectorFactory: ConnectorFactory = (db) => ({
  name: 'slack',
  displayName: 'Slack',
  description: 'Read and send messages in Slack workspaces',
  icon: '💬',
  category: 'communication',
  requiresAuth: true,
  tools: createTools(db),
});
