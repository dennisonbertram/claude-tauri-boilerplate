import type { ConnectorFactory } from '../types';
import { createAppleHealthTools } from './tools';

export const appleHealthConnectorFactory: ConnectorFactory = (db) => ({
  name: 'apple-health',
  displayName: 'Apple Health',
  description:
    'Read and analyze Apple Health data exported from your iPhone. ' +
    'Index your health export file to query steps, heart rate, sleep, workouts, and 100+ other metrics.',
  icon: '❤️',
  category: 'health',
  requiresAuth: false,
  tools: createAppleHealthTools(db),
});
