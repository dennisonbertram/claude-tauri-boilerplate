/**
 * Weather API client using the National Weather Service API (https://api.weather.gov)
 * and Nominatim geocoding (https://nominatim.openstreetmap.org).
 *
 * NWS API is free, no key required, US-based only.
 * Nominatim is free, no key required, worldwide.
 */

const USER_AGENT = 'ClaudeTauriApp/1.0 (weather-connector)';

// ---------------------------------------------------------------------------
// Geocoding cache (simple TTL map)
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const geocodeCache = new Map<string, CacheEntry<GeocodingResult>>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCached(key: string): GeocodingResult | undefined {
  const entry = geocodeCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    geocodeCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache(key: string, value: GeocodingResult): void {
  geocodeCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Exported for testing — clears the in-memory geocoding cache. */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
}

export interface CurrentConditions {
  location: string;
  timestamp: string;
  temperature: string;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  humidity: string;
  dewpoint: string;
}

export interface ForecastPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
}

export interface WeatherAlert {
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  areas: string;
  description: string;
  instruction: string;
  effective: string;
  expires: string;
}

// ---------------------------------------------------------------------------
// Geocoding (Nominatim)
// ---------------------------------------------------------------------------

export async function geocodeCity(cityName: string): Promise<GeocodingResult> {
  const cacheKey = cityName.toLowerCase().trim();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', cityName);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!data || data.length === 0) {
    throw new Error(`Location not found: "${cityName}". Try a US city name like "San Francisco, CA".`);
  }

  const result: GeocodingResult = {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };

  setCache(cacheKey, result);
  return result;
}

// ---------------------------------------------------------------------------
// NWS API: resolve grid point
// ---------------------------------------------------------------------------

interface NwsPointsResponse {
  properties: {
    gridId: string;
    gridX: number;
    gridY: number;
    forecast: string;
    forecastHourly: string;
    observationStations: string;
    relativeLocation: {
      properties: {
        city: string;
        state: string;
      };
    };
  };
}

async function fetchNwsJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    },
  });

  if (response.status === 404) {
    throw new Error(
      'Location not supported by NWS. The National Weather Service only covers US locations.'
    );
  }

  if (!response.ok) {
    throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function resolveGridPoint(
  lat: number,
  lon: number
): Promise<NwsPointsResponse['properties']> {
  const url = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const data = await fetchNwsJson<NwsPointsResponse>(url);
  return data.properties;
}

// ---------------------------------------------------------------------------
// Current conditions
// ---------------------------------------------------------------------------

interface NwsObservationResponse {
  properties: {
    timestamp: string;
    textDescription: string;
    temperature: { value: number | null; unitCode: string };
    windSpeed: { value: number | null; unitCode: string };
    windDirection: { value: number | null };
    relativeHumidity: { value: number | null };
    dewpoint: { value: number | null; unitCode: string };
  };
}

interface NwsStationsResponse {
  features: Array<{
    properties: { stationIdentifier: string };
  }>;
}

function windDegreesToDirection(degrees: number | null): string {
  if (degrees === null) return 'N/A';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function celsiusToFahrenheit(c: number | null): string {
  if (c === null) return 'N/A';
  return `${Math.round(c * 9 / 5 + 32)}`;
}

function metersPerSecToMph(mps: number | null): string {
  if (mps === null) return 'N/A';
  return `${Math.round(mps * 2.237)} mph`;
}

export async function getCurrentConditions(
  lat: number,
  lon: number
): Promise<CurrentConditions> {
  const point = await resolveGridPoint(lat, lon);
  const locationName = `${point.relativeLocation.properties.city}, ${point.relativeLocation.properties.state}`;

  // Get nearest observation station
  const stations = await fetchNwsJson<NwsStationsResponse>(point.observationStations);
  if (!stations.features || stations.features.length === 0) {
    throw new Error('No observation stations found for this location.');
  }

  const stationId = stations.features[0].properties.stationIdentifier;
  const obsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
  const obs = await fetchNwsJson<NwsObservationResponse>(obsUrl);
  const props = obs.properties;

  return {
    location: locationName,
    timestamp: props.timestamp,
    temperature: celsiusToFahrenheit(props.temperature.value),
    temperatureUnit: 'F',
    windSpeed: metersPerSecToMph(props.windSpeed.value),
    windDirection: windDegreesToDirection(props.windDirection.value),
    shortForecast: props.textDescription || 'N/A',
    humidity: props.relativeHumidity.value !== null
      ? `${Math.round(props.relativeHumidity.value)}%`
      : 'N/A',
    dewpoint: props.dewpoint.value !== null
      ? `${celsiusToFahrenheit(props.dewpoint.value)}\u00B0F`
      : 'N/A',
  };
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

interface NwsForecastResponse {
  properties: {
    periods: Array<{
      name: string;
      temperature: number;
      temperatureUnit: string;
      windSpeed: string;
      windDirection: string;
      shortForecast: string;
      detailedForecast: string;
      isDaytime: boolean;
    }>;
  };
}

export async function getForecast(
  lat: number,
  lon: number,
  days: number = 7
): Promise<{ location: string; periods: ForecastPeriod[] }> {
  const point = await resolveGridPoint(lat, lon);
  const locationName = `${point.relativeLocation.properties.city}, ${point.relativeLocation.properties.state}`;

  const data = await fetchNwsJson<NwsForecastResponse>(point.forecast);
  // NWS returns 14 periods (day/night for 7 days). Limit by requested days.
  const maxPeriods = days * 2;
  const periods = data.properties.periods.slice(0, maxPeriods).map((p) => ({
    name: p.name,
    temperature: p.temperature,
    temperatureUnit: p.temperatureUnit,
    windSpeed: p.windSpeed,
    windDirection: p.windDirection,
    shortForecast: p.shortForecast,
    detailedForecast: p.detailedForecast,
    isDaytime: p.isDaytime,
  }));

  return { location: locationName, periods };
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

interface NwsAlertsResponse {
  features: Array<{
    properties: {
      event: string;
      headline: string;
      severity: string;
      urgency: string;
      areaDesc: string;
      description: string;
      instruction: string | null;
      effective: string;
      expires: string;
    };
  }>;
}

export async function getAlerts(
  lat: number,
  lon: number
): Promise<{ location: string; alerts: WeatherAlert[] }> {
  const point = await resolveGridPoint(lat, lon);
  const locationName = `${point.relativeLocation.properties.city}, ${point.relativeLocation.properties.state}`;

  // Use the zone-based alert endpoint
  const alertUrl = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
  const data = await fetchNwsJson<NwsAlertsResponse>(alertUrl);

  const alerts = data.features.map((f) => ({
    event: f.properties.event,
    headline: f.properties.headline,
    severity: f.properties.severity,
    urgency: f.properties.urgency,
    areas: f.properties.areaDesc,
    description: f.properties.description,
    instruction: f.properties.instruction || 'No specific instructions.',
    effective: f.properties.effective,
    expires: f.properties.expires,
  }));

  return { location: locationName, alerts };
}
