import type { ConnectorFactory } from '../types';
import { createTripItTools } from './tools';

export const tripitConnectorFactory: ConnectorFactory = (db) => ({
  name: 'tripit',
  displayName: 'TripIt',
  description:
    'Read your TripIt travel itineraries, upcoming trips, and flight details. Provides trip listing, detail lookup, and flight segment retrieval.',
  icon: '✈️',
  category: 'travel',
  requiresAuth: true,
  tools: createTripItTools(db),
});
