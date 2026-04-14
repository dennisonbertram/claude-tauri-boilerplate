import type { ConnectorFactory } from '../types';
import { createTools } from './tools';

export const todoistConnectorFactory: ConnectorFactory = (db) => ({
  name: 'todoist',
  displayName: 'Todoist',
  description: 'Task management with Todoist',
  icon: '✅',
  category: 'productivity',
  requiresAuth: true,
  tools: createTools(db),
});
