import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAccessToken(): string {
  const token = process.env.STRAVA_ACCESS_TOKEN;
  if (!token) {
    throw new Error('STRAVA_ACCESS_TOKEN environment variable is not set');
  }
  return token;
}

interface RateLimitInfo {
  limit: string | null;
  usage: string | null;
}

function extractRateLimitInfo(headers: Headers): RateLimitInfo {
  return {
    limit: headers.get('X-RateLimit-Limit'),
    usage: headers.get('X-RateLimit-Usage'),
  };
}

function formatRateLimitSuffix(rl: RateLimitInfo): string {
  if (!rl.limit || !rl.usage) return '';
  return `\n\n[Rate limit: ${rl.usage} used of ${rl.limit} (15min/daily)]`;
}

async function stravaFetch(path: string, params?: Record<string, string | number>): Promise<{ data: unknown; rateLimitInfo: RateLimitInfo }> {
  const token = getAccessToken();
  const url = new URL(`${STRAVA_API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const rateLimitInfo = extractRateLimitInfo(response.headers);

  if (!response.ok) {
    let errorMsg = `Strava API error: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json() as { message?: string; errors?: unknown[] };
      if (errorBody.message) {
        errorMsg += ` — ${errorBody.message}`;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return { data, rateLimitInfo };
}

// ---------------------------------------------------------------------------
// Unit formatting helpers
// ---------------------------------------------------------------------------

export function formatDistance(meters: number): string {
  const km = meters / 1000;
  const miles = meters / 1609.344;
  return `${km.toFixed(2)} km (${miles.toFixed(2)} mi)`;
}

export function formatElevation(meters: number): string {
  const feet = meters * 3.28084;
  return `${meters.toFixed(0)} m (${feet.toFixed(0)} ft)`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPace(metersPerSecond: number): string {
  if (metersPerSecond <= 0) return 'N/A';
  const totalSeconds = Math.round(1000 / metersPerSecond);
  const minPart = Math.floor(totalSeconds / 60);
  const secPart = totalSeconds % 60;
  return `${minPart}:${String(secPart).padStart(2, '0')} /km`;
}

// ---------------------------------------------------------------------------
// strava_get_activities
// ---------------------------------------------------------------------------

function createGetActivitiesTool() {
  return tool(
    'strava_get_activities',
    "List the authenticated athlete's recent activities with optional pagination.",
    {
      per_page: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Number of activities per page (1-200, default 30)'),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Page number (default 1)'),
      before: z
        .number()
        .int()
        .optional()
        .describe('Unix timestamp — return only activities before this time'),
      after: z
        .number()
        .int()
        .optional()
        .describe('Unix timestamp — return only activities after this time'),
    },
    async (args) => {
      try {
        const params: Record<string, string | number> = {
          per_page: args.per_page ?? 30,
          page: args.page ?? 1,
        };
        if (args.before !== undefined) params.before = args.before;
        if (args.after !== undefined) params.after = args.after;

        const { data, rateLimitInfo } = await stravaFetch('/athlete/activities', params);
        const activities = data as Array<{
          id: number;
          name: string;
          type: string;
          sport_type?: string;
          start_date_local: string;
          distance: number;
          moving_time: number;
          elapsed_time: number;
          total_elevation_gain: number;
          average_speed: number;
          max_speed: number;
          kudos_count?: number;
          achievement_count?: number;
        }>;

        if (!Array.isArray(activities) || activities.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No activities found.' + formatRateLimitSuffix(rateLimitInfo) }] };
        }

        const lines: string[] = [
          `Found ${activities.length} activit${activities.length !== 1 ? 'ies' : 'y'} (page ${args.page ?? 1}):`,
          '',
        ];

        for (const act of activities) {
          const sportType = act.sport_type ?? act.type;
          lines.push(
            `ID: ${act.id}`,
            `Name: ${fenceUntrustedContent(act.name, 'Strava')}`,
            `Type: ${sportType}`,
            `Date: ${act.start_date_local}`,
            `Distance: ${formatDistance(act.distance)}`,
            `Moving Time: ${formatDuration(act.moving_time)}`,
            `Elevation Gain: ${formatElevation(act.total_elevation_gain)}`,
            `Avg Speed: ${formatPace(act.average_speed)}`,
            `Kudos: ${act.kudos_count ?? 0}`,
            ''
          );
        }

        lines.push(formatRateLimitSuffix(rateLimitInfo).trim());

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing activities: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Strava Activities',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// strava_get_activity
// ---------------------------------------------------------------------------

function createGetActivityTool() {
  return tool(
    'strava_get_activity',
    'Get detailed information about a specific Strava activity by its ID.',
    {
      activity_id: z.number().int().describe('The Strava activity ID'),
    },
    async (args) => {
      try {
        const { data, rateLimitInfo } = await stravaFetch(`/activities/${args.activity_id}`);
        const act = data as {
          id: number;
          name: string;
          description?: string;
          type: string;
          sport_type?: string;
          start_date_local: string;
          distance: number;
          moving_time: number;
          elapsed_time: number;
          total_elevation_gain: number;
          average_speed: number;
          max_speed: number;
          average_heartrate?: number;
          max_heartrate?: number;
          calories?: number;
          kudos_count?: number;
          achievement_count?: number;
          pr_count?: number;
          gear?: { id: string; name: string };
          map?: { summary_polyline?: string };
          segment_efforts?: unknown[];
          splits_metric?: unknown[];
        };

        const sportType = act.sport_type ?? act.type;
        const lines: string[] = [
          `Activity ID: ${act.id}`,
          `Name: ${fenceUntrustedContent(act.name, 'Strava')}`,
          `Description: ${act.description ? fenceUntrustedContent(act.description, 'Strava') : '(none)'}`,
          `Type: ${sportType}`,
          `Date: ${act.start_date_local}`,
          '',
          '--- Stats ---',
          `Distance: ${formatDistance(act.distance)}`,
          `Moving Time: ${formatDuration(act.moving_time)}`,
          `Elapsed Time: ${formatDuration(act.elapsed_time)}`,
          `Elevation Gain: ${formatElevation(act.total_elevation_gain)}`,
          `Avg Speed: ${formatPace(act.average_speed)}`,
          `Max Speed: ${formatPace(act.max_speed)}`,
        ];

        if (act.average_heartrate !== undefined) {
          lines.push(`Avg HR: ${Math.round(act.average_heartrate)} bpm`);
        }
        if (act.max_heartrate !== undefined) {
          lines.push(`Max HR: ${Math.round(act.max_heartrate)} bpm`);
        }
        if (act.calories !== undefined) {
          lines.push(`Calories: ${Math.round(act.calories)} kcal`);
        }

        lines.push(
          '',
          '--- Achievements ---',
          `Kudos: ${act.kudos_count ?? 0}`,
          `Achievements: ${act.achievement_count ?? 0}`,
          `PRs: ${act.pr_count ?? 0}`
        );

        if (act.gear) {
          lines.push('', `Gear: ${fenceUntrustedContent(act.gear.name, 'Strava')} (ID: ${act.gear.id})`);
        }

        if (act.segment_efforts) {
          lines.push(`Segment Efforts: ${act.segment_efforts.length}`);
        }

        lines.push(formatRateLimitSuffix(rateLimitInfo).trim());

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving activity: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Strava Activity',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// strava_get_athlete
// ---------------------------------------------------------------------------

function createGetAthleteTool() {
  return tool(
    'strava_get_athlete',
    'Get the authenticated athlete profile from Strava.',
    {},
    async (_args) => {
      try {
        const { data, rateLimitInfo } = await stravaFetch('/athlete');
        const athlete = data as {
          id: number;
          firstname?: string;
          lastname?: string;
          username?: string;
          bio?: string;
          city?: string;
          state?: string;
          country?: string;
          sex?: string;
          premium?: boolean;
          summit?: boolean;
          created_at?: string;
          updated_at?: string;
          follower_count?: number;
          friend_count?: number;
          measurement_preference?: string;
          ftp?: number;
          weight?: number;
        };

        const fullName = [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || '(unknown)';

        const lines: string[] = [
          `Athlete ID: ${athlete.id}`,
          `Name: ${fenceUntrustedContent(fullName, 'Strava')}`,
          `Username: ${athlete.username ?? '(none)'}`,
          `Bio: ${athlete.bio ? fenceUntrustedContent(athlete.bio, 'Strava') : '(none)'}`,
          `Location: ${athlete.city ? fenceUntrustedContent(athlete.city, 'Strava') : '(unknown)'}, ${athlete.state ?? ''}, ${athlete.country ?? ''}`,
          `Sex: ${athlete.sex ?? 'not specified'}`,
          `Subscription: ${athlete.summit ? 'Summit' : athlete.premium ? 'Premium' : 'Free'}`,
          `Member Since: ${athlete.created_at ?? 'unknown'}`,
          `Followers: ${athlete.follower_count ?? 0}`,
          `Following: ${athlete.friend_count ?? 0}`,
          `Measurement: ${athlete.measurement_preference ?? 'metric'}`,
        ];

        if (athlete.weight !== undefined && athlete.weight > 0) {
          lines.push(`Weight: ${athlete.weight.toFixed(1)} kg`);
        }
        if (athlete.ftp !== undefined && athlete.ftp > 0) {
          lines.push(`FTP: ${athlete.ftp} watts`);
        }

        lines.push(formatRateLimitSuffix(rateLimitInfo).trim());

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving athlete profile: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Strava Athlete',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// strava_get_athlete_stats
// ---------------------------------------------------------------------------

function createGetAthleteStatsTool() {
  return tool(
    'strava_get_athlete_stats',
    "Get the authenticated athlete's aggregated training statistics including all-time totals, year-to-date, and recent 4-week totals.",
    {
      athlete_id: z.number().int().describe("The athlete's Strava ID (required by the API)"),
    },
    async (args) => {
      try {
        const { data, rateLimitInfo } = await stravaFetch(`/athletes/${args.athlete_id}/stats`);
        const stats = data as {
          biggest_ride_distance?: number;
          biggest_climb_elevation_gain?: number;
          recent_ride_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number; achievement_count?: number };
          recent_run_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number; achievement_count?: number };
          recent_swim_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number };
          ytd_ride_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
          ytd_run_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
          ytd_swim_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number };
          all_ride_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
          all_run_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number; elevation_gain: number };
          all_swim_totals?: { count: number; distance: number; moving_time: number; elapsed_time: number };
        };

        function formatTotals(label: string, t: { count: number; distance: number; moving_time: number; elevation_gain?: number } | undefined): string[] {
          if (!t) return [`${label}: no data`];
          const lines = [
            `${label}:`,
            `  Activities: ${t.count}`,
            `  Distance: ${formatDistance(t.distance)}`,
            `  Moving Time: ${formatDuration(t.moving_time)}`,
          ];
          if (t.elevation_gain !== undefined) {
            lines.push(`  Elevation: ${formatElevation(t.elevation_gain)}`);
          }
          return lines;
        }

        const lines: string[] = [
          `Athlete Stats (ID: ${args.athlete_id})`,
          '',
        ];

        if (stats.biggest_ride_distance !== undefined) {
          lines.push(`Biggest Ride: ${formatDistance(stats.biggest_ride_distance)}`);
        }
        if (stats.biggest_climb_elevation_gain !== undefined) {
          lines.push(`Biggest Climb Elevation: ${formatElevation(stats.biggest_climb_elevation_gain)}`);
        }

        lines.push('', '--- Recent (4 weeks) ---');
        lines.push(...formatTotals('Rides', stats.recent_ride_totals));
        lines.push(...formatTotals('Runs', stats.recent_run_totals));
        lines.push(...formatTotals('Swims', stats.recent_swim_totals));

        lines.push('', '--- Year to Date ---');
        lines.push(...formatTotals('Rides', stats.ytd_ride_totals));
        lines.push(...formatTotals('Runs', stats.ytd_run_totals));
        lines.push(...formatTotals('Swims', stats.ytd_swim_totals));

        lines.push('', '--- All Time ---');
        lines.push(...formatTotals('Rides', stats.all_ride_totals));
        lines.push(...formatTotals('Runs', stats.all_run_totals));
        lines.push(...formatTotals('Swims', stats.all_swim_totals));

        lines.push(formatRateLimitSuffix(rateLimitInfo).trim());

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error retrieving athlete stats: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Strava Athlete Stats',
        readOnlyHint: true,
        openWorldHint: true,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createStravaTools(): ConnectorToolDefinition[] {
  return [
    {
      name: 'strava_get_activities',
      description: "List the athlete's recent Strava activities with pagination",
      sdkTool: createGetActivitiesTool(),
    },
    {
      name: 'strava_get_activity',
      description: 'Get detailed information about a specific Strava activity by ID',
      sdkTool: createGetActivityTool(),
    },
    {
      name: 'strava_get_athlete',
      description: 'Get the authenticated athlete profile from Strava',
      sdkTool: createGetAthleteTool(),
    },
    {
      name: 'strava_get_athlete_stats',
      description: "Get the athlete's aggregated training statistics",
      sdkTool: createGetAthleteStatsTool(),
    },
  ];
}
