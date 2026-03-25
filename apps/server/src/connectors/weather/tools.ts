import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { ConnectorToolDefinition } from '../types';
import {
  geocodeCity,
  getCurrentConditions,
  getForecast,
  getAlerts,
} from './api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveCoordinates(input: {
  latitude?: number;
  longitude?: number;
  city?: string;
}): Promise<{ lat: number; lon: number }> {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return { lat: input.latitude, lon: input.longitude };
  }
  if (input.city) {
    const geo = await geocodeCity(input.city);
    return { lat: geo.lat, lon: geo.lon };
  }
  throw new Error(
    'Please provide either a city name or latitude/longitude coordinates.'
  );
}

// ---------------------------------------------------------------------------
// weather_current
// ---------------------------------------------------------------------------

const currentWeatherTool = tool(
  'weather_current',
  'Get current weather conditions for a US location. Provide either a city name or latitude/longitude coordinates.',
  {
    city: z
      .string()
      .optional()
      .describe('City name (e.g. "San Francisco, CA")'),
    latitude: z.number().optional().describe('Latitude coordinate'),
    longitude: z.number().optional().describe('Longitude coordinate'),
  },
  async (args) => {
    try {
      const { lat, lon } = await resolveCoordinates(args);
      const conditions = await getCurrentConditions(lat, lon);

      const text = [
        `Current Weather for ${conditions.location}`,
        `Observed at: ${new Date(conditions.timestamp).toLocaleString()}`,
        '',
        `Temperature: ${conditions.temperature}°${conditions.temperatureUnit}`,
        `Conditions: ${conditions.shortForecast}`,
        `Wind: ${conditions.windSpeed} from ${conditions.windDirection}`,
        `Humidity: ${conditions.humidity}`,
        `Dewpoint: ${conditions.dewpoint}`,
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Current Weather',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// weather_forecast
// ---------------------------------------------------------------------------

const forecastTool = tool(
  'weather_forecast',
  'Get a multi-day weather forecast for a US location. Provide either a city name or latitude/longitude coordinates.',
  {
    city: z
      .string()
      .optional()
      .describe('City name (e.g. "New York, NY")'),
    latitude: z.number().optional().describe('Latitude coordinate'),
    longitude: z.number().optional().describe('Longitude coordinate'),
    days: z
      .number()
      .min(1)
      .max(7)
      .optional()
      .describe('Number of days to forecast (1-7, default 3)'),
  },
  async (args) => {
    try {
      const { lat, lon } = await resolveCoordinates(args);
      const { location, periods } = await getForecast(lat, lon, args.days ?? 3);

      const lines = [`Weather Forecast for ${location}`, ''];
      for (const period of periods) {
        lines.push(
          `${period.name}: ${period.temperature}°${period.temperatureUnit}`,
          `  ${period.shortForecast}`,
          `  Wind: ${period.windSpeed} ${period.windDirection}`,
          ''
        );
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Weather Forecast',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// weather_alerts
// ---------------------------------------------------------------------------

const alertsTool = tool(
  'weather_alerts',
  'Get active weather alerts for a US location. Provide either a city name or latitude/longitude coordinates.',
  {
    city: z
      .string()
      .optional()
      .describe('City name (e.g. "Miami, FL")'),
    latitude: z.number().optional().describe('Latitude coordinate'),
    longitude: z.number().optional().describe('Longitude coordinate'),
  },
  async (args) => {
    try {
      const { lat, lon } = await resolveCoordinates(args);
      const { location, alerts } = await getAlerts(lat, lon);

      if (alerts.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No active weather alerts for ${location}.`,
            },
          ],
        };
      }

      const lines = [
        `Active Weather Alerts for ${location} (${alerts.length} alert${alerts.length > 1 ? 's' : ''})`,
        '',
      ];

      for (const alert of alerts) {
        lines.push(
          `--- ${alert.event} ---`,
          `Severity: ${alert.severity} | Urgency: ${alert.urgency}`,
          `Headline: ${alert.headline}`,
          `Areas: ${alert.areas}`,
          `Effective: ${new Date(alert.effective).toLocaleString()}`,
          `Expires: ${new Date(alert.expires).toLocaleString()}`,
          '',
          alert.description,
          '',
          `Instructions: ${alert.instruction}`,
          ''
        );
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Weather Alerts',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const weatherTools: ConnectorToolDefinition[] = [
  {
    name: 'weather_current',
    description: 'Get current weather conditions for a US location',
    sdkTool: currentWeatherTool,
  },
  {
    name: 'weather_forecast',
    description: 'Get a multi-day weather forecast for a US location',
    sdkTool: forecastTool,
  },
  {
    name: 'weather_alerts',
    description: 'Get active weather alerts for a US location',
    sdkTool: alertsTool,
  },
];
