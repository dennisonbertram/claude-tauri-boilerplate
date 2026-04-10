import type { ConnectorFactory } from '../types';
import { createTools } from './tools';

export const googleMapsConnectorFactory: ConnectorFactory = (_db) => ({
  name: 'google-maps',
  displayName: 'Google Maps',
  description:
    'Geocode addresses, get turn-by-turn directions, search for places, and retrieve detailed place information using the Google Maps APIs.',
  icon: '🗺️',
  category: 'travel',
  requiresAuth: true,
  tools: createTools(),
});
