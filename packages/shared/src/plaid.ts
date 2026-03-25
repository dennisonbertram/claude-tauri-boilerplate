// ── Plaid Integration Types ───────────────────────────────────────────────────

// --- Core Entity Types ---

export interface PlaidItem {
  id: string;
  itemId: string;
  institutionId: string;
  institutionName: string;
  institutionLogoUrl?: string;
  institutionColor?: string;
  accounts: PlaidAccount[];
  error?: { code: string; message: string };
  consentExpiration?: string;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface PlaidAccount {
  id: string;
  name: string;
  officialName?: string;
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype?: string;
  mask?: string;
  currentBalance: number;
  availableBalance?: number;
  currencyCode: string;
}

export interface PlaidTransaction {
  id: string;
  accountId: string;
  amount: number;
  date: string;
  authorizedDate?: string;
  name: string;
  merchantName?: string;
  category?: string[];
  personalFinanceCategory?: string;
  pending: boolean;
  paymentChannel: string;
}

// --- Link Flow Types ---

export interface PlaidLinkSession {
  sessionId: string;
  state: string;
  hostedLinkUrl: string;
  status: 'initiated' | 'callback_received' | 'finalized' | 'failed' | 'expired';
}

// --- Pagination ---

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// --- Sync Status ---

export interface PlaidSyncStatus {
  itemId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  lastSyncedAt?: string;
  error?: string;
}

// --- Item Health ---

export type PlaidItemHealth = 'healthy' | 'error' | 'reauth_required' | 'consent_expiring';

// --- API Request / Response Types ---

export interface CreateLinkSessionRequest {
  /** Optional institution ID to pre-select in Plaid Link */
  institutionId?: string;
}

export interface CreateLinkSessionResponse {
  hostedLinkUrl: string;
  sessionId: string;
  state: string;
}

export interface FinalizeLinkRequest {
  state: string;
  publicToken: string;
}

export interface FinalizeLinkResponse {
  item: PlaidItem;
}

// --- Transaction Filters ---

export type PlaidTransactionSort =
  | 'date_asc'
  | 'date_desc'
  | 'amount_asc'
  | 'amount_desc';

export interface PlaidTransactionFilters {
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  pending?: boolean;
  search?: string;
  category?: string;
  minAmount?: number;
  maxAmount?: number;
  sort?: PlaidTransactionSort;
  limit?: number;
  offset?: number;
}
