import { Database } from 'bun:sqlite';

export type GoogleOAuthRecord = {
  googleSub: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  grantedScopes?: string;
  expiresAt?: string;
  lastError?: string;
  updatedAt?: string;
};

export function getGoogleOAuth(db: Database): GoogleOAuthRecord | null {
  const stmt = db.prepare(
    `SELECT google_sub, email, email_verified, name, picture,
            access_token, refresh_token, token_type, granted_scopes,
            expires_at, last_error, updated_at
     FROM google_oauth WHERE id = 1`
  );
  const row = stmt.get() as
    | {
        google_sub: string;
        email: string;
        email_verified: number | null;
        name: string | null;
        picture: string | null;
        access_token: string;
        refresh_token: string | null;
        token_type: string | null;
        granted_scopes: string | null;
        expires_at: string | null;
        last_error: string | null;
        updated_at: string | null;
      }
    | undefined;
  if (!row?.access_token) return null;

  return {
    googleSub: row.google_sub,
    email: row.email,
    emailVerified: row.email_verified === 1,
    name: row.name ?? undefined,
    picture: row.picture ?? undefined,
    accessToken: row.access_token,
    refreshToken: row.refresh_token ?? undefined,
    tokenType: row.token_type ?? undefined,
    grantedScopes: row.granted_scopes ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    lastError: row.last_error ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export function upsertGoogleOAuth(
  db: Database,
  token: Omit<GoogleOAuthRecord, 'updatedAt'>
): void {
  // CRITICAL: Never overwrite refresh_token with null/undefined.
  // If the new record has no refresh_token, preserve the existing one.
  const stmt = db.prepare(
    `INSERT INTO google_oauth (id, google_sub, email, email_verified, name, picture,
                               access_token, refresh_token, token_type, granted_scopes,
                               expires_at, last_error, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       google_sub = excluded.google_sub,
       email = excluded.email,
       email_verified = excluded.email_verified,
       name = excluded.name,
       picture = excluded.picture,
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, google_oauth.refresh_token),
       token_type = excluded.token_type,
       granted_scopes = excluded.granted_scopes,
       expires_at = excluded.expires_at,
       last_error = excluded.last_error,
       updated_at = datetime('now')`
  );

  stmt.run(
    token.googleSub,
    token.email,
    token.emailVerified ? 1 : 0,
    token.name ?? null,
    token.picture ?? null,
    token.accessToken,
    token.refreshToken ?? null,
    token.tokenType ?? null,
    token.grantedScopes ?? null,
    token.expiresAt ?? null,
    token.lastError ?? null
  );
}

export function updateGoogleOAuthTokens(
  db: Database,
  accessToken: string,
  expiresAt?: string,
  refreshToken?: string
): void {
  // Only update refresh_token if a new one is provided (never overwrite with null)
  if (refreshToken) {
    db.prepare(
      `UPDATE google_oauth SET access_token = ?, expires_at = ?, refresh_token = ?, updated_at = datetime('now') WHERE id = 1`
    ).run(accessToken, expiresAt ?? null, refreshToken);
  } else {
    db.prepare(
      `UPDATE google_oauth SET access_token = ?, expires_at = ?, updated_at = datetime('now') WHERE id = 1`
    ).run(accessToken, expiresAt ?? null);
  }
}

export function setGoogleOAuthError(db: Database, error: string): void {
  db.prepare(
    `UPDATE google_oauth SET last_error = ?, updated_at = datetime('now') WHERE id = 1`
  ).run(error);
}

export function clearGoogleOAuth(db: Database): void {
  db.prepare(`DELETE FROM google_oauth WHERE id = 1`).run();
}
