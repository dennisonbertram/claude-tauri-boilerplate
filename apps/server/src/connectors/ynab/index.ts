import type { ConnectorFactory } from '../types';
import { createYnabTools } from './tools';

export const ynabConnectorFactory: ConnectorFactory = (db) => ({
  name: 'ynab',
  displayName: 'YNAB',
  description:
    'Read your YNAB budget data including accounts, categories, transactions, and monthly budget summaries.',
  icon: '💰',
  category: 'finance',
  requiresAuth: true,
  tools: createYnabTools(db),
});
