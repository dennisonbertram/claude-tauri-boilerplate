import type { ConnectorFactory } from '../types';
import { createContactsTools } from './tools';

export const contactsConnectorFactory: ConnectorFactory = (db) => ({
  name: 'contacts',
  displayName: 'Contacts',
  description:
    'Search, view, and create contacts. Uses Apple Contacts on macOS via osascript, or Google Contacts via the People API.',
  icon: '👤',
  category: 'contacts',
  requiresAuth: false,
  tools: createContactsTools(db),
});
