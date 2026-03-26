import type { ConnectorFactory } from '../types';
import { createLinkedinTools } from './tools';

export const linkedinConnectorFactory: ConnectorFactory = (db) => ({
  name: 'linkedin',
  displayName: 'LinkedIn',
  description:
    'Access LinkedIn profile information, share posts, and search LinkedIn notification emails. Note: LinkedIn API access is very restricted — most features require partner program approval.',
  icon: '💼',
  category: 'social-media',
  requiresAuth: true,
  tools: createLinkedinTools(db),
});
