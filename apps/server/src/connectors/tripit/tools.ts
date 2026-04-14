import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { createHmac, randomBytes } from 'crypto';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// OAuth 1.0a helpers
// ---------------------------------------------------------------------------

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(new URLSearchParams(Object.entries(params).sort()).toString()),
  ].join('&');
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function buildAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: token,
    oauth_version: '1.0',
  };

  const signature = oauthSign(method, url, oauthParams, consumerSecret, tokenSecret);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

function getCredentials() {
  const token = process.env.TRIPIT_TOKEN;
  const tokenSecret = process.env.TRIPIT_TOKEN_SECRET;
  const consumerKey = process.env.TRIPIT_CONSUMER_KEY;
  const consumerSecret = process.env.TRIPIT_CONSUMER_SECRET;

  if (!token || !tokenSecret || !consumerKey || !consumerSecret) {
    throw new Error(
      'TripIt credentials not configured. Set TRIPIT_TOKEN, TRIPIT_TOKEN_SECRET, TRIPIT_CONSUMER_KEY, and TRIPIT_CONSUMER_SECRET.'
    );
  }

  return { token, tokenSecret, consumerKey, consumerSecret };
}

async function tripitFetch(method: string, path: string): Promise<unknown> {
  const { token, tokenSecret, consumerKey, consumerSecret } = getCredentials();
  const url = `https://api.tripit.com/v1/${path}`;
  const authHeader = buildAuthHeader(method, url, consumerKey, consumerSecret, token, tokenSecret);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`TripIt API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// tripit_list_trips
// ---------------------------------------------------------------------------

function createListTripsTool(_db: Database) {
  return tool(
    'tripit_list_trips',
    'List all trips from TripIt. Returns trip names, destinations, and date ranges.',
    {},
    async (_args) => {
      try {
        const data = (await tripitFetch('GET', 'list/trip?format=json')) as any;
        const trips: any[] = [];

        // TripIt returns Trip as an object when there is one, or an array when multiple
        if (data?.Trip) {
          if (Array.isArray(data.Trip)) {
            trips.push(...data.Trip);
          } else {
            trips.push(data.Trip);
          }
        }

        if (trips.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No trips found.' }] };
        }

        const lines: string[] = [`Found ${trips.length} trip${trips.length !== 1 ? 's' : ''}:`, ''];

        for (const trip of trips) {
          lines.push(
            `ID: ${trip.id}`,
            `Name: ${fenceUntrustedContent(trip.display_name ?? trip.id, 'TripIt')}`,
            `Primary Location: ${fenceUntrustedContent(trip.primary_location ?? 'Unknown', 'TripIt')}`,
            `Start Date: ${trip.start_date ?? 'N/A'}`,
            `End Date: ${trip.end_date ?? 'N/A'}`,
            ``
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing trips: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List TripIt Trips',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// tripit_get_trip
// ---------------------------------------------------------------------------

function createGetTripTool(_db: Database) {
  return tool(
    'tripit_get_trip',
    'Get full details for a specific TripIt trip by its ID.',
    {
      id: z.string().describe('The TripIt trip ID to retrieve'),
    },
    async (args) => {
      try {
        const data = (await tripitFetch('GET', `get/trip/id/${args.id}?format=json`)) as any;
        const trip = data?.Trip;

        if (!trip) {
          return {
            content: [{ type: 'text' as const, text: `Trip ${args.id} not found.` }],
            isError: true,
          };
        }

        const lines: string[] = [
          `Trip ID: ${trip.id}`,
          `Name: ${fenceUntrustedContent(trip.display_name ?? trip.id, 'TripIt')}`,
          `Primary Location: ${fenceUntrustedContent(trip.primary_location ?? 'Unknown', 'TripIt')}`,
          `Start Date: ${trip.start_date ?? 'N/A'}`,
          `End Date: ${trip.end_date ?? 'N/A'}`,
          `Description: ${fenceUntrustedContent(trip.description ?? 'None', 'TripIt')}`,
          `Is Private: ${trip.is_private ?? false}`,
          `Relative URL: ${trip.relative_url ?? 'N/A'}`,
        ];

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving trip: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get TripIt Trip',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// tripit_get_flights
// ---------------------------------------------------------------------------

function createGetFlightsTool(_db: Database) {
  return tool(
    'tripit_get_flights',
    'Get flight segments for a specific TripIt trip by its ID.',
    {
      trip_id: z.string().describe('The TripIt trip ID to retrieve flights for'),
    },
    async (args) => {
      try {
        const data = (await tripitFetch(
          'GET',
          `list/object/type/air?format=json&trip_id=${encodeURIComponent(args.trip_id)}`
        )) as any;

        const segments: any[] = [];

        // AirObject wraps AirSegment
        const airObjects: any[] = Array.isArray(data?.AirObject)
          ? data.AirObject
          : data?.AirObject
            ? [data.AirObject]
            : [];

        for (const airObj of airObjects) {
          const segs = Array.isArray(airObj.Segment) ? airObj.Segment : airObj.Segment ? [airObj.Segment] : [];
          segments.push(...segs);
        }

        if (segments.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No flight segments found for this trip.' }] };
        }

        const lines: string[] = [`Found ${segments.length} flight segment${segments.length !== 1 ? 's' : ''}:`, ''];

        for (const seg of segments) {
          lines.push(
            `Flight: ${fenceUntrustedContent(seg.marketing_airline ?? seg.operating_airline ?? 'Unknown Airline', 'TripIt')} ${seg.marketing_flight_number ?? seg.flight_number ?? ''}`,
            `From: ${fenceUntrustedContent(seg.start_airport_name ?? seg.StartAirportAddress?.address ?? seg.start_airport_code ?? 'Unknown', 'TripIt')} (${seg.start_airport_code ?? 'N/A'})`,
            `To: ${fenceUntrustedContent(seg.end_airport_name ?? seg.EndAirportAddress?.address ?? seg.end_airport_code ?? 'Unknown', 'TripIt')} (${seg.end_airport_code ?? 'N/A'})`,
            `Departure: ${seg.start_date_time?.date ?? 'N/A'} ${seg.start_date_time?.time ?? ''}`,
            `Arrival: ${seg.end_date_time?.date ?? 'N/A'} ${seg.end_date_time?.time ?? ''}`,
            ``
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving flights: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get TripIt Flights',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// tripit_get_upcoming
// ---------------------------------------------------------------------------

function createGetUpcomingTool(_db: Database) {
  return tool(
    'tripit_get_upcoming',
    'List upcoming TripIt trips — trips whose start date is in the future.',
    {},
    async (_args) => {
      try {
        const data = (await tripitFetch('GET', 'list/trip?format=json')) as any;
        const allTrips: any[] = [];

        if (data?.Trip) {
          if (Array.isArray(data.Trip)) {
            allTrips.push(...data.Trip);
          } else {
            allTrips.push(data.Trip);
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = allTrips.filter((trip) => {
          if (!trip.start_date) return false;
          return new Date(trip.start_date) >= today;
        });

        if (upcoming.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No upcoming trips found.' }] };
        }

        // Sort ascending by start date
        upcoming.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

        const lines: string[] = [`Found ${upcoming.length} upcoming trip${upcoming.length !== 1 ? 's' : ''}:`, ''];

        for (const trip of upcoming) {
          lines.push(
            `ID: ${trip.id}`,
            `Name: ${fenceUntrustedContent(trip.display_name ?? trip.id, 'TripIt')}`,
            `Primary Location: ${fenceUntrustedContent(trip.primary_location ?? 'Unknown', 'TripIt')}`,
            `Start Date: ${trip.start_date ?? 'N/A'}`,
            `End Date: ${trip.end_date ?? 'N/A'}`,
            ``
          );
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving upcoming trips: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Upcoming TripIt Trips',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createTripItTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'tripit_list_trips',
      description: 'List all trips from TripIt',
      sdkTool: createListTripsTool(db),
    },
    {
      name: 'tripit_get_trip',
      description: 'Get full details for a specific TripIt trip by ID',
      sdkTool: createGetTripTool(db),
    },
    {
      name: 'tripit_get_flights',
      description: 'Get flight segments for a specific TripIt trip',
      sdkTool: createGetFlightsTool(db),
    },
    {
      name: 'tripit_get_upcoming',
      description: 'List upcoming TripIt trips with start date in the future',
      sdkTool: createGetUpcomingTool(db),
    },
  ];
}
