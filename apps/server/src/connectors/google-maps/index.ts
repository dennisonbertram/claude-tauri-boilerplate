import type { ConnectorDefinition } from '../types';
import { googleMapsTools } from './tools';

export const googleMapsConnector: ConnectorDefinition = {
  name: 'google-maps',
  displayName: 'Google Maps',
  description:
    'Geocode addresses, get turn-by-turn directions, search for places, and retrieve detailed place information using the Google Maps APIs.',
  icon: '🗺️',
  category: 'travel',
  requiresAuth: true,
  tools: googleMapsTools,
};

// Named export matching the task contract alias
export { googleMapsConnector as googleMapsConnectorFactory };
