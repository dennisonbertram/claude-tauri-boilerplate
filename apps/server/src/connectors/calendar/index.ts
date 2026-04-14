import type { ConnectorFactory } from '../types';
import { createCalendarTools } from './tools';

export const calendarConnectorFactory: ConnectorFactory = (db) => ({
  name: 'calendar',
  displayName: 'Google Calendar',
  description:
    'Manage your Google Calendar — view events, create appointments, update schedules, and check availability.',
  icon: '📅',
  category: 'productivity',
  requiresAuth: true,
  tools: createCalendarTools(db),
});
