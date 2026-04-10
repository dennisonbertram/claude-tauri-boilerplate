import type { ConnectorFactory } from '../types';
import { twitterTools } from './tools';

export const twitterConnectorFactory: ConnectorFactory = (_db) => ({
  name: 'twitter',
  displayName: 'Twitter / X',
  description:
    'Read and post on Twitter/X. Look up user profiles, browse timelines, search recent tweets, read individual tweets, check mentions, and post new tweets.',
  icon: '𝕏',
  category: 'social-media',
  requiresAuth: true,
  tools: twitterTools,
});
