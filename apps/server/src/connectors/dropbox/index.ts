import type { ConnectorFactory } from '../types';
import { createDropboxTools } from './tools';

export const dropboxConnectorFactory: ConnectorFactory = (db) => ({
  name: 'dropbox',
  displayName: 'Dropbox',
  description:
    'Browse, search, read, and upload files in Dropbox. Provides folder listing, file search, metadata retrieval, file reading, and upload capabilities.',
  icon: '📦',
  category: 'storage',
  requiresAuth: true,
  tools: createDropboxTools(db),
});
