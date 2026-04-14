import type { ConnectorFactory } from '../types';
import { createDiscordTools } from './tools';

export const discordConnectorFactory: ConnectorFactory = (db) => ({
  name: 'discord',
  displayName: 'Discord',
  description:
    'Read messages, list guilds and channels, send messages, and add reactions via Discord. Uses a bot token for authentication.',
  icon: '🎮',
  category: 'communication',
  requiresAuth: true,
  tools: createDiscordTools(db),
});
