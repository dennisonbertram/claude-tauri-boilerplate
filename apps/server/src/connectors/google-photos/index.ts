import type { ConnectorFactory } from '../types';
import { createGooglePhotosTools } from './tools';

export const googlePhotosConnectorFactory: ConnectorFactory = (db) => ({
  name: 'google-photos',
  displayName: 'Google Photos',
  description:
    'Browse and select photos from Google Photos using the Picker API. Supports album listing, photo selection via an interactive picker, and retrieving media details and base URLs.',
  icon: '📸',
  category: 'storage',
  requiresAuth: true,
  tools: createGooglePhotosTools(db),
});
