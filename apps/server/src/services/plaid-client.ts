import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

/**
 * Create and configure a Plaid API client from environment variables.
 *
 * Required env vars:
 *   PLAID_CLIENT_ID  — Plaid dashboard client ID
 *   PLAID_SECRET     — Plaid dashboard secret (per environment)
 *   PLAID_ENV        — "sandbox" | "development" | "production" (default: "sandbox")
 */
export function createPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV || 'sandbox';

  if (!clientId || !secret) {
    throw new Error(
      'Missing PLAID_CLIENT_ID or PLAID_SECRET environment variables. ' +
        'Set them in .env or your environment before using Plaid features.',
    );
  }

  const validEnvs = Object.keys(PlaidEnvironments);
  if (!validEnvs.includes(env)) {
    throw new Error(
      `Invalid PLAID_ENV="${env}". Must be one of: ${validEnvs.join(', ')}`,
    );
  }

  const config = new Configuration({
    basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  return new PlaidApi(config);
}
