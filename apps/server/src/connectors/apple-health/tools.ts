import { z } from 'zod';
import { tool } from '@anthropic-ai/claude-agent-sdk';
import type { Database } from 'bun:sqlite';
import type { ConnectorToolDefinition } from '../types';
import { sanitizeError, fenceUntrustedContent } from '../utils';

// ---------------------------------------------------------------------------
// Testable file reader — can be swapped out in tests
// ---------------------------------------------------------------------------

type FileReader = (path: string, encoding: string) => Promise<string>;

let _fileReader: FileReader = async (path, encoding) => {
  const fs = await import('fs/promises');
  return fs.readFile(path, encoding as BufferEncoding) as Promise<string>;
};

/**
 * Override the file reader used by health_import_export.
 * Only intended for testing.
 */
export function _setFileReader(reader: FileReader): void {
  _fileReader = reader;
}

export function _resetFileReader(): void {
  _fileReader = async (path, encoding) => {
    const fs = await import('fs/promises');
    return fs.readFile(path, encoding as BufferEncoding) as Promise<string>;
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthRecord {
  type: string;
  value: number | null;
  unit: string;
  startDate: string;
  endDate: string | null;
  sourceName: string;
  creationDate: string | null;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Creates the health_records table and index if they don't already exist.
 * Safe to call multiple times (idempotent).
 */
export function buildSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS health_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value REAL,
      unit TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      source_name TEXT,
      creation_date TEXT
    )
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_health_type_date ON health_records(type, start_date)
  `);
}

// ---------------------------------------------------------------------------
// XML parsing helpers
// ---------------------------------------------------------------------------

// Regex to extract a named attribute value from an XML element string
const ATTR_RE = (name: string) => new RegExp(`\\b${name}="([^"]*)"`, 'i');

/**
 * Parses a single XML line that looks like a `<Record ... />` element.
 * Returns a HealthRecord if the line matches, or null otherwise.
 * Uses regex instead of a full XML parser — adequate for Apple Health's
 * well-structured self-closing `<Record>` elements.
 */
export function parseHealthRecord(line: string): HealthRecord | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('<Record ')) {
    return null;
  }

  const typeMatch = ATTR_RE('type').exec(trimmed);
  const valueMatch = ATTR_RE('value').exec(trimmed);
  const unitMatch = ATTR_RE('unit').exec(trimmed);
  const startDateMatch = ATTR_RE('startDate').exec(trimmed);
  const endDateMatch = ATTR_RE('endDate').exec(trimmed);
  const sourceNameMatch = ATTR_RE('sourceName').exec(trimmed);
  const creationDateMatch = ATTR_RE('creationDate').exec(trimmed);

  if (!typeMatch || !startDateMatch) {
    return null;
  }

  const rawValue = valueMatch ? valueMatch[1] : null;
  const numericValue = rawValue !== null ? parseFloat(rawValue) : null;
  const value = numericValue !== null && !isNaN(numericValue) ? numericValue : null;

  return {
    type: typeMatch[1],
    value,
    unit: unitMatch ? unitMatch[1] : '',
    startDate: startDateMatch[1],
    endDate: endDateMatch ? endDateMatch[1] : null,
    sourceName: sourceNameMatch ? sourceNameMatch[1] : '',
    creationDate: creationDateMatch ? creationDateMatch[1] : null,
  };
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getExportPath(): string {
  const exportPath = process.env.APPLE_HEALTH_EXPORT_PATH;
  if (!exportPath) {
    throw new Error(
      'APPLE_HEALTH_EXPORT_PATH environment variable is not set. ' +
        'Export your health data from iPhone: Settings → Health → Export All Health Data, ' +
        'then set APPLE_HEALTH_EXPORT_PATH to the path of export.xml.'
    );
  }
  return exportPath;
}

// ---------------------------------------------------------------------------
// health_import_export
// ---------------------------------------------------------------------------

function createImportExportTool(db: Database) {
  return tool(
    'health_import_export',
    'Scan the Apple Health export XML file and index all records into local SQLite for fast querying. ' +
      'Run this first before using any other health tools. The export file path is read from the ' +
      'APPLE_HEALTH_EXPORT_PATH environment variable.',
    {},
    async (_args) => {
      try {
        const exportPath = getExportPath();

        // Read the export file
        let xmlContent: string;
        try {
          xmlContent = await _fileReader(exportPath, 'utf-8');
        } catch (readErr) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error reading export file at "${exportPath}": ${sanitizeError(readErr)}`,
              },
            ],
            isError: true,
          };
        }

        // Ensure schema exists
        buildSchema(db);

        // Clear existing records before re-import
        db.run('DELETE FROM health_records');

        // Parse line by line (SAX-like approach)
        const insertStmt = db.prepare(
          'INSERT INTO health_records (type, value, unit, start_date, end_date, source_name, creation_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );

        let indexedCount = 0;
        let skippedCount = 0;

        // Use transaction for performance
        const importAll = db.transaction(() => {
          const lines = xmlContent.split('\n');
          for (const line of lines) {
            const record = parseHealthRecord(line);
            if (record) {
              try {
                insertStmt.run(
                  record.type,
                  record.value,
                  record.unit,
                  record.startDate,
                  record.endDate,
                  record.sourceName,
                  record.creationDate
                );
                indexedCount++;
              } catch {
                skippedCount++;
              }
            }
          }
        });

        importAll();

        // Count distinct types
        const typeCount = (
          db.query('SELECT COUNT(DISTINCT type) as n FROM health_records').get() as any
        ).n;

        const lines = [
          `Indexed ${indexedCount.toLocaleString()} health records from export file.`,
          `Found ${typeCount} distinct record types.`,
        ];
        if (skippedCount > 0) {
          lines.push(`Skipped ${skippedCount} malformed records.`);
        }
        lines.push('Use health_list_types to see available data types, or health_query_records to query specific metrics.');

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error importing health data: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Import Apple Health Export',
        readOnlyHint: false,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// health_query_records
// ---------------------------------------------------------------------------

function createQueryRecordsTool(db: Database) {
  return tool(
    'health_query_records',
    'Query indexed Apple Health records by type and optional date range. ' +
      'Returns summary statistics (count, average, min, max, total) and a sample of recent records.',
    {
      type: z
        .string()
        .describe(
          'The health record type to query, e.g. "HKQuantityTypeIdentifierStepCount", "HKQuantityTypeIdentifierHeartRate"'
        ),
      startDate: z
        .string()
        .optional()
        .describe('Start date filter (ISO format or "YYYY-MM-DD"). Inclusive.'),
      endDate: z
        .string()
        .optional()
        .describe('End date filter (ISO format or "YYYY-MM-DD"). Inclusive.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe('Maximum number of individual records to include in the output (1-500, default 50)'),
    },
    async (args) => {
      try {
        buildSchema(db);

        const maxRows = args.limit ?? 50;

        // Build WHERE clause
        const conditions: string[] = ['type = ?'];
        const params: (string | number)[] = [args.type];

        if (args.startDate) {
          conditions.push('start_date >= ?');
          params.push(args.startDate);
        }
        if (args.endDate) {
          conditions.push('start_date <= ?');
          params.push(args.endDate + ' 23:59:59');
        }

        const where = conditions.join(' AND ');

        // Aggregate stats
        const stats = db
          .query(
            `SELECT COUNT(*) as count, AVG(value) as avg, MIN(value) as min, MAX(value) as max, SUM(value) as total, unit
             FROM health_records WHERE ${where}`
          )
          .get(...params) as any;

        if (!stats || stats.count === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No records found for type "${fenceUntrustedContent(args.type, 'apple-health')}"${args.startDate || args.endDate ? ' in the specified date range' : ''}. ` +
                  'Use health_list_types to see available record types, or health_import_export to index your data.',
              },
            ],
          };
        }

        // Recent records sample
        const rows = db
          .query(
            `SELECT start_date, end_date, value, unit, source_name FROM health_records
             WHERE ${where} ORDER BY start_date DESC LIMIT ?`
          )
          .all(...params, maxRows) as any[];

        const unit = stats.unit ?? '';
        const lines: string[] = [
          `Health Records: ${fenceUntrustedContent(args.type, 'apple-health')}`,
          '',
          '--- Summary Stats ---',
          `count: ${stats.count}`,
          `avg: ${stats.avg !== null ? Number(stats.avg).toFixed(2) : 'N/A'} ${unit}`,
          `min: ${stats.min !== null ? stats.min : 'N/A'} ${unit}`,
          `max: ${stats.max !== null ? stats.max : 'N/A'} ${unit}`,
          `total: ${stats.total !== null ? Number(stats.total).toFixed(2) : 'N/A'} ${unit}`,
          '',
          `--- Recent Records (showing up to ${maxRows}) ---`,
        ];

        for (const row of rows) {
          const dateStr = row.end_date && row.end_date !== row.start_date
            ? `${row.start_date} → ${row.end_date}`
            : row.start_date;
          const valueStr = row.value !== null ? `${row.value} ${row.unit ?? ''}`.trim() : '(no value)';
          lines.push(`${fenceUntrustedContent(dateStr, 'apple-health')}  ${valueStr}  [${fenceUntrustedContent(row.source_name ?? '', 'apple-health')}]`);
        }

        if (args.startDate || args.endDate) {
          lines.push('');
          lines.push(`Date range: ${args.startDate ?? 'any'} to ${args.endDate ?? 'any'}`);
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error querying health records: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Query Health Records',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// health_get_summary
// ---------------------------------------------------------------------------

const STEP_TYPE = 'HKQuantityTypeIdentifierStepCount';
const HR_TYPE = 'HKQuantityTypeIdentifierHeartRate';
const SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis';
const ENERGY_TYPE = 'HKQuantityTypeIdentifierActiveEnergyBurned';
const DISTANCE_TYPE = 'HKQuantityTypeIdentifierDistanceWalkingRunning';

function createGetSummaryTool(db: Database) {
  return tool(
    'health_get_summary',
    'Get a daily or weekly summary of key health metrics: steps, heart rate, sleep, active energy, and distance. ' +
      'Aggregates data across the most recent period from the indexed health records.',
    {
      period: z
        .enum(['daily', 'weekly'])
        .optional()
        .describe('Summary period: "daily" groups by day, "weekly" shows last 7 days totals (default: "daily")'),
      startDate: z
        .string()
        .optional()
        .describe('Start of summary window (YYYY-MM-DD). Defaults to 7 days ago for daily, 4 weeks ago for weekly.'),
    },
    async (args) => {
      try {
        buildSchema(db);

        const period = args.period ?? 'daily';

        // Default date range
        const now = new Date();
        const defaultDaysBack = period === 'weekly' ? 28 : 7;
        const defaultStart = new Date(now);
        defaultStart.setDate(defaultStart.getDate() - defaultDaysBack);
        const startDate = args.startDate ?? defaultStart.toISOString().slice(0, 10);

        function getStats(type: string): { count: number; avg: number | null; min: number | null; max: number | null; total: number | null } | null {
          const row = db
            .query(
              `SELECT COUNT(*) as count, AVG(value) as avg, MIN(value) as min, MAX(value) as max, SUM(value) as total
               FROM health_records WHERE type = ? AND start_date >= ?`
            )
            .get(type, startDate) as any;
          if (!row || row.count === 0) return null;
          return row;
        }

        function getDailyBreakdown(type: string, agg: 'SUM' | 'AVG'): Array<{ date: string; value: number }> {
          return db
            .query(
              `SELECT substr(start_date, 1, 10) as date, ${agg}(value) as value
               FROM health_records WHERE type = ? AND start_date >= ? AND value IS NOT NULL
               GROUP BY date ORDER BY date DESC LIMIT 14`
            )
            .all(type, startDate) as any[];
        }

        const lines: string[] = [`Health Summary (${period === 'daily' ? 'Daily' : 'Weekly'} — since ${startDate})`, ''];

        let hasAnyData = false;

        // Steps
        const steps = getStats(STEP_TYPE);
        if (steps) {
          hasAnyData = true;
          lines.push('--- Steps ---');
          lines.push(`Total: ${Math.round(steps.total ?? 0).toLocaleString()} steps`);
          lines.push(`Daily avg: ${Math.round((steps.avg ?? 0)).toLocaleString()} steps`);
          if (period === 'daily') {
            const daily = getDailyBreakdown(STEP_TYPE, 'SUM');
            for (const d of daily) {
              lines.push(`  ${d.date}: ${Math.round(d.value).toLocaleString()} steps`);
            }
          }
          lines.push('');
        }

        // Heart Rate
        const hr = getStats(HR_TYPE);
        if (hr) {
          hasAnyData = true;
          lines.push('--- Heart Rate ---');
          lines.push(`Avg: ${hr.avg !== null ? Number(hr.avg).toFixed(1) : 'N/A'} bpm`);
          lines.push(`Min: ${hr.min ?? 'N/A'} bpm  |  Max: ${hr.max ?? 'N/A'} bpm`);
          if (period === 'daily') {
            const daily = getDailyBreakdown(HR_TYPE, 'AVG');
            for (const d of daily) {
              lines.push(`  ${d.date}: ${Number(d.value).toFixed(1)} bpm avg`);
            }
          }
          lines.push('');
        }

        // Active Energy
        const energy = getStats(ENERGY_TYPE);
        if (energy) {
          hasAnyData = true;
          lines.push('--- Active Energy Burned ---');
          lines.push(`Total: ${Math.round(energy.total ?? 0).toLocaleString()} Cal`);
          lines.push(`Daily avg: ${Math.round(energy.avg ?? 0).toLocaleString()} Cal`);
          lines.push('');
        }

        // Distance
        const dist = getStats(DISTANCE_TYPE);
        if (dist) {
          hasAnyData = true;
          lines.push('--- Distance ---');
          const totalKm = (dist.total ?? 0);
          lines.push(`Total: ${totalKm.toFixed(2)} km`);
          lines.push('');
        }

        // Sleep
        const sleep = db
          .query(
            `SELECT COUNT(*) as count, AVG(
               (julianday(COALESCE(end_date, start_date)) - julianday(start_date)) * 24
             ) as avg_hours
             FROM health_records WHERE type = ? AND start_date >= ?`
          )
          .get(SLEEP_TYPE, startDate) as any;
        if (sleep && sleep.count > 0 && sleep.avg_hours !== null) {
          hasAnyData = true;
          lines.push('--- Sleep ---');
          lines.push(`Sessions: ${sleep.count}`);
          lines.push(`Avg duration: ${Number(sleep.avg_hours).toFixed(1)} hours`);
          lines.push('');
        }

        if (!hasAnyData) {
          lines.push('No health data found for this period.');
          lines.push('Use health_import_export to index your Apple Health export first.');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error generating health summary: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'Get Health Summary',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// health_list_types
// ---------------------------------------------------------------------------

function createListTypesTool(db: Database) {
  return tool(
    'health_list_types',
    'List all available health record types in the indexed Apple Health data, with record counts and date ranges.',
    {},
    async (_args) => {
      try {
        buildSchema(db);

        const rows = db
          .query(
            `SELECT type, COUNT(*) as count, MIN(start_date) as earliest, MAX(start_date) as latest, unit
             FROM health_records GROUP BY type ORDER BY count DESC`
          )
          .all() as Array<{ type: string; count: number; earliest: string; latest: string; unit: string }>;

        if (rows.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No health data indexed yet. Use health_import_export to load your Apple Health export file first.',
              },
            ],
          };
        }

        const lines: string[] = [
          `Found ${rows.length} health record types (${rows.reduce((s, r) => s + r.count, 0).toLocaleString()} total records):`,
          '',
        ];

        for (const row of rows) {
          const unitStr = row.unit ? ` (${row.unit})` : '';
          lines.push(`${fenceUntrustedContent(row.type, 'apple-health')}${unitStr}`);
          lines.push(`  Records: ${row.count.toLocaleString()}  |  ${row.earliest} → ${row.latest}`);
          lines.push('');
        }

        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error listing health types: ${sanitizeError(error)}` }],
          isError: true,
        };
      }
    },
    {
      annotations: {
        title: 'List Health Record Types',
        readOnlyHint: true,
        openWorldHint: false,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function createAppleHealthTools(db: Database): ConnectorToolDefinition[] {
  return [
    {
      name: 'health_import_export',
      description: 'Scan Apple Health export XML and index records into local SQLite',
      sdkTool: createImportExportTool(db),
    },
    {
      name: 'health_query_records',
      description: 'Query indexed health records by type and date range with summary stats',
      sdkTool: createQueryRecordsTool(db),
    },
    {
      name: 'health_get_summary',
      description: 'Get daily/weekly summary of steps, heart rate, sleep, and workouts',
      sdkTool: createGetSummaryTool(db),
    },
    {
      name: 'health_list_types',
      description: 'List all available health record types in the indexed export',
      sdkTool: createListTypesTool(db),
    },
  ];
}
