import type { ConnectorFactory } from '../types';
import { createHomeAssistantTools } from './tools';

export const homeAssistantConnectorFactory: ConnectorFactory = (db) => ({
  name: 'home-assistant',
  displayName: 'Home Assistant',
  description:
    'Control and monitor your smart home via Home Assistant. List entities, read states, control devices, and view history.',
  icon: '🏠',
  category: 'smart-home',
  requiresAuth: true,
  tools: createHomeAssistantTools(db),
});
