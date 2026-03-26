import type { ConnectorFactory } from '../types';
import { createCoinbaseTools } from './tools';

export const coinbaseConnectorFactory: ConnectorFactory = (db) => ({
  name: 'coinbase',
  displayName: 'Coinbase',
  description:
    'View Coinbase crypto wallets, account balances, transaction history, and live spot prices. Supports portfolio aggregation across all accounts.',
  icon: '₿',
  category: 'finance',
  requiresAuth: true,
  tools: createCoinbaseTools(db),
});
