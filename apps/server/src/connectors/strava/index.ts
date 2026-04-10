import type { ConnectorFactory } from '../types';
import { createStravaTools } from './tools';

export const stravaConnectorFactory: ConnectorFactory = (_db) => ({
  name: 'strava',
  displayName: 'Strava',
  description:
    'Access Strava activity data including runs, rides, swims, and athlete statistics. Read recent activities, detailed activity info, athlete profile, and aggregated training stats.',
  icon: '🏃',
  category: 'health',
  requiresAuth: true,
  tools: createStravaTools(),
});
