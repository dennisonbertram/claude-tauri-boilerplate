import type { ConnectorFactory } from '../types';
import { createPlaidTools } from './tools';

export const plaidConnectorFactory: ConnectorFactory = (db) => ({
  name: 'plaid',
  displayName: 'Finance (Plaid)',
  description:
    'View bank account balances, search transactions, and analyze spending patterns across all connected financial accounts.',
  icon: '💰',
  category: 'finance',
  requiresAuth: true,
  tools: createPlaidTools(db),
});
