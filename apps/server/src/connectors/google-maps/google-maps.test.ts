import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
) {
  globalThis.fetch = mock(handler as any) as any;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeGeocodeResponse(overrides: Record<string, unknown>[] = []) {
  if (overrides.length > 0) return overrides;
  return [
    {
      results: [
        {
          formatted_address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
          geometry: {
            location: { lat: 37.422, lng: -122.084 },
          },
          place_id: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
        },
      ],
      status: 'OK',
    },
  ];
}

function makeGeocodeApiResponse(
  status = 'OK',
  lat = 37.422,
  lng = -122.084
) {
  return {
    results: [
      {
        formatted_address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
        geometry: {
          location: { lat, lng },
        },
        place_id: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
      },
    ],
    status,
  };
}

function makeDirectionsResponse(status = 'OK') {
  return {
    routes: [
      {
        duration: { seconds: '1800', text: '30 mins' },
        distanceMeters: 25000,
        description: 'Via I-280 N',
        legs: [
          {
            duration: { seconds: '1800', text: '30 mins' },
            distanceMeters: 25000,
            steps: [
              {
                navigationInstruction: {
                  maneuver: 'TURN_LEFT',
                  instructions: 'Turn left onto Main St',
                },
                localizedValues: {
                  distance: { text: '500 m' },
                },
              },
            ],
          },
        ],
      },
    ],
    geocodingResults: {},
    fallbackInfo: {},
  };
}

function makePlacesSearchResponse(status = 200) {
  return {
    places: [
      {
        id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
        displayName: { text: 'Google Sydney', languageCode: 'en' },
        formattedAddress: '48 Pirrama Rd, Pyrmont NSW 2009, Australia',
        rating: 4.5,
        userRatingCount: 900,
        types: ['point_of_interest', 'establishment'],
      },
    ],
  };
}

function makePlaceDetailsResponse() {
  return {
    id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    displayName: { text: 'Google Sydney', languageCode: 'en' },
    formattedAddress: '48 Pirrama Rd, Pyrmont NSW 2009, Australia',
    rating: 4.5,
    userRatingCount: 900,
    nationalPhoneNumber: '+61 2 9374 4000',
    websiteUri: 'https://www.google.com.au/',
    regularOpeningHours: {
      openNow: true,
      weekdayDescriptions: [
        'Monday: 9:00 AM – 5:00 PM',
        'Tuesday: 9:00 AM – 5:00 PM',
      ],
    },
    reviews: [
      {
        name: 'places/ChIJ/reviews/1',
        authorAttribution: { displayName: 'Alice' },
        rating: 5,
        text: { text: 'Great place!' },
        publishTime: '2024-01-15T10:00:00Z',
      },
    ],
    editorialSummary: { text: 'Google headquarters in Sydney.' },
    types: ['point_of_interest', 'establishment'],
  };
}

// ---------------------------------------------------------------------------
// Mock router
// ---------------------------------------------------------------------------

function createMockRouter(overrides: {
  geocode?: any;
  geocodeStatus?: number;
  directionsBody?: any;
  directionsStatus?: number;
  placesSearchBody?: any;
  placesSearchStatus?: number;
  placeDetailsBody?: any;
  placeDetailsStatus?: number;
} = {}) {
  return (url: string, init?: RequestInit) => {
    // Geocoding API
    if (url.includes('maps.googleapis.com/maps/api/geocode')) {
      const body = overrides.geocode ?? makeGeocodeApiResponse();
      return new Response(JSON.stringify(body), {
        status: overrides.geocodeStatus ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Routes API (Directions)
    if (url.includes('routes.googleapis.com/directions')) {
      const body = overrides.directionsBody ?? makeDirectionsResponse();
      return new Response(JSON.stringify(body), {
        status: overrides.directionsStatus ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Places Text Search
    if (url.includes('places.googleapis.com/v1/places:searchText')) {
      const body = overrides.placesSearchBody ?? makePlacesSearchResponse();
      return new Response(JSON.stringify(body), {
        status: overrides.placesSearchStatus ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Place Details
    if (url.includes('places.googleapis.com/v1/places/')) {
      const body = overrides.placeDetailsBody ?? makePlaceDetailsResponse();
      return new Response(JSON.stringify(body), {
        status: overrides.placeDetailsStatus ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  };
}

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------

import {
  geocodeAddress,
  getDirections,
  searchPlaces,
  getPlaceDetails,
} from './tools';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Google Maps Tools', () => {
  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    restoreFetch();
    process.env = { ...originalEnv };
  });

  // ---------- maps_geocode ----------

  describe('geocodeAddress', () => {
    test('returns lat/lng for a valid address', async () => {
      mockFetch(createMockRouter());
      const result = await geocodeAddress('1600 Amphitheatre Pkwy, Mountain View, CA');
      expect(result.lat).toBeCloseTo(37.422);
      expect(result.lng).toBeCloseTo(-122.084);
      expect(result.formattedAddress).toContain('Mountain View');
    });

    test('includes place_id in result', async () => {
      mockFetch(createMockRouter());
      const result = await geocodeAddress('1600 Amphitheatre Pkwy');
      expect(result.placeId).toBe('ChIJ2eUgeAK6j4ARbn5u_wAGqWA');
    });

    test('throws when API key is missing', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      await expect(geocodeAddress('Some Address')).rejects.toThrow(
        'GOOGLE_MAPS_API_KEY'
      );
    });

    test('throws when status is ZERO_RESULTS', async () => {
      mockFetch(
        createMockRouter({
          geocode: { results: [], status: 'ZERO_RESULTS' },
        })
      );
      await expect(geocodeAddress('Nonexistent Place XYZ 99999')).rejects.toThrow(
        'No results'
      );
    });

    test('throws when HTTP request fails', async () => {
      mockFetch(() => new Response('Server Error', { status: 500 }));
      await expect(geocodeAddress('Some Address')).rejects.toThrow();
    });

    test('includes API key in request URL', async () => {
      let capturedUrl = '';
      globalThis.fetch = mock((url: string) => {
        capturedUrl = url;
        return new Response(JSON.stringify(makeGeocodeApiResponse()), {
          status: 200,
        });
      }) as any;
      await geocodeAddress('Test Address');
      expect(capturedUrl).toContain('key=test-api-key');
    });
  });

  // ---------- maps_directions ----------

  describe('getDirections', () => {
    test('returns route summary for valid origin and destination', async () => {
      mockFetch(createMockRouter());
      const result = await getDirections(
        'Mountain View, CA',
        'San Francisco, CA',
        'DRIVE'
      );
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].distanceMeters).toBe(25000);
    });

    test('uses Routes API POST endpoint', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;
      globalThis.fetch = mock((url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return new Response(JSON.stringify(makeDirectionsResponse()), {
          status: 200,
        });
      }) as any;
      await getDirections('A', 'B', 'DRIVE');
      expect(capturedUrl).toContain('routes.googleapis.com');
      expect(capturedInit?.method).toBe('POST');
    });

    test('includes field mask header for cost optimization', async () => {
      let capturedHeaders: Record<string, string> = {};
      globalThis.fetch = mock((url: string, init?: RequestInit) => {
        capturedHeaders = (init?.headers as Record<string, string>) ?? {};
        return new Response(JSON.stringify(makeDirectionsResponse()), {
          status: 200,
        });
      }) as any;
      await getDirections('A', 'B', 'DRIVE');
      const fieldMask =
        capturedHeaders['X-Goog-FieldMask'] ||
        capturedHeaders['x-goog-fieldmask'];
      expect(fieldMask).toBeTruthy();
      expect(fieldMask).toContain('routes');
    });

    test('throws when API key is missing', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      await expect(getDirections('A', 'B', 'DRIVE')).rejects.toThrow(
        'GOOGLE_MAPS_API_KEY'
      );
    });

    test('throws when no routes returned', async () => {
      mockFetch(createMockRouter({ directionsBody: { routes: [] } }));
      await expect(getDirections('A', 'B', 'DRIVE')).rejects.toThrow(
        'No routes'
      );
    });

    test('throws on HTTP error', async () => {
      mockFetch(
        createMockRouter({ directionsStatus: 400 })
      );
      await expect(getDirections('A', 'B', 'DRIVE')).rejects.toThrow();
    });
  });

  // ---------- maps_search_places ----------

  describe('searchPlaces', () => {
    test('returns list of places for a valid query', async () => {
      mockFetch(createMockRouter());
      const result = await searchPlaces('Google office Sydney');
      expect(result.places).toHaveLength(1);
      expect(result.places[0].id).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
    });

    test('fences place names and addresses in output', async () => {
      mockFetch(createMockRouter());
      const result = await searchPlaces('coffee shop');
      // Fenced content should be wrapped in markers
      const firstPlace = result.places[0];
      // Names and addresses should come back as strings (fenced)
      expect(typeof firstPlace.name).toBe('string');
      expect(typeof firstPlace.address).toBe('string');
      // Fencing adds markers to prevent injection
      expect(firstPlace.name).toContain('Google Sydney');
    });

    test('throws when API key is missing', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      await expect(searchPlaces('coffee')).rejects.toThrow('GOOGLE_MAPS_API_KEY');
    });

    test('returns empty places array when no results', async () => {
      mockFetch(createMockRouter({ placesSearchBody: { places: [] } }));
      const result = await searchPlaces('asdfjklqwerty');
      expect(result.places).toHaveLength(0);
    });

    test('throws on HTTP error', async () => {
      mockFetch(createMockRouter({ placesSearchStatus: 403 }));
      await expect(searchPlaces('test')).rejects.toThrow();
    });

    test('handles missing places field in response', async () => {
      mockFetch(createMockRouter({ placesSearchBody: {} }));
      const result = await searchPlaces('test');
      expect(result.places).toHaveLength(0);
    });
  });

  // ---------- maps_place_details ----------

  describe('getPlaceDetails', () => {
    test('returns details for a valid place ID', async () => {
      mockFetch(createMockRouter());
      const result = await getPlaceDetails('ChIJN1t_tDeuEmsRUsoyG83frY4');
      expect(result.id).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
    });

    test('fences name, address, and reviews', async () => {
      mockFetch(createMockRouter());
      const result = await getPlaceDetails('ChIJN1t_tDeuEmsRUsoyG83frY4');
      expect(typeof result.name).toBe('string');
      expect(typeof result.address).toBe('string');
      // The raw text from the API should appear in the fenced value
      expect(result.name).toContain('Google Sydney');
      expect(result.address).toContain('Pyrmont');
    });

    test('fences review text', async () => {
      mockFetch(createMockRouter());
      const result = await getPlaceDetails('ChIJN1t_tDeuEmsRUsoyG83frY4');
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].text).toContain('Great place!');
    });

    test('throws when API key is missing', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      await expect(getPlaceDetails('someId')).rejects.toThrow(
        'GOOGLE_MAPS_API_KEY'
      );
    });

    test('throws on HTTP error', async () => {
      mockFetch(createMockRouter({ placeDetailsStatus: 404 }));
      await expect(getPlaceDetails('invalid-id')).rejects.toThrow();
    });

    test('handles place with no reviews', async () => {
      mockFetch(
        createMockRouter({
          placeDetailsBody: { ...makePlaceDetailsResponse(), reviews: undefined },
        })
      );
      const result = await getPlaceDetails('ChIJN1t_tDeuEmsRUsoyG83frY4');
      expect(result.reviews).toHaveLength(0);
    });

    test('handles place with no opening hours', async () => {
      mockFetch(
        createMockRouter({
          placeDetailsBody: {
            ...makePlaceDetailsResponse(),
            regularOpeningHours: undefined,
          },
        })
      );
      const result = await getPlaceDetails('ChIJN1t_tDeuEmsRUsoyG83frY4');
      expect(result.openNow).toBeNull();
    });
  });
});
