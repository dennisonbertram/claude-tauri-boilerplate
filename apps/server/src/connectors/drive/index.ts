import type { ConnectorFactory } from '../types';
import { createDriveTools } from './tools';

export const driveConnectorFactory: ConnectorFactory = (db) => ({
  name: 'drive',
  displayName: 'Google Drive',
  description:
    'Search, browse, and read files in Google Drive. Supports Google Docs, Sheets, and regular files.',
  icon: '📁',
  category: 'productivity',
  requiresAuth: true,
  tools: createDriveTools(db),
});
