import type { ConnectorFactory } from '../types';
import { createIMessageTools } from './tools';

export const imessageConnectorFactory: ConnectorFactory = (db) => ({
  name: 'imessage',
  displayName: 'iMessage',
  description:
    'Read and send iMessages. Browse conversations, search message history, and send messages to contacts via Apple Messages.',
  icon: '💬',
  category: 'communication',
  requiresAuth: false,
  tools: createIMessageTools(db),
});
