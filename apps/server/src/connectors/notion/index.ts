import type { ConnectorFactory } from '../types';
import { createTools } from './tools';

export const notionConnectorFactory: ConnectorFactory = (db) => ({
  name: 'notion',
  displayName: 'Notion',
  description: 'Search, read, and create content in Notion',
  icon: '📝',
  category: 'productivity',
  requiresAuth: true,
  tools: createTools(db),
});
