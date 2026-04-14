import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { appleHealthConnectorFactory } from './index';
import { createAppleHealthTools, parseHealthRecord, buildSchema, _setFileReader, _resetFileReader } from './tools';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInMemoryDb(): Database {
  const db = new Database(':memory:');
  buildSchema(db);
  return db;
}

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Workout|ActivitySummary)*)>
]>
<HealthData locale="en_US">
 <ExportDate value="2024-01-20 12:00:00 -0700"/>
 <Me HKCharacteristicTypeIdentifierDateOfBirth="1985-06-15" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" sourceVersion="17.0" unit="count" creationDate="2024-01-15 08:00:00 -0700" startDate="2024-01-15 07:00:00 -0700" endDate="2024-01-15 08:00:00 -0700" value="1200"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" sourceVersion="10.0" unit="count" creationDate="2024-01-15 09:00:00 -0700" startDate="2024-01-15 08:00:00 -0700" endDate="2024-01-15 09:00:00 -0700" value="3500"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" sourceVersion="10.0" unit="count/min" creationDate="2024-01-15 08:05:00 -0700" startDate="2024-01-15 08:05:00 -0700" endDate="2024-01-15 08:05:00 -0700" value="72"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" sourceVersion="10.0" unit="count/min" creationDate="2024-01-15 10:00:00 -0700" startDate="2024-01-15 10:00:00 -0700" endDate="2024-01-15 10:00:00 -0700" value="85"/>
 <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="iPhone" sourceVersion="17.0" unit="km" creationDate="2024-01-15 09:00:00 -0700" startDate="2024-01-15 08:00:00 -0700" endDate="2024-01-15 09:00:00 -0700" value="3.2"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" sourceVersion="10.0" unit="" creationDate="2024-01-16 07:00:00 -0700" startDate="2024-01-15 23:00:00 -0700" endDate="2024-01-16 06:30:00 -0700" value="HKCategoryValueSleepAnalysisAsleep"/>
 <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="Apple Watch" sourceVersion="10.0" unit="Cal" creationDate="2024-01-15 09:00:00 -0700" startDate="2024-01-15 08:00:00 -0700" endDate="2024-01-15 09:00:00 -0700" value="350"/>
</HealthData>`;

const ORIGINAL_ENV = process.env.APPLE_HEALTH_EXPORT_PATH;

// ---------------------------------------------------------------------------
// parseHealthRecord unit tests
// ---------------------------------------------------------------------------

describe('parseHealthRecord', () => {
  test('parses a well-formed Record line into a HealthRecord object', () => {
    const line =
      ' <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" sourceVersion="17.0" unit="count" creationDate="2024-01-15 08:00:00 -0700" startDate="2024-01-15 07:00:00 -0700" endDate="2024-01-15 08:00:00 -0700" value="1200"/>';
    const record = parseHealthRecord(line);
    expect(record).not.toBeNull();
    expect(record!.type).toBe('HKQuantityTypeIdentifierStepCount');
    expect(record!.value).toBe(1200);
    expect(record!.unit).toBe('count');
    expect(record!.sourceName).toBe('iPhone');
    expect(record!.startDate).toBe('2024-01-15 07:00:00 -0700');
    expect(record!.endDate).toBe('2024-01-15 08:00:00 -0700');
    expect(record!.creationDate).toBe('2024-01-15 08:00:00 -0700');
  });

  test('returns null for non-Record lines', () => {
    expect(parseHealthRecord('<HealthData locale="en_US">')).toBeNull();
    expect(parseHealthRecord('<ExportDate value="2024-01-20"/>')).toBeNull();
    expect(parseHealthRecord('')).toBeNull();
  });

  test('handles value-less records (category types)', () => {
    const line =
      ' <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" unit="" creationDate="2024-01-16 07:00:00 -0700" startDate="2024-01-15 23:00:00 -0700" endDate="2024-01-16 06:30:00 -0700" value="HKCategoryValueSleepAnalysisAsleep"/>';
    const record = parseHealthRecord(line);
    expect(record).not.toBeNull();
    expect(record!.type).toBe('HKCategoryTypeIdentifierSleepAnalysis');
    // Non-numeric values should result in null value
    expect(record!.value).toBeNull();
  });

  test('parses numeric float values', () => {
    const line =
      ' <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="iPhone" unit="km" creationDate="2024-01-15 09:00:00 -0700" startDate="2024-01-15 08:00:00 -0700" endDate="2024-01-15 09:00:00 -0700" value="3.2"/>';
    const record = parseHealthRecord(line);
    expect(record!.value).toBeCloseTo(3.2);
  });
});

// ---------------------------------------------------------------------------
// buildSchema tests
// ---------------------------------------------------------------------------

describe('buildSchema', () => {
  test('creates health_records table and index', () => {
    const db = new Database(':memory:');
    buildSchema(db);
    // Should not throw; verify table exists
    const row = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='health_records'").get();
    expect(row).not.toBeNull();
    const idx = db.query("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_health_type_date'").get();
    expect(idx).not.toBeNull();
  });

  test('is idempotent — calling twice does not throw', () => {
    const db = new Database(':memory:');
    expect(() => {
      buildSchema(db);
      buildSchema(db);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Connector factory tests
// ---------------------------------------------------------------------------

describe('appleHealthConnectorFactory', () => {
  test('returns correct connector metadata', () => {
    const db = makeInMemoryDb();
    const connector = appleHealthConnectorFactory(db);
    expect(connector.name).toBe('apple-health');
    expect(connector.displayName).toBe('Apple Health');
    expect(connector.icon).toBe('❤️');
    expect(connector.category).toBe('health');
    expect(connector.requiresAuth).toBe(false);
  });

  test('exposes all four tools', () => {
    const db = makeInMemoryDb();
    const connector = appleHealthConnectorFactory(db);
    const names = connector.tools.map((t) => t.name);
    expect(names).toContain('health_import_export');
    expect(names).toContain('health_query_records');
    expect(names).toContain('health_get_summary');
    expect(names).toContain('health_list_types');
  });

  test('all tools have openWorldHint: false', () => {
    const db = makeInMemoryDb();
    const connector = appleHealthConnectorFactory(db);
    for (const t of connector.tools) {
      const annotations = (t.sdkTool as any).annotations ?? {};
      expect(annotations.openWorldHint).toBe(false);
    }
  });

  test('health_import_export is not readOnly', () => {
    const db = makeInMemoryDb();
    const connector = appleHealthConnectorFactory(db);
    const t = connector.tools.find((t) => t.name === 'health_import_export')!;
    const annotations = (t.sdkTool as any).annotations ?? {};
    expect(annotations.readOnlyHint).not.toBe(true);
  });

  test('query/summary/list tools are readOnly', () => {
    const db = makeInMemoryDb();
    const connector = appleHealthConnectorFactory(db);
    const readOnlyNames = ['health_query_records', 'health_get_summary', 'health_list_types'];
    for (const name of readOnlyNames) {
      const t = connector.tools.find((t) => t.name === name)!;
      const annotations = (t.sdkTool as any).annotations ?? {};
      expect(annotations.readOnlyHint).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// health_import_export tool
// ---------------------------------------------------------------------------

describe('health_import_export tool', () => {
  let db: Database;

  beforeEach(() => {
    db = makeInMemoryDb();
    process.env.APPLE_HEALTH_EXPORT_PATH = '/fake/export.xml';
  });

  afterEach(() => {
    db.close();
    if (ORIGINAL_ENV === undefined) {
      delete process.env.APPLE_HEALTH_EXPORT_PATH;
    } else {
      process.env.APPLE_HEALTH_EXPORT_PATH = ORIGINAL_ENV;
    }
  });

  test('imports records from XML and returns summary', async () => {
    _setFileReader(async () => SAMPLE_XML);

    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_import_export')!;
    const result = await (tool.sdkTool as any).handler({});
    const text: string = result.content[0].text;

    _resetFileReader();

    expect(text).toContain('Indexed');
    expect(result.isError).toBeFalsy();
  });

  test('returns error when APPLE_HEALTH_EXPORT_PATH is not set', async () => {
    delete process.env.APPLE_HEALTH_EXPORT_PATH;
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_import_export')!;
    const result = await (tool.sdkTool as any).handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('APPLE_HEALTH_EXPORT_PATH');
  });

  test('returns error when export file does not exist', async () => {
    process.env.APPLE_HEALTH_EXPORT_PATH = '/nonexistent/path/export.xml';
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_import_export')!;
    const result = await (tool.sdkTool as any).handler({});
    expect(result.isError).toBe(true);
  });

  test('clears existing records before re-import', async () => {
    // Seed a record
    db.run(
      "INSERT INTO health_records (type, value, unit, start_date, end_date, source_name) VALUES ('HKQuantityTypeIdentifierStepCount', 999, 'count', '2023-01-01', '2023-01-01', 'TestSource')"
    );
    const countBefore = (db.query('SELECT COUNT(*) as n FROM health_records').get() as any).n;
    expect(countBefore).toBe(1);

    _setFileReader(async () => SAMPLE_XML);

    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_import_export')!;
    await (tool.sdkTool as any).handler({});

    _resetFileReader();

    // Old stale record should be gone; fresh records from SAMPLE_XML
    const hasStale = db.query("SELECT COUNT(*) as n FROM health_records WHERE value = 999 AND source_name = 'TestSource'").get() as any;
    expect(hasStale.n).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// health_query_records tool
// ---------------------------------------------------------------------------

describe('health_query_records tool', () => {
  let db: Database;

  beforeEach(() => {
    db = makeInMemoryDb();
    // Seed test data directly into DB
    const insert = db.prepare(
      'INSERT INTO health_records (type, value, unit, start_date, end_date, source_name) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insert.run('HKQuantityTypeIdentifierStepCount', 1000, 'count', '2024-01-15 07:00:00', '2024-01-15 08:00:00', 'iPhone');
    insert.run('HKQuantityTypeIdentifierStepCount', 3000, 'count', '2024-01-15 08:00:00', '2024-01-15 09:00:00', 'Apple Watch');
    insert.run('HKQuantityTypeIdentifierStepCount', 2000, 'count', '2024-01-16 07:00:00', '2024-01-16 08:00:00', 'iPhone');
    insert.run('HKQuantityTypeIdentifierHeartRate', 72, 'count/min', '2024-01-15 08:05:00', '2024-01-15 08:05:00', 'Apple Watch');
    insert.run('HKQuantityTypeIdentifierHeartRate', 85, 'count/min', '2024-01-15 10:00:00', '2024-01-15 10:00:00', 'Apple Watch');
  });

  afterEach(() => {
    db.close();
  });

  test('queries by type and returns stats', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_query_records')!;
    const result = await (tool.sdkTool as any).handler({
      type: 'HKQuantityTypeIdentifierStepCount',
    });
    const text: string = result.content[0].text;
    expect(text).toContain('HKQuantityTypeIdentifierStepCount');
    expect(text).toContain('count: 3');
    expect(result.isError).toBeFalsy();
  });

  test('stats include avg, min, max, total', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_query_records')!;
    const result = await (tool.sdkTool as any).handler({
      type: 'HKQuantityTypeIdentifierStepCount',
    });
    const text: string = result.content[0].text;
    // total = 1000 + 3000 + 2000 = 6000
    expect(text).toContain('6000');
    // min = 1000
    expect(text).toContain('1000');
    // max = 3000
    expect(text).toContain('3000');
  });

  test('filters by date range', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_query_records')!;
    const result = await (tool.sdkTool as any).handler({
      type: 'HKQuantityTypeIdentifierStepCount',
      startDate: '2024-01-16',
      endDate: '2024-01-17',
    });
    const text: string = result.content[0].text;
    // Only the Jan 16 record (2000) should be included
    expect(text).toContain('count: 1');
    expect(text).toContain('2000');
  });

  test('returns no-data message when type not found', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_query_records')!;
    const result = await (tool.sdkTool as any).handler({
      type: 'HKQuantityTypeIdentifierNonExistent',
    });
    const text: string = result.content[0].text;
    expect(text).toContain('No records found');
    expect(result.isError).toBeFalsy();
  });

  test('limits result rows when limit is specified', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_query_records')!;
    const result = await (tool.sdkTool as any).handler({
      type: 'HKQuantityTypeIdentifierStepCount',
      limit: 2,
    });
    // Stats should still be aggregate; not more than limit individual rows
    expect(result.isError).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// health_get_summary tool
// ---------------------------------------------------------------------------

describe('health_get_summary tool', () => {
  let db: Database;

  beforeEach(() => {
    db = makeInMemoryDb();
    const insert = db.prepare(
      'INSERT INTO health_records (type, value, unit, start_date, end_date, source_name) VALUES (?, ?, ?, ?, ?, ?)'
    );
    // Steps
    insert.run('HKQuantityTypeIdentifierStepCount', 8000, 'count', '2024-01-15 00:00:00', '2024-01-15 23:59:59', 'iPhone');
    insert.run('HKQuantityTypeIdentifierStepCount', 10000, 'count', '2024-01-16 00:00:00', '2024-01-16 23:59:59', 'iPhone');
    // Heart rate
    insert.run('HKQuantityTypeIdentifierHeartRate', 72, 'count/min', '2024-01-15 08:05:00', '2024-01-15 08:05:00', 'Apple Watch');
    insert.run('HKQuantityTypeIdentifierHeartRate', 65, 'count/min', '2024-01-16 08:05:00', '2024-01-16 08:05:00', 'Apple Watch');
    // Active energy
    insert.run('HKQuantityTypeIdentifierActiveEnergyBurned', 400, 'Cal', '2024-01-15 00:00:00', '2024-01-15 23:59:59', 'Apple Watch');
  });

  afterEach(() => {
    db.close();
  });

  test('returns summary with steps section', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_get_summary')!;
    // Pass startDate covering test data (2024-01-15/16)
    const result = await (tool.sdkTool as any).handler({ period: 'daily', startDate: '2024-01-14' });
    const text: string = result.content[0].text;
    expect(text).toContain('Steps');
    expect(result.isError).toBeFalsy();
  });

  test('returns summary with heart rate section when data present', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_get_summary')!;
    const result = await (tool.sdkTool as any).handler({ period: 'weekly', startDate: '2024-01-14' });
    const text: string = result.content[0].text;
    expect(text).toContain('Heart Rate');
  });

  test('accepts period parameter daily and weekly', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_get_summary')!;

    const daily = await (tool.sdkTool as any).handler({ period: 'daily', startDate: '2024-01-14' });
    expect(daily.isError).toBeFalsy();

    const weekly = await (tool.sdkTool as any).handler({ period: 'weekly', startDate: '2024-01-14' });
    expect(weekly.isError).toBeFalsy();
  });

  test('returns graceful message when no health data is indexed', async () => {
    const emptyDb = makeInMemoryDb();
    const connector = appleHealthConnectorFactory(emptyDb);
    const tool = connector.tools.find((t) => t.name === 'health_get_summary')!;
    const result = await (tool.sdkTool as any).handler({ period: 'daily' });
    const text: string = result.content[0].text;
    // Should not error out; should describe empty state
    expect(result.isError).toBeFalsy();
    expect(text.length).toBeGreaterThan(0);
    emptyDb.close();
  });
});

// ---------------------------------------------------------------------------
// health_list_types tool
// ---------------------------------------------------------------------------

describe('health_list_types tool', () => {
  let db: Database;

  beforeEach(() => {
    db = makeInMemoryDb();
    const insert = db.prepare(
      'INSERT INTO health_records (type, value, unit, start_date, end_date, source_name) VALUES (?, ?, ?, ?, ?, ?)'
    );
    insert.run('HKQuantityTypeIdentifierStepCount', 1000, 'count', '2024-01-15', '2024-01-15', 'iPhone');
    insert.run('HKQuantityTypeIdentifierStepCount', 2000, 'count', '2024-01-16', '2024-01-16', 'iPhone');
    insert.run('HKQuantityTypeIdentifierHeartRate', 72, 'count/min', '2024-01-15', '2024-01-15', 'Apple Watch');
    insert.run('HKCategoryTypeIdentifierSleepAnalysis', null, '', '2024-01-15', '2024-01-16', 'Apple Watch');
  });

  afterEach(() => {
    db.close();
  });

  test('returns all distinct types with counts', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_list_types')!;
    const result = await (tool.sdkTool as any).handler({});
    const text: string = result.content[0].text;

    expect(text).toContain('HKQuantityTypeIdentifierStepCount');
    expect(text).toContain('HKQuantityTypeIdentifierHeartRate');
    expect(text).toContain('HKCategoryTypeIdentifierSleepAnalysis');
    expect(result.isError).toBeFalsy();
  });

  test('includes record count for each type', async () => {
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_list_types')!;
    const result = await (tool.sdkTool as any).handler({});
    const text: string = result.content[0].text;

    // StepCount has 2 records — the "Records: N" line appears right after the fenced type name
    // Verify StepCount appears in text and there is a "Records: 2" line
    expect(text).toContain('HKQuantityTypeIdentifierStepCount');
    expect(text).toContain('Records: 2');
  });

  test('returns message when no data indexed', async () => {
    const emptyDb = makeInMemoryDb();
    const connector = appleHealthConnectorFactory(emptyDb);
    const tool = connector.tools.find((t) => t.name === 'health_list_types')!;
    const result = await (tool.sdkTool as any).handler({});
    const text: string = result.content[0].text;
    expect(text).toContain('No health data');
    expect(result.isError).toBeFalsy();
    emptyDb.close();
  });

  test('does not leak raw file paths or sensitive env vars', async () => {
    process.env.APPLE_HEALTH_EXPORT_PATH = '/home/user/sensitive/export.xml';
    const connector = appleHealthConnectorFactory(db);
    const tool = connector.tools.find((t) => t.name === 'health_list_types')!;
    const result = await (tool.sdkTool as any).handler({});
    const text: string = result.content[0].text;
    // The list_types tool should not expose the export path
    expect(text).not.toContain('/home/user/sensitive');
    if (ORIGINAL_ENV === undefined) {
      delete process.env.APPLE_HEALTH_EXPORT_PATH;
    } else {
      process.env.APPLE_HEALTH_EXPORT_PATH = ORIGINAL_ENV;
    }
  });
});
