import type { ConnectorFactory } from '../types';
import { createWhatsAppTools } from './tools';

export const whatsappConnectorFactory: ConnectorFactory = (db) => ({
  name: 'whatsapp',
  displayName: 'WhatsApp',
  description:
    'List chats, read messages, send messages, and search contacts via WhatsApp. Requires Baileys library and QR code authentication.',
  icon: '📱',
  category: 'communication',
  requiresAuth: true,
  tools: createWhatsAppTools(db),
});
