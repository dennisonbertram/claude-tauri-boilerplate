import { describe, test, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createSubscriptionsTools } from './tools';
import { subscriptionsConnectorFactory } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(): Database {
  return new Database(':memory:');
}

function makeTools(db: Database) {
  return createSubscriptionsTools(db);
}

async function callTool(
  tools: ReturnType<typeof makeTools>,
  name: string,
  args: Record<string, unknown> = {}
) {
  const t = tools.find((t) => t.name === name);
  if (!t) throw new Error(`Tool "${name}" not found`);
  return t.sdkTool.handler(args);
}

// ---------------------------------------------------------------------------
// Factory / registration tests
// ---------------------------------------------------------------------------

describe('subscriptionsConnectorFactory', () => {
  test('creates a connector with correct metadata', () => {
    const db = makeDb();
    const connector = subscriptionsConnectorFactory(db);
    expect(connector.name).toBe('subscriptions');
    expect(connector.displayName).toBe('Subscription Tracker');
    expect(connector.category).toBe('subscriptions');
    expect(connector.icon).toBe('🔄');
    expect(connector.requiresAuth).toBe(false);
  });

  test('connector exposes 6 tools', () => {
    const db = makeDb();
    const connector = subscriptionsConnectorFactory(db);
    expect(connector.tools).toHaveLength(6);
  });
});

describe('createSubscriptionsTools', () => {
  test('returns 6 tool definitions', () => {
    const tools = makeTools(makeDb());
    expect(tools).toHaveLength(6);
  });

  test('has all expected tool names', () => {
    const names = makeTools(makeDb()).map((t) => t.name);
    expect(names).toContain('subscriptions_list');
    expect(names).toContain('subscriptions_add');
    expect(names).toContain('subscriptions_update');
    expect(names).toContain('subscriptions_cancel');
    expect(names).toContain('subscriptions_get_summary');
    expect(names).toContain('subscriptions_upcoming');
  });

  test('each tool has required fields', () => {
    for (const t of makeTools(makeDb())) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.sdkTool).toBeDefined();
      expect(t.sdkTool.name).toBe(t.name);
      expect(typeof t.sdkTool.handler).toBe('function');
    }
  });

  test('read-only tools have readOnlyHint: true', () => {
    const readOnly = ['subscriptions_list', 'subscriptions_get_summary', 'subscriptions_upcoming'];
    const tools = makeTools(makeDb());
    for (const name of readOnly) {
      const t = tools.find((t) => t.name === name)!;
      expect((t.sdkTool as any).annotations?.readOnlyHint).toBe(true);
    }
  });

  test('write tools have readOnlyHint: false', () => {
    const writeTools = ['subscriptions_add', 'subscriptions_update', 'subscriptions_cancel'];
    const tools = makeTools(makeDb());
    for (const name of writeTools) {
      const t = tools.find((t) => t.name === name)!;
      expect((t.sdkTool as any).annotations?.readOnlyHint).toBe(false);
    }
  });

  test('all tools have openWorldHint: false', () => {
    for (const t of makeTools(makeDb())) {
      expect((t.sdkTool as any).annotations?.openWorldHint).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// subscriptions_list
// ---------------------------------------------------------------------------

describe('subscriptions_list', () => {
  let db: Database;
  let tools: ReturnType<typeof makeTools>;

  beforeEach(() => {
    db = makeDb();
    tools = makeTools(db);
  });

  test('returns empty message when no subscriptions exist', async () => {
    const result = await callTool(tools, 'subscriptions_list');
    expect(result.content[0].text).toContain('No active subscriptions found.');
    expect(result.isError).toBeFalsy();
  });

  test('lists active subscriptions after adding one', async () => {
    await callTool(tools, 'subscriptions_add', { name: 'Netflix', amount: 15.99 });
    const result = await callTool(tools, 'subscriptions_list');
    const text = result.content[0].text as string;
    expect(text).toContain('Netflix');
    expect(text).toContain('15.99');
  });

  test('fences subscription names to prevent prompt injection', async () => {
    await callTool(tools, 'subscriptions_add', {
      name: '<script>alert("xss")</script>',
      amount: 9.99,
    });
    const result = await callTool(tools, 'subscriptions_list');
    const text = result.content[0].text as string;
    expect(text).toContain('UNTRUSTED_BEGIN');
    expect(text).toContain('<script>alert("xss")</script>');
  });

  test('shows total monthly cost in the output', async () => {
    await callTool(tools, 'subscriptions_add', { name: 'Netflix', amount: 15.99 });
    await callTool(tools, 'subscriptions_add', { name: 'Spotify', amount: 9.99 });
    const result = await callTool(tools, 'subscriptions_list');
    const text = result.content[0].text as string;
    expect(text).toContain('25.98');
  });

  test('does not show cancelled subscriptions', async () => {
    await callTool(tools, 'subscriptions_add', { name: 'Hulu', amount: 12 });
    const listResult = await callTool(tools, 'subscriptions_list');
    const id = parseInt((listResult.content[0].text as string).match(/ID: (\d+)/)![1]);
    await callTool(tools, 'subscriptions_cancel', { id });
    const afterCancel = await callTool(tools, 'subscriptions_list');
    expect(afterCancel.content[0].text).not.toContain('Hulu');
  });
});

// ---------------------------------------------------------------------------
// subscriptions_add
// ---------------------------------------------------------------------------

describe('subscriptions_add', () => {
  let db: Database;
  let tools: ReturnType<typeof makeTools>;

  beforeEach(() => {
    db = makeDb();
    tools = makeTools(db);
  });

  test('adds a subscription and returns its ID', async () => {
    const result = await callTool(tools, 'subscriptions_add', {
      name: 'GitHub',
      amount: 4.0,
      currency: 'USD',
      billing_cycle: 'monthly',
    });
    const text = result.content[0].text as string;
    expect(text).toContain('Subscription added successfully');
    expect(text).toContain('ID:');
    expect(result.isError).toBeFalsy();
  });

  test('stores yearly billing cycle correctly', async () => {
    await callTool(tools, 'subscriptions_add', {
      name: 'Adobe CC',
      amount: 599.88,
      billing_cycle: 'yearly',
    });
    // Yearly amount / 12 = 49.99/mo
    const summary = await callTool(tools, 'subscriptions_get_summary');
    const text = summary.content[0].text as string;
    expect(text).toContain('49.99');
  });

  test('uses USD as default currency', async () => {
    await callTool(tools, 'subscriptions_add', { name: 'Test', amount: 5 });
    const list = await callTool(tools, 'subscriptions_list');
    expect(list.content[0].text).toContain('USD');
  });

  test('uses monthly as default billing cycle', async () => {
    await callTool(tools, 'subscriptions_add', { name: 'Test', amount: 5 });
    const list = await callTool(tools, 'subscriptions_list');
    expect(list.content[0].text).toContain('monthly');
  });

  test('fences name in add confirmation', async () => {
    const result = await callTool(tools, 'subscriptions_add', {
      name: '<b>Injected</b>',
      amount: 1,
    });
    const text = result.content[0].text as string;
    expect(text).toContain('UNTRUSTED_BEGIN');
    expect(text).toContain('<b>Injected</b>');
  });
});

// ---------------------------------------------------------------------------
// subscriptions_update
// ---------------------------------------------------------------------------

describe('subscriptions_update', () => {
  let db: Database;
  let tools: ReturnType<typeof makeTools>;
  let subId: number;

  beforeEach(async () => {
    db = makeDb();
    tools = makeTools(db);
    const addResult = await callTool(tools, 'subscriptions_add', {
      name: 'OriginalName',
      amount: 10,
    });
    const match = (addResult.content[0].text as string).match(/ID: (\d+)/);
    subId = parseInt(match![1]);
  });

  test('updates name successfully', async () => {
    const result = await callTool(tools, 'subscriptions_update', {
      id: subId,
      name: 'UpdatedName',
    });
    expect(result.content[0].text).toContain('updated successfully');
    const list = await callTool(tools, 'subscriptions_list');
    expect(list.content[0].text).toContain('UpdatedName');
    expect(list.content[0].text).not.toContain('OriginalName');
  });

  test('updates amount successfully', async () => {
    await callTool(tools, 'subscriptions_update', { id: subId, amount: 99.99 });
    const list = await callTool(tools, 'subscriptions_list');
    expect(list.content[0].text).toContain('99.99');
  });

  test('returns error when no fields provided', async () => {
    const result = await callTool(tools, 'subscriptions_update', { id: subId });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No fields provided');
  });

  test('returns error when subscription ID does not exist', async () => {
    const result = await callTool(tools, 'subscriptions_update', {
      id: 99999,
      name: 'Ghost',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No active subscription found');
  });

  test('cannot update a cancelled subscription', async () => {
    await callTool(tools, 'subscriptions_cancel', { id: subId });
    const result = await callTool(tools, 'subscriptions_update', {
      id: subId,
      name: 'ShouldFail',
    });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// subscriptions_cancel
// ---------------------------------------------------------------------------

describe('subscriptions_cancel', () => {
  let db: Database;
  let tools: ReturnType<typeof makeTools>;
  let subId: number;

  beforeEach(async () => {
    db = makeDb();
    tools = makeTools(db);
    const addResult = await callTool(tools, 'subscriptions_add', {
      name: 'ToCancel',
      amount: 5,
    });
    const match = (addResult.content[0].text as string).match(/ID: (\d+)/);
    subId = parseInt(match![1]);
  });

  test('cancels an active subscription', async () => {
    const result = await callTool(tools, 'subscriptions_cancel', { id: subId });
    expect(result.content[0].text).toContain('cancelled successfully');
    expect(result.isError).toBeFalsy();
  });

  test('cancelled subscription no longer appears in list', async () => {
    await callTool(tools, 'subscriptions_cancel', { id: subId });
    const list = await callTool(tools, 'subscriptions_list');
    expect(list.content[0].text).not.toContain('ToCancel');
  });

  test('returns error for non-existent subscription ID', async () => {
    const result = await callTool(tools, 'subscriptions_cancel', { id: 99999 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No active subscription found');
  });

  test('double-cancel returns error', async () => {
    await callTool(tools, 'subscriptions_cancel', { id: subId });
    const result = await callTool(tools, 'subscriptions_cancel', { id: subId });
    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// subscriptions_get_summary
// ---------------------------------------------------------------------------

describe('subscriptions_get_summary', () => {
  let db: Database;
  let tools: ReturnType<typeof makeTools>;

  beforeEach(() => {
    db = makeDb();
    tools = makeTools(db);
  });

  test('returns empty message when no subscriptions', async () => {
    const result = await callTool(tools, 'subscriptions_get_summary');
    expect(result.content[0].text).toContain('No active subscriptions');
  });

  test('shows per-category breakdown', async () => {
    await callTool(tools, 'subscriptions_add', {
      name: 'Netflix',
      amount: 15.99,
      category: 'Entertainment',
    });
    await callTool(tools, 'subscriptions_add', {
      name: 'Spotify',
      amount: 9.99,
      category: 'Entertainment',
    });
    await callTool(tools, 'subscriptions_add', {
      name: 'GitHub',
      amount: 4.0,
      category: 'Productivity',
    });

    const result = await callTool(tools, 'subscriptions_get_summary');
    const text = result.content[0].text as string;
    expect(text).toContain('Entertainment');
    expect(text).toContain('Productivity');
    expect(text).toContain('Total:');
  });

  test('correctly converts yearly to monthly for totals', async () => {
    await callTool(tools, 'subscriptions_add', {
      name: 'Annual',
      amount: 120,
      billing_cycle: 'yearly',
      category: 'Test',
    });
    const result = await callTool(tools, 'subscriptions_get_summary');
    const text = result.content[0].text as string;
    // 120/yr = 10/mo
    expect(text).toContain('10.00/mo');
  });

  test('fences category names', async () => {
    await callTool(tools, 'subscriptions_add', {
      name: 'Test',
      amount: 1,
      category: '<evil>category</evil>',
    });
    const result = await callTool(tools, 'subscriptions_get_summary');
    const text = result.content[0].text as string;
    expect(text).toContain('UNTRUSTED_BEGIN');
    expect(text).toContain('<evil>category</evil>');
  });
});

// ---------------------------------------------------------------------------
// subscriptions_upcoming
// ---------------------------------------------------------------------------

describe('subscriptions_upcoming', () => {
  let db: Database;
  let tools: ReturnType<typeof makeTools>;

  beforeEach(() => {
    db = makeDb();
    tools = makeTools(db);
  });

  test('returns empty when no subscriptions have upcoming billing dates', async () => {
    const result = await callTool(tools, 'subscriptions_upcoming', { days: 30 });
    expect(result.content[0].text).toContain('No subscriptions billing in the next 30 days');
  });

  test('returns subscription billing within range', async () => {
    // Date 5 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const dateStr = futureDate.toISOString().slice(0, 10);

    await callTool(tools, 'subscriptions_add', {
      name: 'Netflix',
      amount: 15.99,
      next_billing_date: dateStr,
    });

    const result = await callTool(tools, 'subscriptions_upcoming', { days: 30 });
    const text = result.content[0].text as string;
    expect(text).toContain('Netflix');
    expect(text).toContain(dateStr);
  });

  test('excludes subscriptions outside the date range', async () => {
    // Date 60 days from now — outside default 30-day window
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 60);
    const dateStr = farFuture.toISOString().slice(0, 10);

    await callTool(tools, 'subscriptions_add', {
      name: 'FarFuture',
      amount: 9.99,
      next_billing_date: dateStr,
    });

    const result = await callTool(tools, 'subscriptions_upcoming', { days: 30 });
    expect(result.content[0].text).not.toContain('FarFuture');
  });

  test('uses 30 days as default when days not specified', async () => {
    const result = await callTool(tools, 'subscriptions_upcoming');
    expect(result.content[0].text).toContain('30 days');
  });

  test('fences subscription names in upcoming output', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    await callTool(tools, 'subscriptions_add', {
      name: '<script>pwn()</script>',
      amount: 5,
      next_billing_date: dateStr,
    });

    const result = await callTool(tools, 'subscriptions_upcoming', { days: 7 });
    const text = result.content[0].text as string;
    expect(text).toContain('UNTRUSTED_BEGIN');
    expect(text).toContain('<script>pwn()</script>');
  });
});
