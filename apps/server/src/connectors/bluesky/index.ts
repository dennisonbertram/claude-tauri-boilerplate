import type { ConnectorFactory } from '../types';
import { blueskyTools } from './tools';

export const blueskyConnectorFactory: ConnectorFactory = (_db) => ({
  name: 'bluesky',
  displayName: 'Bluesky',
  description:
    'Read and post on the Bluesky social network via the AT Protocol. Requires BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD environment variables.',
  icon: '🦋',
  category: 'social-media',
  requiresAuth: true,
  tools: blueskyTools,
});
