import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  geocodeCity,
  getCurrentConditions,
  getForecast,
  getAlerts,
  clearGeocodeCache,
} from './api';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = mock(handler as any) as any;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeNominatimResponse(lat = '37.7749', lon = '-122.4194', displayName = 'San Francisco, CA, USA') {
  return [{ lat, lon, display_name: displayName }];
}

function makePointsResponse(overrides: Record<string, unknown> = {}) {
  return {
    properties: {
      gridId: 'MTR',
      gridX: 85,
      gridY: 105,
      forecast: 'https://api.weather.gov/gridpoints/MTR/85,105/forecast',
      forecastHourly: 'https://api.weather.gov/gridpoints/MTR/85,105/forecast/hourly',
      observationStations: 'https://api.weather.gov/gridpoints/MTR/85,105/stations',
      relativeLocation: {
        properties: {
          city: 'San Francisco',
          state: 'CA',
        },
      },
      ...overrides,
    },
  };
}

function makeStationsResponse() {
  return {
    features: [{ properties: { stationIdentifier: 'KSFO' } }],
  };
}

function makeObservationResponse(overrides: Record<string, unknown> = {}) {
  return {
    properties: {
      timestamp: '2024-01-15T12:00:00Z',
      textDescription: 'Partly Cloudy',
      temperature: { value: 15, unitCode: 'wmoUnit:degC' },
      windSpeed: { value: 5, unitCode: 'wmoUnit:m_s-1' },
      windDirection: { value: 270 },
      relativeHumidity: { value: 65 },
      dewpoint: { value: 8, unitCode: 'wmoUnit:degC' },
      ...overrides,
    },
  };
}

function makeForecastResponse(periodCount = 4) {
  const periods = Array.from({ length: periodCount }, (_, i) => ({
    name: i % 2 === 0 ? `Day ${Math.floor(i / 2) + 1}` : `Night ${Math.floor(i / 2) + 1}`,
    temperature: i % 2 === 0 ? 65 : 50,
    temperatureUnit: 'F',
    windSpeed: '10 mph',
    windDirection: 'W',
    shortForecast: i % 2 === 0 ? 'Sunny' : 'Clear',
    detailedForecast: i % 2 === 0 ? 'Sunny with highs near 65.' : 'Clear with lows around 50.',
    isDaytime: i % 2 === 0,
  }));

  return { properties: { periods } };
}

function makeAlertsResponse(alertCount = 0) {
  const features = Array.from({ length: alertCount }, (_, i) => ({
    properties: {
      event: `Test Alert ${i + 1}`,
      headline: `Test Headline ${i + 1}`,
      severity: 'Moderate',
      urgency: 'Expected',
      areaDesc: 'San Francisco County',
      description: `Test description for alert ${i + 1}`,
      instruction: `Take action ${i + 1}`,
      effective: '2024-01-15T10:00:00Z',
      expires: '2024-01-16T10:00:00Z',
    },
  }));

  return { features };
}

// ---------------------------------------------------------------------------
// Router for mock fetch
// ---------------------------------------------------------------------------

function createMockRouter(overrides: {
  nominatim?: any;
  points?: any;
  stations?: any;
  observation?: any;
  forecast?: any;
  alerts?: any;
  nominatimStatus?: number;
  pointsStatus?: number;
} = {}) {
  return (url: string) => {
    if (url.includes('nominatim.openstreetmap.org')) {
      return new Response(
        JSON.stringify(overrides.nominatim ?? makeNominatimResponse()),
        { status: overrides.nominatimStatus ?? 200 }
      );
    }
    if (url.match(/api\.weather\.gov\/points\//)) {
      return new Response(
        JSON.stringify(overrides.points ?? makePointsResponse()),
        { status: overrides.pointsStatus ?? 200 }
      );
    }
    if (url.includes('/stations') && !url.includes('/observations')) {
      return new Response(
        JSON.stringify(overrides.stations ?? makeStationsResponse()),
        { status: 200 }
      );
    }
    if (url.includes('/observations/latest')) {
      return new Response(
        JSON.stringify(overrides.observation ?? makeObservationResponse()),
        { status: 200 }
      );
    }
    if (url.includes('/forecast') && !url.includes('/hourly')) {
      return new Response(
        JSON.stringify(overrides.forecast ?? makeForecastResponse()),
        { status: 200 }
      );
    }
    if (url.includes('/alerts/active')) {
      return new Response(
        JSON.stringify(overrides.alerts ?? makeAlertsResponse()),
        { status: 200 }
      );
    }
    return new Response('Not Found', { status: 404 });
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Weather API', () => {
  beforeEach(() => {
    clearGeocodeCache();
  });

  afterEach(() => {
    restoreFetch();
  });

  // ---------- Geocoding ----------

  describe('geocodeCity', () => {
    test('resolves a city name to coordinates', async () => {
      mockFetch(createMockRouter());
      const result = await geocodeCity('San Francisco, CA');
      expect(result.lat).toBeCloseTo(37.7749);
      expect(result.lon).toBeCloseTo(-122.4194);
      expect(result.displayName).toBe('San Francisco, CA, USA');
    });

    test('caches geocoding results', async () => {
      let callCount = 0;
      mockFetch((url) => {
        if (url.includes('nominatim')) {
          callCount++;
          return new Response(JSON.stringify(makeNominatimResponse()));
        }
        return new Response('Not Found', { status: 404 });
      });

      await geocodeCity('San Francisco, CA');
      await geocodeCity('San Francisco, CA');
      // second call should be cached
      expect(callCount).toBe(1);
    });

    test('throws on empty results (location not found)', async () => {
      mockFetch(createMockRouter({ nominatim: [] }));
      await expect(geocodeCity('Nonexistent City')).rejects.toThrow('Location not found');
    });

    test('throws on API error', async () => {
      mockFetch(createMockRouter({ nominatimStatus: 500 }));
      await expect(geocodeCity('San Francisco')).rejects.toThrow('Geocoding API error');
    });
  });

  // ---------- Current Conditions ----------

  describe('getCurrentConditions', () => {
    test('returns formatted current conditions', async () => {
      mockFetch(createMockRouter());
      const result = await getCurrentConditions(37.7749, -122.4194);

      expect(result.location).toBe('San Francisco, CA');
      expect(result.temperature).toBe('59'); // 15°C → 59°F
      expect(result.temperatureUnit).toBe('F');
      expect(result.shortForecast).toBe('Partly Cloudy');
      expect(result.humidity).toBe('65%');
      expect(result.windDirection).toBe('W');
    });

    test('handles null observation values', async () => {
      mockFetch(
        createMockRouter({
          observation: makeObservationResponse({
            temperature: { value: null, unitCode: 'wmoUnit:degC' },
            windSpeed: { value: null, unitCode: 'wmoUnit:m_s-1' },
            windDirection: { value: null },
            relativeHumidity: { value: null },
            dewpoint: { value: null, unitCode: 'wmoUnit:degC' },
          }),
        })
      );
      const result = await getCurrentConditions(37.7749, -122.4194);
      expect(result.temperature).toBe('N/A');
      expect(result.windSpeed).toBe('N/A');
      expect(result.windDirection).toBe('N/A');
      expect(result.humidity).toBe('N/A');
      expect(result.dewpoint).toBe('N/A');
    });

    test('throws when NWS returns 404 (non-US location)', async () => {
      mockFetch(createMockRouter({ pointsStatus: 404 }));
      await expect(getCurrentConditions(51.5074, -0.1278)).rejects.toThrow(
        'not supported by NWS'
      );
    });

    test('throws when no observation stations found', async () => {
      mockFetch(createMockRouter({ stations: { features: [] } }));
      await expect(getCurrentConditions(37.7749, -122.4194)).rejects.toThrow(
        'No observation stations'
      );
    });
  });

  // ---------- Forecast ----------

  describe('getForecast', () => {
    test('returns forecast periods', async () => {
      mockFetch(createMockRouter({ forecast: makeForecastResponse(6) }));
      const result = await getForecast(37.7749, -122.4194, 3);

      expect(result.location).toBe('San Francisco, CA');
      expect(result.periods.length).toBe(6); // 3 days = 6 periods (day+night)
      expect(result.periods[0].name).toBe('Day 1');
      expect(result.periods[0].temperature).toBe(65);
    });

    test('limits periods by day count', async () => {
      mockFetch(createMockRouter({ forecast: makeForecastResponse(14) }));
      const result = await getForecast(37.7749, -122.4194, 2);

      // 2 days = max 4 periods
      expect(result.periods.length).toBe(4);
    });

    test('defaults to 7 days when no count specified', async () => {
      mockFetch(createMockRouter({ forecast: makeForecastResponse(14) }));
      const result = await getForecast(37.7749, -122.4194);

      expect(result.periods.length).toBe(14); // 7 days = 14 periods
    });
  });

  // ---------- Alerts ----------

  describe('getAlerts', () => {
    test('returns empty array when no alerts active', async () => {
      mockFetch(createMockRouter({ alerts: makeAlertsResponse(0) }));
      const result = await getAlerts(37.7749, -122.4194);

      expect(result.location).toBe('San Francisco, CA');
      expect(result.alerts).toHaveLength(0);
    });

    test('returns parsed alerts when active', async () => {
      mockFetch(createMockRouter({ alerts: makeAlertsResponse(2) }));
      const result = await getAlerts(37.7749, -122.4194);

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].event).toBe('Test Alert 1');
      expect(result.alerts[0].severity).toBe('Moderate');
      expect(result.alerts[0].areas).toBe('San Francisco County');
      expect(result.alerts[1].event).toBe('Test Alert 2');
    });

    test('handles null instruction field', async () => {
      mockFetch(
        createMockRouter({
          alerts: {
            features: [
              {
                properties: {
                  event: 'Wind Advisory',
                  headline: 'Wind Advisory',
                  severity: 'Minor',
                  urgency: 'Expected',
                  areaDesc: 'Test Area',
                  description: 'Windy conditions expected.',
                  instruction: null,
                  effective: '2024-01-15T10:00:00Z',
                  expires: '2024-01-16T10:00:00Z',
                },
              },
            ],
          },
        })
      );

      const result = await getAlerts(37.7749, -122.4194);
      expect(result.alerts[0].instruction).toBe('No specific instructions.');
    });
  });
});
