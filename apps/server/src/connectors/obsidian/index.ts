import type { ConnectorFactory } from '../types';
import { createObsidianTools } from './tools';

export const obsidianConnectorFactory: ConnectorFactory = (_db) => ({
  name: 'obsidian',
  displayName: 'Obsidian',
  description:
    'Read, write, and search Markdown notes in your Obsidian vault. Supports listing notes, reading and creating files, searching content, and managing daily notes.',
  icon: '💎',
  category: 'productivity',
  requiresAuth: false,
  tools: createObsidianTools(),
});
