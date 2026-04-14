import type { ConnectorFactory } from '../types';
import { createAppleRemindersTools } from './tools';

export const appleRemindersConnectorFactory: ConnectorFactory = (_db) => ({
  name: 'apple-reminders',
  displayName: 'Apple Reminders',
  description:
    'Read, search, and manage reminders in Apple Reminders. Create, complete, and organize tasks across your reminder lists.',
  icon: '📋',
  category: 'productivity',
  requiresAuth: false,
  tools: createAppleRemindersTools(),
});
