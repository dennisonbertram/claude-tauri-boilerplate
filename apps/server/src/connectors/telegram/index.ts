import type { ConnectorFactory } from '../types';
import { createTelegramTools } from './tools';

export const telegramConnectorFactory: ConnectorFactory = (db) => ({
  name: 'telegram',
  displayName: 'Telegram',
  description:
    'Read updates and send messages via a Telegram Bot. Bots can interact with users and groups they are members of using the Telegram Bot API.',
  icon: '✈️',
  category: 'communication',
  requiresAuth: true,
  tools: createTelegramTools(db),
});
