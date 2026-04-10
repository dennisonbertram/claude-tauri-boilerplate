import type { ConnectorFactory } from '../types';
import { createGmailTools } from './tools';

export const gmailConnectorFactory: ConnectorFactory = (db) => ({
  name: 'gmail',
  displayName: 'Gmail',
  description:
    'Read, search, and send emails via Gmail. Provides inbox triage, message reading, and email composition.',
  icon: '📧',
  category: 'communication',
  requiresAuth: true,
  tools: createGmailTools(db),
});
