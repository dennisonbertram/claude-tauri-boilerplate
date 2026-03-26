import type { ConnectorFactory } from '../types';
import { createAppleNotesTools } from './tools';

export const appleNotesConnectorFactory: ConnectorFactory = (_db) => ({
  name: 'apple-notes',
  displayName: 'Apple Notes',
  description:
    'Read, search, and create notes in Apple Notes on macOS. Browse folders, view note content, and add new notes.',
  icon: '📒',
  category: 'productivity',
  requiresAuth: false,
  tools: createAppleNotesTools(),
});
