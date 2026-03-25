import type { ConnectorDefinition } from '../types';
import { weatherTools } from './tools';

export const weatherConnector: ConnectorDefinition = {
  name: 'weather',
  displayName: 'Weather',
  description:
    'Get current conditions, forecasts, and weather alerts for US locations using the National Weather Service API.',
  icon: '🌤️',
  category: 'lifestyle',
  requiresAuth: false,
  tools: weatherTools,
};
