# HomeKit / Home Assistant Connector Research

**Issue**: #386
**Date**: 2026-03-25
**Status**: Research complete

---

## 1. Executive Summary

Home Assistant has first-class MCP support (built into HA Core since 2025.2) and a mature REST/WebSocket API with an official JavaScript client library. HomeKit integration is best achieved indirectly through Home Assistant's HomeKit Controller integration rather than raw HAP protocol access. The recommended architecture is a single `home-assistant` connector using the `home-assistant-js-websocket` library over WebSocket, with tiered safety controls for physical device actuation. Multiple community MCP servers already exist and validate this approach.

---

## 2. Existing MCP Server Implementations

### Official: Home Assistant Core MCP Server (2025.2+)
- **URL**: https://www.home-assistant.io/integrations/mcp_server/
- Built into HA Core, exposed at `/api/mcp`
- Uses Streamable HTTP protocol (stateless)
- Supports OAuth and long-lived access tokens
- Exposes the Assist API -- user controls which entities are accessible via the "Exposed Entities" page
- **Limitation**: Requires HA instance to run the MCP server; our app is the MCP server, not the client

### allenporter/mcp-server-home-assistant
- **URL**: https://github.com/allenporter/mcp-server-home-assistant
- Python-based, uses WebSocket connection
- Now archived -- migrated into HA Core (see above)
- Key insight: WebSocket was chosen over REST for real-time state subscriptions

### tevonsb/homeassistant-mcp (Community, 60+ tools)
- **URL**: https://github.com/tevonsb/homeassistant-mcp
- Node.js/TypeScript, 95%+ test coverage
- **Tools exposed**: Device control (turn_on/off/toggle), automation management (create/duplicate/trigger/enable/disable), add-on management, HACS package management, SSE real-time updates
- **Domains**: lights, switches, climate, covers, fans, media players, locks, vacuums, cameras
- Uses both REST API and WebSocket
- Best reference for our connector implementation

### homeassistant-ai/ha-mcp (Unofficial)
- **URL**: https://github.com/homeassistant-ai/ha-mcp
- Another community implementation with similar tool coverage

**Key takeaway**: The pattern is well-validated. We do NOT need to implement MCP client-side -- we implement tools in our ConnectorDefinition that call the HA API directly.

---

## 3. Home Assistant API Architecture

### REST API
- Base URL: `http://<ha-host>:8123/api/`
- Auth: `Authorization: Bearer <TOKEN>` header on every request
- JSON request/response format
- Key endpoints:
  - `GET /api/states` -- all entity states
  - `GET /api/states/<entity_id>` -- single entity state
  - `POST /api/services/<domain>/<service>` -- call a service (e.g., `light/turn_on`)
  - `GET /api/config` -- HA configuration
  - `GET /api/events` -- event list
  - `POST /api/template` -- render Jinja2 templates
- **Best for**: One-off reads, service calls, simple integrations

### WebSocket API
- URL: `ws://<ha-host>:8123/api/websocket`
- Auth flow: server sends `auth_required` -> client sends `{ type: "auth", access_token: "..." }` -> server responds `auth_ok`
- All messages have `type` key; post-auth messages require integer `id` for correlation
- Key message types:
  ```json
  // Subscribe to state changes
  { "id": 18, "type": "subscribe_events", "event_type": "state_changed" }

  // Call a service
  { "id": 24, "type": "call_service", "domain": "light", "service": "turn_on",
    "service_data": { "brightness": 255 }, "target": { "entity_id": "light.kitchen" } }

  // Get all states
  { "id": 19, "type": "get_states" }
  ```
- **Best for**: Real-time state monitoring, event subscriptions, persistent connections

### Recommendation: WebSocket via `home-assistant-js-websocket`
- **Package**: `home-assistant-js-websocket` (zero dependencies, official HA library)
- **URL**: https://github.com/home-assistant/home-assistant-js-websocket
- Key features:
  - `createConnection({ auth })` -- establishes authenticated connection
  - `subscribeEntities(conn, callback)` -- real-time entity state updates
  - `subscribeServices(conn, callback)` -- available service discovery
  - `subscribeConfig(conn, callback)` -- HA config monitoring
  - `getCollection()` -- custom data collections with auto-sync
  - Automatic reconnection with subscription state preservation
  - OAuth2 and long-lived token support
- This library handles reconnection, message correlation, and subscription management -- no need to implement raw WebSocket protocol

---

## 4. HomeKit Integration Strategy

### Direct HomeKit Access (NOT recommended for v1)

**HAP-NodeJS** (`@homebridge/hap-nodejs`):
- Implements HomeKit Accessory Protocol for creating accessories/bridges
- We would need it to *publish* accessories, not control them
- 99.8% TypeScript, mature library

**hap-controller-node** (https://github.com/Apollon77/hap-controller-node):
- Implements HomeKit *controller* side (discover + control accessories)
- Supports IP and BLE protocols
- API: `IPDiscovery`, `BLEDiscovery`, `getAccessories()`, `getCharacteristics()`, `setCharacteristics()`, `subscribeCharacteristics()`
- Requires 8-digit pairing code exchange
- **Problem**: Pairing is complex, no persistence story, limited device support vs. HA

### Recommended: HomeKit via Home Assistant
- Home Assistant's [HomeKit Controller integration](https://www.home-assistant.io/integrations/homekit_controller/) discovers and pairs with HomeKit devices
- Exposes them as standard HA entities (e.g., `light.kitchen`, `lock.front_door`)
- Our connector treats them identically to any other HA entity -- no special HomeKit code
- Users who want HomeKit devices simply add them to HA first

### Future: Native HomeKit (v2+)
- If users want HomeKit control without HA, use `hap-controller-node`
- Would require a separate `homekit` connector with pairing UI
- Significantly more complex (BLE, pairing codes, characteristic mapping)

---

## 5. Entity Discovery and Device Categorization

### HA Entity ID Convention
Entity IDs follow `<domain>.<object_id>` format:
- `light.living_room` -- Light domain
- `switch.coffee_maker` -- Switch domain
- `climate.thermostat` -- Climate/HVAC
- `lock.front_door` -- Lock
- `cover.garage_door` -- Cover (garage doors, blinds)
- `media_player.tv` -- Media player
- `sensor.temperature` -- Sensor (read-only)
- `binary_sensor.motion` -- Binary sensor (on/off)
- `camera.front_porch` -- Camera
- `fan.bedroom` -- Fan
- `vacuum.roomba` -- Vacuum

### Entity Attributes
Each entity has:
- `state` -- current value ("on", "off", "23.5", "locked", etc.)
- `attributes` -- domain-specific metadata (brightness, color_temp, temperature, etc.)
- `last_changed` -- timestamp of last state change
- `last_updated` -- timestamp of last attribute update

### Categorization for Our Connector
```typescript
type DeviceCategory =
  | 'lighting'      // light.*
  | 'climate'       // climate.*, fan.*
  | 'security'      // lock.*, alarm_control_panel.*, camera.*
  | 'covers'        // cover.* (garage doors, blinds, shades)
  | 'media'         // media_player.*
  | 'sensors'       // sensor.*, binary_sensor.*
  | 'switches'      // switch.*, input_boolean.*
  | 'automation'    // automation.*, scene.*, script.*
  | 'other';        // everything else
```

### Discovery Tool Design
A `ha_list_entities` tool should return entities grouped by area/room when available (HA supports area assignments). Include friendly names, current states, and supported features.

---

## 6. Safety and Security: AI Controlling Physical Devices

### Risk Tiers

| Tier | Risk Level | Domains | Policy |
|------|-----------|---------|--------|
| 1 | **Safe** (read-only) | sensor, binary_sensor, weather, sun | Always allowed, no confirmation |
| 2 | **Low risk** (reversible) | light, switch, fan, media_player, scene | Allowed by default, logged |
| 3 | **Medium risk** (physical) | climate, cover (blinds), vacuum, input_boolean | Allowed with confirmation prompt |
| 4 | **High risk** (security) | lock, cover (garage), alarm_control_panel | **Requires explicit user approval per action** |
| 5 | **Dangerous** (destructive) | automation (create/delete), script (create/delete) | Admin-only, always requires approval |

### Approval Workflow Implementation

```typescript
// Tool annotation pattern for safety tiers
const lockControlTool = tool(
  'ha_lock_control',
  'Lock or unlock a door. REQUIRES USER APPROVAL.',
  { entity_id: z.string(), action: z.enum(['lock', 'unlock']) },
  async (args) => {
    // The SDK's destructiveHint annotation triggers Claude to ask for confirmation
    // before executing. The tool itself validates the entity domain.
    if (!args.entity_id.startsWith('lock.')) {
      return { content: [{ type: 'text', text: 'Invalid entity for lock control' }], isError: true };
    }
    await haClient.callService('lock', args.action, { entity_id: args.entity_id });
    return { content: [{ type: 'text', text: `${args.action}ed ${args.entity_id}` }] };
  },
  {
    annotations: {
      title: 'Lock Control',
      destructiveHint: true,    // <-- SDK will require confirmation
      readOnlyHint: false,
      openWorldHint: true,
    },
  }
);
```

### Safety Guards
1. **Entity allowlist/blocklist**: Users configure which entities the AI can access (similar to HA's "Exposed Entities" page)
2. **Domain restrictions**: By default, exclude `lock`, `alarm_control_panel`, `cover` (garage) from AI control
3. **Rate limiting**: Max N service calls per minute to prevent runaway loops
4. **Audit logging**: Every service call logged with timestamp, entity, action, and whether user-approved
5. **Dry-run mode**: Tool returns "would do X" instead of actually executing -- useful for testing
6. **Time-of-day guards**: Optional rules like "no lock/unlock between midnight and 6am"
7. **State validation**: Before toggling, check current state to avoid redundant operations

### SDK Annotation Strategy
- `readOnlyHint: true` for all sensor/state query tools
- `destructiveHint: true` for lock, garage, alarm tools (triggers Claude's built-in confirmation)
- `idempotentHint: true` for toggle operations where repeated calls are safe
- `openWorldHint: true` for all tools (they hit external HA instance)

---

## 7. Authentication

### Home Assistant Long-Lived Access Tokens
- Created from user profile page in HA UI: Profile > Long-Lived Access Tokens > Create Token
- Valid for 10 years
- Format: JWT-like string
- Usage: `Authorization: Bearer <token>` header
- Can also be created programmatically via WebSocket: `auth/long_lived_access_token`
- **Storage**: In our app's encrypted settings (stored in SQLite via the existing settings system)

### OAuth 2 (Advanced)
- HA supports OAuth2 with IndieAuth extension
- No pre-registered client ID needed -- uses the app's URL as client ID
- Flow: redirect user to HA login -> callback with auth code -> exchange for tokens
- Better UX for non-technical users but more complex to implement
- HA's MCP server integration now supports OAuth natively

### Recommended Auth Flow (v1)
1. User enters HA instance URL (e.g., `http://homeassistant.local:8123`)
2. User creates a long-lived access token in HA UI
3. User pastes token into our app's connector settings
4. We validate with `GET /api/config` using the token
5. Store encrypted in app settings

### Future: OAuth Flow (v2)
1. User enters HA URL
2. App opens HA login page in system browser
3. User authenticates, HA redirects back with auth code
4. App exchanges code for access + refresh tokens
5. Auto-refresh on expiry

### HomeKit Pairing (if implementing native HomeKit later)
- 8-digit setup code from device/packaging
- SRP (Secure Remote Password) protocol for initial pairing
- Ed25519 key pairs for long-term identity
- Pairing data must be persisted (loss = re-pair required)

---

## 8. Proposed Connector Architecture

### File Structure
```
apps/server/src/connectors/home-assistant/
  index.ts          -- ConnectorDefinition export
  tools.ts          -- Tool definitions (ha_list_entities, ha_control_device, etc.)
  client.ts         -- HA WebSocket client wrapper
  types.ts          -- HA-specific types (entity state, service call, etc.)
  safety.ts         -- Risk tier classification, approval logic
  __tests__/
    tools.test.ts
    client.test.ts
    safety.test.ts
```

### ConnectorDefinition
```typescript
export const homeAssistantConnector: ConnectorDefinition = {
  name: 'home-assistant',
  displayName: 'Home Assistant',
  description: 'Control smart home devices, check sensor states, and manage automations via Home Assistant.',
  icon: '🏠',
  category: 'lifestyle',
  requiresAuth: true,
  tools: homeAssistantTools,
};
```

### Tool Set (Recommended)

| Tool Name | Description | Safety Tier | Annotation |
|-----------|-------------|-------------|------------|
| `ha_list_entities` | List all entities, optionally filtered by domain/area | 1 (read-only) | readOnlyHint |
| `ha_get_state` | Get current state + attributes of a specific entity | 1 (read-only) | readOnlyHint |
| `ha_control_light` | Turn on/off, set brightness/color for lights | 2 (low risk) | idempotentHint |
| `ha_control_switch` | Turn on/off switches | 2 (low risk) | idempotentHint |
| `ha_control_climate` | Set temperature, mode for HVAC | 3 (medium) | -- |
| `ha_control_media` | Play/pause/volume for media players | 2 (low risk) | -- |
| `ha_control_cover` | Open/close/stop covers (blinds, garage) | 4 (high risk) | destructiveHint |
| `ha_control_lock` | Lock/unlock doors | 4 (high risk) | destructiveHint |
| `ha_trigger_automation` | Trigger an existing automation | 3 (medium) | -- |
| `ha_trigger_scene` | Activate a scene | 2 (low risk) | -- |
| `ha_call_service` | Generic service call (advanced users) | 5 (dangerous) | destructiveHint |

### Client Wrapper Design
```typescript
// client.ts -- singleton WebSocket connection per HA instance
import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  type HassEntities,
  type Connection,
} from 'home-assistant-js-websocket';

class HomeAssistantClient {
  private connection: Connection | null = null;
  private entities: HassEntities = {};

  async connect(url: string, token: string): Promise<void> {
    const auth = createLongLivedTokenAuth(url, token);
    this.connection = await createConnection({ auth });
    subscribeEntities(this.connection, (entities) => {
      this.entities = entities; // always up-to-date via WebSocket
    });
  }

  getEntities(domain?: string): HassEntity[] {
    const all = Object.values(this.entities);
    return domain ? all.filter(e => e.entity_id.startsWith(`${domain}.`)) : all;
  }

  async callService(domain: string, service: string, data: Record<string, any>): Promise<void> {
    if (!this.connection) throw new Error('Not connected to Home Assistant');
    await this.connection.sendMessagePromise({
      type: 'call_service', domain, service,
      service_data: data.service_data,
      target: data.target,
    });
  }

  disconnect(): void {
    this.connection?.close();
    this.connection = null;
    this.entities = {};
  }
}
```

### ConnectorCategory Extension
The current `ConnectorCategory` type needs a new value or we reuse `'lifestyle'`. Recommend adding `'smart-home'` or `'iot'` as a new category:
```typescript
export type ConnectorCategory =
  | 'communication'
  | 'productivity'
  | 'finance'
  | 'lifestyle'
  | 'developer'
  | 'smart-home';  // new
```

---

## 9. Testing Strategy

### Unit Tests (mock HA responses)
```typescript
// Mock the WebSocket client
const mockClient = {
  getEntities: vi.fn().mockReturnValue([
    { entity_id: 'light.kitchen', state: 'on', attributes: { brightness: 200 } },
    { entity_id: 'lock.front_door', state: 'locked', attributes: {} },
  ]),
  callService: vi.fn().mockResolvedValue(undefined),
};

// Test entity listing
test('ha_list_entities returns entities grouped by domain', async () => {
  const result = await listEntitiesTool.execute({ domain: 'light' });
  expect(result.content[0].text).toContain('light.kitchen');
  expect(mockClient.getEntities).toHaveBeenCalledWith('light');
});

// Test safety tier enforcement
test('lock control requires destructive hint', () => {
  const lockTool = homeAssistantTools.find(t => t.name === 'ha_control_lock');
  expect(lockTool.sdkTool.annotations.destructiveHint).toBe(true);
});
```

### Integration Tests (real or Docker HA instance)
- **Docker**: `docker run -d --name ha-test -p 8123:8123 homeassistant/home-assistant:stable`
- **Demo integration**: HA's built-in `demo` integration provides ~80 fake entities across all domains
  - Enable by adding `demo:` to `configuration.yaml`
  - Provides lights, climate, covers, locks, sensors, media players, etc.
  - All fully functional for testing service calls
- **Long-lived token**: Create programmatically via onboarding flow or WebSocket API

### Mock Entity States for Tests
```typescript
const MOCK_ENTITIES: Record<string, any> = {
  'light.living_room': { state: 'on', attributes: { brightness: 180, color_temp: 370, friendly_name: 'Living Room Light' } },
  'lock.front_door': { state: 'locked', attributes: { friendly_name: 'Front Door Lock' } },
  'climate.thermostat': { state: 'heat', attributes: { temperature: 72, current_temperature: 68, hvac_modes: ['heat', 'cool', 'auto', 'off'] } },
  'cover.garage': { state: 'closed', attributes: { device_class: 'garage', friendly_name: 'Garage Door' } },
  'sensor.outdoor_temp': { state: '55.2', attributes: { unit_of_measurement: '°F', device_class: 'temperature' } },
  'binary_sensor.front_motion': { state: 'off', attributes: { device_class: 'motion' } },
};
```

### Test Matrix
- [ ] Connection success with valid token
- [ ] Connection failure with invalid token
- [ ] Entity listing (all, by domain, by area)
- [ ] State retrieval for each entity type
- [ ] Light control (on/off/brightness/color)
- [ ] Lock control (requires destructive confirmation)
- [ ] Climate control (set temp, set mode)
- [ ] Service call validation (domain check, entity exists)
- [ ] Safety tier classification for all domains
- [ ] Rate limiting enforcement
- [ ] Reconnection after disconnect
- [ ] Graceful handling of HA instance being unreachable

---

## 10. Implementation Roadmap

### Phase 1: Core (MVP)
1. Add `home-assistant-js-websocket` dependency
2. Implement `HomeAssistantClient` wrapper (connect, disconnect, getEntities, callService)
3. Create read-only tools: `ha_list_entities`, `ha_get_state`
4. Create light/switch control tools: `ha_control_light`, `ha_control_switch`
5. Register as ConnectorDefinition, add to registry
6. Settings UI: HA URL + access token input with validation
7. Unit tests with mocked client

### Phase 2: Full Device Control
1. Add climate, media, cover, fan, vacuum tools
2. Implement safety tier system with `destructiveHint` annotations
3. Add lock and alarm control with mandatory approval
4. Add `ha_trigger_scene` and `ha_trigger_automation`
5. Audit logging for all service calls
6. Integration tests with Docker HA instance

### Phase 3: Advanced Features
1. Entity allowlist/blocklist configuration UI
2. Real-time state push to frontend (SSE from our server)
3. Automation creation/editing tools
4. OAuth flow (alternative to long-lived tokens)
5. Area/floor-based entity grouping
6. Time-of-day safety guards

### Phase 4: Native HomeKit (Optional)
1. Evaluate `hap-controller-node` for direct HomeKit control
2. Implement discovery and pairing UI
3. Characteristic mapping to tool parameters
4. Separate `homekit` connector definition

### Dependencies to Add
- `home-assistant-js-websocket` -- official HA WebSocket client (zero deps, ~15KB)
- No other runtime dependencies needed for v1

### Estimated Effort
- Phase 1: 2-3 days
- Phase 2: 3-4 days
- Phase 3: 3-4 days
- Phase 4: 5+ days (if pursued)

---

## Sources

- [Home Assistant MCP Server Integration](https://www.home-assistant.io/integrations/mcp_server/)
- [Home Assistant MCP Client Integration](https://www.home-assistant.io/integrations/mcp/)
- [tevonsb/homeassistant-mcp (60+ tools)](https://github.com/tevonsb/homeassistant-mcp)
- [allenporter/mcp-server-home-assistant](https://github.com/allenporter/mcp-server-home-assistant)
- [homeassistant-ai/ha-mcp](https://github.com/homeassistant-ai/ha-mcp)
- [HA WebSocket API Docs](https://developers.home-assistant.io/docs/api/websocket/)
- [HA REST API Docs](https://github.com/home-assistant/developers.home-assistant/blob/master/docs/api/rest.md)
- [home-assistant-js-websocket](https://github.com/home-assistant/home-assistant-js-websocket)
- [HA Authentication API](https://developers.home-assistant.io/docs/auth_api/)
- [HAP-NodeJS](https://github.com/homebridge/HAP-NodeJS)
- [hap-controller-node](https://github.com/Apollon77/hap-controller-node)
- [HA Demo Integration](https://www.home-assistant.io/integrations/demo/)
- [HA Developer Testing Docs](https://developers.home-assistant.io/docs/development_testing/)
