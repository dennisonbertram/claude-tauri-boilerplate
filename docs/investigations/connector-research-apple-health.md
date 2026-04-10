# Connector Research: Apple Health (HealthKit)

**Date:** 2026-03-25
**Issue:** [#384](https://github.com/dennisonbertram/claude-tauri-boilerplate/issues/384)
**Category:** Lifestyle / Health
**Priority:** Medium
**Complexity:** High (no direct macOS HealthKit API; requires XML export parsing or companion app)

---

## 1. Overview

Apple Health is the centralized health data repository on iPhone and Apple Watch, collecting data from built-in sensors, third-party apps, and manual entries. It aggregates steps, heart rate, sleep, workouts, nutrition, body measurements, medications, and more. For this app, an Apple Health connector would let Claude answer questions about a user's health trends, fitness progress, sleep quality, and workout history.

**Critical architectural constraint:** HealthKit is an on-device iOS/watchOS framework with no public server API and no official macOS desktop support. There is no way for a macOS Tauri app to directly query HealthKit. All approaches require either (a) parsing an exported XML file, (b) using a companion iOS app that syncs data to a local endpoint, or (c) Apple Shortcuts automation pipelines.

---

## 2. Access Methods

### Method A: Apple Health XML Export (Recommended for MVP)

Users export their health data from iPhone (Settings > Health > Export All Health Data), producing a ZIP containing `export.xml` and `export_cda.xml`. The XML file can be very large (500MB-2GB+ for multi-year data, 2-3M+ records).

**Pros:**
- Zero dependencies on third-party apps or services
- Complete data -- every record Apple Health has
- Works offline, fully local, privacy-preserving
- Well-understood format with community tooling

**Cons:**
- Manual export step (user must re-export for fresh data)
- Large XML files require streaming parser (SAX/iterparse, not DOM)
- XML schema changes across iOS versions (minor attribute differences)
- No real-time or incremental updates

### Method B: Health Auto Export Companion App

[Health Auto Export](https://apps.apple.com/us/app/health-auto-export-json-csv/id1115567069) ($5.99 iOS app) can push health data to a REST API endpoint, MQTT broker, or file sync (iCloud/Dropbox).

**Pros:**
- Automated, scheduled exports (daily/hourly)
- JSON format (much easier to parse than XML)
- Incremental -- only sends new data each sync
- REST API mode: app POSTs JSON to a configurable URL

**Cons:**
- Requires paid third-party iOS app
- User must configure REST endpoint (our server URL)
- Dependency on third-party app maintenance
- Limited to metrics the app chooses to export

### Method C: Apple Shortcuts Automation

iOS Shortcuts can read specific HealthKit data types and send them to URLs, save to files, or trigger other actions. Can be automated on a schedule.

**Pros:**
- No third-party app needed (built into iOS)
- Can target specific data types
- Automatable on schedule

**Cons:**
- Limited to what Shortcuts exposes (subset of HealthKit)
- Fragile -- Shortcuts automations can break silently
- Complex setup for non-technical users
- No bulk historical export

### Method D: Native HealthKit via Tauri Sidecar (Future)

A Swift sidecar binary could potentially access HealthKit on macOS if/when Apple expands HealthKit to macOS (there are signs of this in Xcode 26.0 beta). The Tauri sidecar pattern allows bundling platform-specific binaries.

**Pros:**
- Direct API access, real-time queries
- No manual export needed
- Best UX

**Cons:**
- HealthKit on macOS is NOT officially supported yet (as of March 2026)
- Tauri plugins for macOS cannot be written in Swift (only Rust); sidecar is required
- Requires macOS app entitlements and user permission grants
- Complex build pipeline (Swift + Rust + Tauri)
- Uncertain timeline for official macOS HealthKit support

---

## 3. Apple Health XML Export Format

### File Structure

```
apple_health_export/
  export.xml          # Main data file (all records, workouts, etc.)
  export_cda.xml      # Clinical Document Architecture data (if any)
  electrocardiograms/ # ECG data as CSV files
  workout-routes/     # GPX files for workout GPS routes
```

### XML Schema (export.xml)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
  <!-- DTD definitions for all element types -->
]>
<HealthData locale="en_US">
  <ExportDate value="2026-03-20 10:30:00 -0400"/>
  <Me
    HKCharacteristicTypeIdentifierDateOfBirth="1990-01-15"
    HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale"
    HKCharacteristicTypeIdentifierBloodType="HKBloodTypeAPositive"
    HKCharacteristicTypeIdentifierFitzpatrickSkinType="HKFitzpatrickSkinTypeII"/>

  <!-- Individual health records -->
  <Record
    type="HKQuantityTypeIdentifierStepCount"
    sourceName="iPhone"
    sourceVersion="17.4"
    device="<<HKDevice: ...>>"
    unit="count"
    creationDate="2026-03-20 08:15:00 -0400"
    startDate="2026-03-20 08:00:00 -0400"
    endDate="2026-03-20 08:15:00 -0400"
    value="342"/>

  <!-- Category records (e.g., sleep) -->
  <Record
    type="HKCategoryTypeIdentifierSleepAnalysis"
    sourceName="Apple Watch"
    value="HKCategoryValueSleepAnalysisAsleepREM"
    startDate="2026-03-20 01:30:00 -0400"
    endDate="2026-03-20 02:15:00 -0400"/>

  <!-- Workouts -->
  <Workout
    workoutActivityType="HKWorkoutActivityTypeRunning"
    duration="30.5"
    durationUnit="min"
    totalDistance="5.2"
    totalDistanceUnit="km"
    totalEnergyBurned="320"
    totalEnergyBurnedUnit="kcal"
    sourceName="Apple Watch"
    startDate="2026-03-20 07:00:00 -0400"
    endDate="2026-03-20 07:30:30 -0400">
    <WorkoutEvent ... />
    <WorkoutRoute sourceName="Apple Watch">
      <FileReference path="/workout-routes/route_2026-03-20_0700.gpx"/>
    </WorkoutRoute>
  </Workout>

  <!-- Correlation records (e.g., blood pressure) -->
  <Correlation type="HKCorrelationTypeIdentifierBloodPressure" ...>
    <Record type="HKQuantityTypeIdentifierBloodPressureSystolic" .../>
    <Record type="HKQuantityTypeIdentifierBloodPressureDiastolic" .../>
  </Correlation>

  <!-- Activity summaries (Apple Watch rings) -->
  <ActivitySummary
    dateComponents="2026-03-20"
    activeEnergyBurned="450"
    activeEnergyBurnedGoal="500"
    appleMoveMinutes="35"
    appleExerciseTime="30"
    appleExerciseTimeGoal="30"
    appleStandHours="10"
    appleStandHoursGoal="12"/>
</HealthData>
```

### Key Record Types

**Quantity Types (most valuable for AI queries):**

| Type Identifier | Unit | Description |
|----------------|------|-------------|
| `HKQuantityTypeIdentifierStepCount` | count | Daily steps |
| `HKQuantityTypeIdentifierHeartRate` | count/min | Heart rate samples |
| `HKQuantityTypeIdentifierRestingHeartRate` | count/min | Resting HR (daily) |
| `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | ms | HRV |
| `HKQuantityTypeIdentifierOxygenSaturation` | % | Blood oxygen (SpO2) |
| `HKQuantityTypeIdentifierBodyMass` | kg/lb | Body weight |
| `HKQuantityTypeIdentifierBodyMassIndex` | count | BMI |
| `HKQuantityTypeIdentifierBodyFatPercentage` | % | Body fat |
| `HKQuantityTypeIdentifierHeight` | cm/in | Height |
| `HKQuantityTypeIdentifierActiveEnergyBurned` | kcal | Active calories |
| `HKQuantityTypeIdentifierBasalEnergyBurned` | kcal | Resting calories |
| `HKQuantityTypeIdentifierDistanceWalkingRunning` | km/mi | Walk/run distance |
| `HKQuantityTypeIdentifierFlightsClimbed` | count | Floors climbed |
| `HKQuantityTypeIdentifierAppleExerciseTime` | min | Exercise minutes |
| `HKQuantityTypeIdentifierDietaryEnergyConsumed` | kcal | Food calories |
| `HKQuantityTypeIdentifierDietaryProtein` | g | Protein intake |
| `HKQuantityTypeIdentifierDietaryCarbohydrates` | g | Carb intake |
| `HKQuantityTypeIdentifierDietaryFatTotal` | g | Fat intake |
| `HKQuantityTypeIdentifierDietaryWater` | mL | Water intake |
| `HKQuantityTypeIdentifierBloodPressureSystolic` | mmHg | Systolic BP |
| `HKQuantityTypeIdentifierBloodPressureDiastolic` | mmHg | Diastolic BP |
| `HKQuantityTypeIdentifierBloodGlucose` | mg/dL | Blood glucose |
| `HKQuantityTypeIdentifierRespiratoryRate` | count/min | Breathing rate |
| `HKQuantityTypeIdentifierVO2Max` | mL/min/kg | Cardio fitness |
| `HKQuantityTypeIdentifierWalkingSpeed` | km/hr | Walking speed |
| `HKQuantityTypeIdentifierWalkingStepLength` | cm | Step length |
| `HKQuantityTypeIdentifierEnvironmentalAudioExposure` | dBASPL | Noise exposure |

**Category Types:**

| Type Identifier | Values | Description |
|----------------|--------|-------------|
| `HKCategoryTypeIdentifierSleepAnalysis` | InBed, AsleepCore, AsleepDeep, AsleepREM, Awake | Sleep stages |
| `HKCategoryTypeIdentifierMindfulSession` | (duration) | Meditation/mindfulness |
| `HKCategoryTypeIdentifierAppleStandHour` | Stood, Idle | Stand ring data |
| `HKCategoryTypeIdentifierHighHeartRateEvent` | (threshold) | HR alerts |
| `HKCategoryTypeIdentifierLowHeartRateEvent` | (threshold) | HR alerts |

---

## 4. Data Value Assessment

### Tier 1 -- High Value (implement first)

These data types are most commonly queried and provide the most actionable insights:

1. **Steps** -- Daily step counts, trends, weekly/monthly averages
2. **Sleep** -- Duration, stages (REM/deep/core), sleep quality trends
3. **Heart Rate** -- Resting HR trends, workout HR, recovery
4. **Workouts** -- Type, duration, calories, distance, frequency
5. **Active Energy** -- Daily calorie burn, exercise minutes
6. **Activity Summaries** -- Apple Watch rings (move/exercise/stand)

### Tier 2 -- Medium Value

7. **Body Measurements** -- Weight trends, BMI, body fat %
8. **Walking Metrics** -- Speed, step length, asymmetry (mobility indicators)
9. **Nutrition** -- Calorie intake, macronutrients, water
10. **VO2 Max** -- Cardiorespiratory fitness trend

### Tier 3 -- Specialized

11. **Blood Pressure** -- Systolic/diastolic trends
12. **Blood Glucose** -- Glucose monitoring (diabetic users)
13. **Respiratory Rate** -- Breathing rate trends
14. **Blood Oxygen** -- SpO2 trends
15. **Medications** -- (new in HealthKit, limited export support)

---

## 5. Recommended Architecture

### Phase 1: XML Export Parser (MVP)

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  User drops   │────>│  XML Stream      │────>│  SQLite DB   │
│  export.zip   │     │  Parser (SAX)    │     │  (bun:sqlite) │
└──────────────┘     └──────────────────┘     └──────────────┘
                                                      │
                                               ┌──────┴──────┐
                                               │  MCP Tools   │
                                               │  (query,     │
                                               │   aggregate, │
                                               │   trends)    │
                                               └─────────────┘
```

**Import Pipeline:**
1. User exports Apple Health data from iPhone (ZIP file)
2. User drops/selects ZIP in the app UI
3. Server extracts `export.xml` from ZIP
4. SAX/streaming XML parser processes records incrementally (avoids loading 500MB+ into memory)
5. Records normalized and stored in SQLite tables (using existing `bun:sqlite`)
6. Import is incremental -- detect already-imported records by (type, sourceName, startDate, endDate) composite key

**SQLite Schema:**

```sql
-- Core health records
CREATE TABLE health_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- e.g. 'HKQuantityTypeIdentifierStepCount'
  source_name TEXT,             -- e.g. 'Apple Watch', 'iPhone'
  source_version TEXT,
  unit TEXT,                    -- e.g. 'count', 'count/min', 'kcal'
  value REAL,                   -- numeric value
  value_text TEXT,              -- for category types (e.g. sleep stage)
  creation_date TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  device TEXT,
  imported_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_records_type_date ON health_records(type, start_date);
CREATE INDEX idx_records_date ON health_records(start_date);

-- Workouts
CREATE TABLE health_workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_type TEXT NOT NULL,  -- e.g. 'HKWorkoutActivityTypeRunning'
  duration REAL,                -- minutes
  total_distance REAL,          -- km
  total_energy_burned REAL,     -- kcal
  source_name TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  imported_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_workouts_type_date ON health_workouts(activity_type, start_date);

-- Activity summaries (Apple Watch rings)
CREATE TABLE health_activity_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_components TEXT NOT NULL UNIQUE, -- e.g. '2026-03-20'
  active_energy_burned REAL,
  active_energy_burned_goal REAL,
  exercise_time REAL,
  exercise_time_goal REAL,
  stand_hours REAL,
  stand_hours_goal REAL,
  imported_at TEXT DEFAULT (datetime('now'))
);

-- Import metadata
CREATE TABLE health_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT,
  export_date TEXT,
  record_count INTEGER,
  imported_at TEXT DEFAULT (datetime('now')),
  duration_ms INTEGER
);
```

### Phase 2: Health Auto Export REST Receiver (Future)

Add an API endpoint (`POST /api/health/ingest`) that receives JSON payloads from the Health Auto Export iOS app, enabling automated near-real-time sync without manual exports.

### Phase 3: Native HealthKit Sidecar (Future, if macOS HealthKit ships)

Swift sidecar binary for direct HealthKit queries, bundled via Tauri's sidecar configuration.

---

## 6. MCP Tool Definitions

```typescript
const healthTools: ConnectorToolDefinition[] = [
  {
    name: 'health_import_status',
    description: 'Check the status of Apple Health data imports -- when data was last imported, record counts by type, date range coverage.',
    // No params needed
  },
  {
    name: 'health_daily_summary',
    description: 'Get a daily health summary for a specific date or date range. Includes steps, active calories, exercise minutes, sleep duration, resting heart rate, and activity ring completion.',
    // Params: { date?: string, startDate?: string, endDate?: string }
  },
  {
    name: 'health_query_records',
    description: 'Query health records by type with optional date range, aggregation (sum, avg, min, max), and grouping (day, week, month). For example: average heart rate per day this week, total steps per month in 2025, max weight in last 90 days.',
    // Params: { type: string, startDate?: string, endDate?: string, aggregation?: string, groupBy?: string, limit?: number }
  },
  {
    name: 'health_workouts',
    description: 'Query workout history with optional filters by activity type and date range. Returns workout type, duration, distance, calories, and frequency statistics.',
    // Params: { activityType?: string, startDate?: string, endDate?: string, limit?: number }
  },
  {
    name: 'health_sleep_analysis',
    description: 'Analyze sleep patterns over a date range. Returns sleep duration, time in each stage (REM, deep, core), sleep/wake times, and trends.',
    // Params: { startDate?: string, endDate?: string, groupBy?: string }
  },
  {
    name: 'health_trends',
    description: 'Calculate trends and comparisons for a health metric. Compare this week vs last week, this month vs last month, or show long-term trends with moving averages.',
    // Params: { type: string, period: 'week' | 'month' | 'quarter' | 'year', compareWith?: 'previous' }
  },
];
```

---

## 7. Privacy and Security Requirements

HealthKit has the strictest privacy requirements of any Apple framework. Our implementation must honor these principles:

1. **Local-only processing**: Health data never leaves the device. No cloud sync, no telemetry, no analytics. Data stays in the local SQLite database (`~/.claude-tauri/data.db`).

2. **Encryption at rest**: SQLite database should use encryption for health tables (or the entire DB). Consider using SQLCipher or Bun's built-in encryption if available.

3. **No LLM data leakage**: Health records must NEVER be sent as raw data in LLM prompts. MCP tools should return aggregated summaries and statistics, not individual records. For example, return "average heart rate this week: 68 bpm" not 10,000 individual HR samples.

4. **User consent**: Clear UI indicating what data is being imported and how it will be used. Import must be an explicit user action (drag-and-drop or file picker), never automatic.

5. **Data deletion**: Users must be able to delete all imported health data with a single action. Include a `health_delete_all_data` tool or settings option.

6. **No sharing**: Health data must not be accessible to other connectors or shared across any boundary.

7. **App Store compliance (future)**: If ever distributed via App Store, must comply with Apple's Health data usage guidelines -- requires a privacy policy explaining health data handling.

---

## 8. Parsing Best Practices

### Streaming XML Parser

The export XML can exceed 1GB. A DOM parser would consume 4-10x that in memory. Use a SAX/streaming approach:

```typescript
// Use a streaming XML parser (e.g., sax-js, fast-xml-parser with stream mode)
// Process records one at a time, insert in batches

import { createReadStream } from 'fs';
import sax from 'sax';

async function parseHealthExport(xmlPath: string, db: Database) {
  const parser = sax.createStream(true, { trim: true });
  const BATCH_SIZE = 1000;
  let batch: HealthRecord[] = [];

  parser.on('opentag', (node) => {
    if (node.name === 'Record') {
      batch.push(normalizeRecord(node.attributes));
      if (batch.length >= BATCH_SIZE) {
        insertBatch(db, batch);
        batch = [];
      }
    } else if (node.name === 'Workout') {
      // Handle workout elements
    } else if (node.name === 'ActivitySummary') {
      // Handle activity summaries
    }
  });

  parser.on('end', () => {
    if (batch.length > 0) insertBatch(db, batch);
  });

  createReadStream(xmlPath).pipe(parser);
}
```

### Deduplication

On re-import, use an upsert strategy based on composite key `(type, source_name, start_date, end_date, value)` to avoid duplicates while allowing updated records.

### Date Handling

All dates in the export are in the format `"2026-03-20 08:15:00 -0400"` (with timezone offset). Normalize to ISO 8601 / UTC for consistent querying.

### Progress Reporting

For large exports (2M+ records), report import progress to the frontend via WebSocket or SSE so the user sees a progress bar rather than a frozen UI.

---

## 9. Existing MCP Server Implementations

### the-momentum/apple-health-mcp-server

- **URL:** https://github.com/the-momentum/apple-health-mcp-server
- **Architecture:** FastMCP framework + DuckDB (or Elasticsearch/ClickHouse)
- **Approach:** Parses Apple Health XML exports, indexes into DuckDB, exposes via MCP tools
- **Scale:** Tested with 2.8M records spanning 8 years
- **Status:** Active, evolved into "Open Wearables" platform (Jan 2026) supporting Garmin, Polar, Whoop, Suunto alongside Apple Health
- **Relevance:** Good reference for XML parsing and query patterns, but uses Python/FastMCP (not TypeScript/Node)

### neiltron/apple-health-mcp

- **URL:** https://github.com/neiltron/apple-health-mcp
- **Architecture:** DuckDB-based, supports natural language SQL queries
- **Approach:** Indexes Apple Health XML into DuckDB, supports records, workouts, ECG, GPS routes
- **Released:** February 2026
- **Relevance:** Closer to our needs; demonstrates DuckDB query patterns. However, we should use SQLite (already in our stack via bun:sqlite) rather than adding DuckDB as a dependency.

### Key Learnings from Existing Implementations

1. **DuckDB is popular** for health data analytics (columnar, fast aggregation), but SQLite is adequate for our use case and avoids a new dependency
2. **XML parsing is the bottleneck** -- both implementations spend most complexity on reliable XML streaming
3. **Schema normalization matters** -- Apple changes XML attributes across iOS versions; normalize early
4. **Natural language to SQL** is a common pattern -- but our MCP tools provide structured queries, so Claude handles the NL->tool-call mapping natively

---

## 10. Testing Strategy

### Mock Health Data

Create fixture XML files with representative data:

```
apps/server/src/connectors/apple-health/__tests__/
  fixtures/
    minimal-export.xml        # 10-20 records, all types
    sleep-records.xml         # Sleep analysis records only
    workout-records.xml       # Workout records with routes
    large-export.xml          # 10K records for perf testing
    malformed-export.xml      # Edge cases, missing fields
    ios16-export.xml          # Older iOS format variations
    ios18-export.xml          # Newer iOS format
```

### Unit Tests

- **XML Parser:** Parse each fixture, verify record counts and field extraction
- **Date Normalization:** Test timezone offset handling, various date formats
- **Deduplication:** Import same file twice, verify no duplicates
- **Aggregation Queries:** Verify daily summaries, weekly averages, trends
- **Sleep Analysis:** Verify sleep stage duration calculation from overlapping records
- **Edge Cases:** Empty export, export with only workouts, export with unknown record types

### Integration Tests

- **Import Pipeline:** ZIP extraction -> XML parse -> SQLite insert -> query
- **MCP Tools:** Call each tool with various parameters, verify response format
- **Large File Handling:** Verify streaming parser handles 100K+ records without OOM
- **Progress Reporting:** Verify progress events during import

### Fixture Generation Script

```typescript
// Generate test XML fixtures with realistic data patterns
function generateHealthExport(options: {
  days: number;
  recordTypes: string[];
  includeWorkouts: boolean;
  includeSleep: boolean;
}): string {
  // Generate realistic step counts (3000-15000/day)
  // Generate heart rate samples (55-180 bpm)
  // Generate sleep records with proper stage transitions
  // Generate workout records with appropriate metrics
}
```

---

## Summary

**Recommended approach:** XML Export Parser (Phase 1) is the only viable MVP path for a macOS Tauri app. HealthKit has no macOS API, no server API, and no web API. All existing MCP implementations (Momentum, neiltron) use the XML export approach.

**Key architectural decisions:**
- **SAX/streaming XML parser** to handle 500MB-2GB export files without OOM
- **SQLite storage** (existing bun:sqlite) rather than adding DuckDB dependency
- **Aggregated responses only** -- MCP tools return summaries/stats, never raw records to the LLM
- **Fully local** -- health data never leaves the device, complying with Apple's privacy expectations
- **Incremental import** with deduplication so users can re-import updated exports

**Implementation estimate:** ~3-4 days for core (XML parser + SQLite schema + 6 MCP tools + tests), ~1 day for UI (import flow, progress bar, data management).

**Risks:**
- Large XML parsing performance (mitigated by streaming + batch inserts)
- iOS version XML format drift (mitigated by defensive parsing, tested with multiple fixtures)
- User friction of manual export (mitigated in Phase 2 with Health Auto Export companion app)
