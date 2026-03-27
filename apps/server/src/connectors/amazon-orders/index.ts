import type { ConnectorFactory } from '../types';
import { createAmazonOrdersTools } from './tools';

export const amazonOrdersConnectorFactory: ConnectorFactory = (db) => ({
  name: 'amazon-orders',
  displayName: 'Amazon Orders',
  description:
    'View and track Amazon orders by parsing order confirmation and shipping emails from Gmail. Requires Google account connected.',
  icon: '📦',
  category: 'shopping',
  requiresAuth: true,
  tools: createAmazonOrdersTools(db),
});
