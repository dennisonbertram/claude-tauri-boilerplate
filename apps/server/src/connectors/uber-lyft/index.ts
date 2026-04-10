import type { ConnectorFactory } from '../types';
import { createUberLyftTools } from './tools';

export const uberLyftConnectorFactory: ConnectorFactory = (db) => ({
  name: 'uber-lyft',
  displayName: 'Uber & Lyft',
  description:
    'Parse Uber and Lyft receipt emails from Gmail to list rides, view fare breakdowns, summarize spending, and export ride history for tax reporting.',
  icon: '🚗',
  category: 'travel',
  requiresAuth: true,
  tools: createUberLyftTools(db),
});
