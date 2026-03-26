import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { ConnectorToolDefinition } from '../types';
import { fenceUntrustedContent, sanitizeError } from '../utils';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function requireApiKey(): string {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY environment variable is not set. ' +
        'Please configure your Google Maps API key.'
    );
  }
  return key;
}

// ---------------------------------------------------------------------------
// Raw API functions (exported for tests)
// ---------------------------------------------------------------------------

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const apiKey = requireApiKey();
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Geocoding API HTTP error: ${res.status}`);
  }

  const data = (await res.json()) as {
    status: string;
    results: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      place_id: string;
    }>;
  };

  if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
    throw new Error(`No results found for address: "${address}"`);
  }

  if (data.status !== 'OK') {
    throw new Error(`Geocoding API error: ${data.status}`);
  }

  const first = data.results[0];
  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formattedAddress: first.formatted_address,
    placeId: first.place_id,
  };
}

export interface DirectionsResult {
  routes: Array<{
    distanceMeters: number;
    duration: string;
    description: string;
    steps: Array<{
      instruction: string;
      distance: string;
    }>;
  }>;
}

export async function getDirections(
  origin: string,
  destination: string,
  travelMode: string
): Promise<DirectionsResult> {
  const apiKey = requireApiKey();

  const body = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode,
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
    },
    languageCode: 'en-US',
    units: 'METRIC',
  };

  const res = await fetch(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'routes.duration,routes.distanceMeters,routes.description,routes.legs.steps.navigationInstruction,routes.legs.steps.localizedValues',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Routes API HTTP error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: { seconds?: string; text?: string };
      description?: string;
      legs?: Array<{
        duration?: { seconds?: string; text?: string };
        distanceMeters?: number;
        steps?: Array<{
          navigationInstruction?: { instructions?: string };
          localizedValues?: { distance?: { text?: string } };
        }>;
      }>;
    }>;
  };

  if (!data.routes?.length) {
    throw new Error('No routes found for the given origin and destination.');
  }

  return {
    routes: data.routes.map((r) => ({
      distanceMeters: r.distanceMeters ?? 0,
      duration: r.duration?.text ?? r.duration?.seconds ?? 'Unknown',
      description: r.description ?? '',
      steps: (r.legs?.[0]?.steps ?? []).map((s) => ({
        instruction: s.navigationInstruction?.instructions ?? '',
        distance: s.localizedValues?.distance?.text ?? '',
      })),
    })),
  };
}

export interface PlaceSearchResult {
  places: Array<{
    id: string;
    name: string;
    address: string;
    rating: number | null;
    userRatingCount: number | null;
    types: string[];
  }>;
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult> {
  const apiKey = requireApiKey();

  const res = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.types',
      },
      body: JSON.stringify({ textQuery: query }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Places API HTTP error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      rating?: number;
      userRatingCount?: number;
      types?: string[];
    }>;
  };

  return {
    places: (data.places ?? []).map((p) => ({
      id: p.id ?? '',
      name: fenceUntrustedContent(p.displayName?.text ?? '', 'google-maps'),
      address: fenceUntrustedContent(p.formattedAddress ?? '', 'google-maps'),
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? null,
      types: p.types ?? [],
    })),
  };
}

export interface PlaceDetailsResult {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingCount: number | null;
  phoneNumber: string | null;
  website: string | null;
  openNow: boolean | null;
  weekdayDescriptions: string[];
  reviews: Array<{
    author: string;
    rating: number;
    text: string;
    time: string;
  }>;
  summary: string | null;
  types: string[];
}

export async function getPlaceDetails(
  placeId: string
): Promise<PlaceDetailsResult> {
  const apiKey = requireApiKey();

  const fieldMask = [
    'id',
    'displayName',
    'formattedAddress',
    'rating',
    'userRatingCount',
    'nationalPhoneNumber',
    'websiteUri',
    'regularOpeningHours',
    'reviews',
    'editorialSummary',
    'types',
  ].join(',');

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Place Details API HTTP error ${res.status}: ${text}`
    );
  }

  const data = (await res.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    regularOpeningHours?: {
      openNow?: boolean;
      weekdayDescriptions?: string[];
    };
    reviews?: Array<{
      authorAttribution?: { displayName?: string };
      rating?: number;
      text?: { text?: string };
      publishTime?: string;
    }>;
    editorialSummary?: { text?: string };
    types?: string[];
  };

  return {
    id: data.id ?? placeId,
    name: fenceUntrustedContent(data.displayName?.text ?? '', 'google-maps'),
    address: fenceUntrustedContent(data.formattedAddress ?? '', 'google-maps'),
    rating: data.rating ?? null,
    userRatingCount: data.userRatingCount ?? null,
    phoneNumber: data.nationalPhoneNumber ?? null,
    website: data.websiteUri ?? null,
    openNow: data.regularOpeningHours?.openNow ?? null,
    weekdayDescriptions: data.regularOpeningHours?.weekdayDescriptions ?? [],
    reviews: (data.reviews ?? []).map((r) => ({
      author: r.authorAttribution?.displayName ?? 'Anonymous',
      rating: r.rating ?? 0,
      text: fenceUntrustedContent(r.text?.text ?? '', 'google-maps'),
      time: r.publishTime ?? '',
    })),
    summary: data.editorialSummary?.text
      ? fenceUntrustedContent(data.editorialSummary.text, 'google-maps')
      : null,
    types: data.types ?? [],
  };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const geocodeTool = tool(
  'maps_geocode',
  'Geocode an address to get latitude/longitude coordinates and place ID.',
  {
    address: z.string().describe('The address to geocode (e.g. "1600 Amphitheatre Pkwy, Mountain View, CA")'),
  },
  async (args) => {
    try {
      const result = await geocodeAddress(args.address);
      const text = [
        `Geocode Result for: ${args.address}`,
        '',
        `Formatted Address: ${result.formattedAddress}`,
        `Latitude:  ${result.lat}`,
        `Longitude: ${result.lng}`,
        `Place ID:  ${result.placeId}`,
      ].join('\n');
      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Geocode Address',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

const directionsTool = tool(
  'maps_directions',
  'Get driving, cycling, walking, or transit directions between two locations.',
  {
    origin: z.string().describe('Starting location (address or place name)'),
    destination: z.string().describe('Ending location (address or place name)'),
    travelMode: z
      .enum(['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'])
      .default('DRIVE')
      .describe('Mode of travel (DRIVE, WALK, BICYCLE, or TRANSIT)'),
  },
  async (args) => {
    try {
      const result = await getDirections(args.origin, args.destination, args.travelMode);
      const route = result.routes[0];

      const lines = [
        `Directions from "${args.origin}" to "${args.destination}"`,
        `Travel Mode: ${args.travelMode}`,
        '',
        `Distance: ${(route.distanceMeters / 1000).toFixed(1)} km`,
        `Duration: ${route.duration}`,
        route.description ? `Via: ${route.description}` : '',
        '',
        '--- Steps ---',
      ].filter(Boolean);

      for (const step of route.steps) {
        if (step.instruction) {
          lines.push(`• ${step.instruction}${step.distance ? ` (${step.distance})` : ''}`);
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Get Directions',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

const searchPlacesTool = tool(
  'maps_search_places',
  'Search for places by text query (e.g. "coffee shops near downtown Seattle"). Returns a list of matching places with addresses, ratings, and place IDs.',
  {
    query: z.string().describe('Text search query (e.g. "Italian restaurants in Manhattan")'),
    maxResults: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .describe('Maximum number of results to return (1-20, default 5)'),
  },
  async (args) => {
    try {
      const result = await searchPlaces(args.query);
      const places = result.places.slice(0, args.maxResults ?? 5);

      if (places.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No places found for query: "${args.query}"`,
            },
          ],
        };
      }

      const lines = [`Places matching "${args.query}" (${places.length} result${places.length !== 1 ? 's' : ''}):`, ''];
      for (const place of places) {
        lines.push(
          `Name: ${place.name}`,
          `Address: ${place.address}`,
          place.rating !== null ? `Rating: ${place.rating}/5 (${place.userRatingCount ?? 0} reviews)` : 'Rating: N/A',
          `Place ID: ${place.id}`,
          ''
        );
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Search Places',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

const placeDetailsTool = tool(
  'maps_place_details',
  'Get detailed information for a place by its Place ID (use maps_search_places to find place IDs).',
  {
    placeId: z.string().describe('Google Maps Place ID (e.g. "ChIJN1t_tDeuEmsRUsoyG83frY4")'),
  },
  async (args) => {
    try {
      const d = await getPlaceDetails(args.placeId);

      const lines = [
        `Place Details: ${d.name}`,
        '',
        `Address:  ${d.address}`,
        d.phoneNumber ? `Phone:    ${d.phoneNumber}` : null,
        d.website ? `Website:  ${d.website}` : null,
        d.rating !== null
          ? `Rating:   ${d.rating}/5 (${d.userRatingCount ?? 0} reviews)`
          : 'Rating:   N/A',
        d.openNow !== null
          ? `Open Now: ${d.openNow ? 'Yes' : 'No'}`
          : null,
      ].filter(Boolean) as string[];

      if (d.weekdayDescriptions.length > 0) {
        lines.push('', 'Opening Hours:');
        for (const desc of d.weekdayDescriptions) {
          lines.push(`  ${desc}`);
        }
      }

      if (d.summary) {
        lines.push('', `Summary: ${d.summary}`);
      }

      if (d.reviews.length > 0) {
        lines.push('', `Reviews (${d.reviews.length}):`);
        for (const review of d.reviews.slice(0, 3)) {
          lines.push(
            `  ${review.author} — ${review.rating}/5`,
            `  ${review.text}`,
            ''
          );
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${sanitizeError(error)}` }],
        isError: true,
      };
    }
  },
  {
    annotations: {
      title: 'Place Details',
      readOnlyHint: true,
      openWorldHint: true,
    },
  }
);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const googleMapsTools: ConnectorToolDefinition[] = [
  {
    name: 'maps_geocode',
    description: 'Geocode an address to latitude/longitude coordinates',
    sdkTool: geocodeTool,
  },
  {
    name: 'maps_directions',
    description: 'Get directions between two locations',
    sdkTool: directionsTool,
  },
  {
    name: 'maps_search_places',
    description: 'Search for places by text query',
    sdkTool: searchPlacesTool,
  },
  {
    name: 'maps_place_details',
    description: 'Get detailed information for a place by Place ID',
    sdkTool: placeDetailsTool,
  },
];
