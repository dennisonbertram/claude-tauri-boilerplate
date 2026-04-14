import type { ConnectorFactory } from '../types';
import { createSubscriptionsTools } from './tools';

export const subscriptionsConnectorFactory: ConnectorFactory = (db) => ({
  name: 'subscriptions',
  displayName: 'Subscription Tracker',
  description:
    'Track and manage recurring subscriptions. Add, update, cancel, and analyse monthly/yearly spend across all your services.',
  icon: '🔄',
  category: 'subscriptions',
  requiresAuth: false,
  tools: createSubscriptionsTools(db),
});
