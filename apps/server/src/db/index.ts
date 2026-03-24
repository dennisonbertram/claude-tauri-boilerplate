import { Database } from 'bun:sqlite';
import { SCHEMA, migrateSessionsWorkspaceId, migrateLinearIssueColumns, migrateSessionModelColumn, migrateWorkspaceAdditionalDirectories, migrateGithubIssueColumns, migrateSessionsProfileId, migrateWorkspaceProvenance, migrateWorkspaceEvents, migrateWorkspaceReview, migrateWorkspaceProviders, migrateWorkspaceDeploymentsTable, migrateDeploymentSettingsTable, migrateTrackerTables, migrateDocumentsTable, migrateGoogleOAuthTable, migrateDocumentsAddEnrichingStatus, migrateDocumentPipelineTables } from './schema';
import { join } from 'path';
import { mkdirSync } from 'fs';

const DB_DIR = process.env.DB_DIR || join(process.env.HOME || '~', '.claude-tauri');
const DB_PATH = process.env.DB_PATH || join(DB_DIR, 'data.db');

export function createDb(path?: string): Database {
  if (path !== ':memory:') {
    mkdirSync(DB_DIR, { recursive: true });
  }
  const db = new Database(path || DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  migrateSessionsWorkspaceId(db);
  migrateLinearIssueColumns(db);
  migrateSessionModelColumn(db);
  migrateWorkspaceAdditionalDirectories(db);
  migrateGithubIssueColumns(db);
  migrateSessionsProfileId(db);
  migrateWorkspaceProvenance(db);
  migrateWorkspaceEvents(db);
  migrateWorkspaceReview(db);
  migrateWorkspaceProviders(db);
  migrateWorkspaceDeploymentsTable(db);
  migrateDeploymentSettingsTable(db);
  migrateTrackerTables(db);
  migrateDocumentsTable(db);
  migrateGoogleOAuthTable(db);
  migrateDocumentsAddEnrichingStatus(db);
  migrateDocumentPipelineTables(db);
  return db;
}

// ─── Sessions ───────────────────────────────────────────────────────────────────
export {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  updateSessionTitle,
  updateSessionModel,
  updateClaudeSessionId,
  setSessionLinearIssue,
  clearClaudeSessionId,
  getSessionForWorkspace,
  linkSessionToWorkspace,
  linkSessionToProfile,
} from './db-sessions';
export type { LinearIssueMetadata } from './db-sessions';

// ─── Messages & Checkpoints ────────────────────────────────────────────────────
export {
  addMessage,
  getMessages,
  getSessionMessageCount,
  listSessionCheckpoints,
  getSessionCheckpoint,
  createCheckpoint,
  deleteSessionCheckpointsAfter,
  trimSessionMessagesToCount,
  getThreadMessages,
} from './db-messages';

// ─── Projects ───────────────────────────────────────────────────────────────────
export {
  createProject,
  listProjects,
  getProject,
  getProjectByPath,
  updateProject,
  deleteProject,
} from './db-projects';

// ─── Workspaces ─────────────────────────────────────────────────────────────────
export {
  createWorkspace,
  updateWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspaceStatus,
  transitionWorkspaceStatus,
  updateWorkspaceClaudeSession,
  setWorkspaceError,
  deleteWorkspace,
  recordWorkspaceEvent,
  getWorkspaceEvents,
  updateWorkspaceRecoveryStatus,
  updateWorkspaceProvenance,
} from './db-workspaces';

// ─── Linear OAuth ──────────────────────────────────────────────────────────────
export {
  getLinearOAuth,
  upsertLinearOAuth,
  clearLinearOAuth,
} from './db-linear';
export type { LinearOAuthRecord } from './db-linear';

// ─── Diff Comments ─────────────────────────────────────────────────────────────
export {
  listDiffComments,
  createDiffComment,
  getDiffComment,
  deleteDiffComment,
} from './db-diff-comments';

// ─── Artifacts ──────────────────────────────────────────────────────────────────
export {
  createArtifact,
  getArtifact,
  listArtifactsByProject,
  setArtifactCurrentRevision,
  archiveArtifact,
  createArtifactRevision,
  updateArtifactTitle,
  countArtifactRevisions,
  getArtifactLatestRevision,
  getArtifactRevision,
} from './db-artifacts';

// ─── Agent Profiles ─────────────────────────────────────────────────────────────
export {
  createAgentProfile,
  getAgentProfile,
  listAgentProfiles,
  updateAgentProfile,
  deleteAgentProfile,
  duplicateAgentProfile,
} from './db-agent-profiles';

// ─── Workspace Review ──────────────────────────────────────────────────────────
export {
  getOrCreateWorkspaceReview,
  updateWorkspaceReview,
  upsertReviewFile,
  getReviewFiles,
  createReviewComment,
  updateReviewComment,
  deleteReviewComment,
  getReviewComments,
  createReviewTodo,
  updateReviewTodo,
  getReviewTodos,
  computeMergeReadiness,
} from './db-workspace-review';
export type {
  WorkspaceReviewRow,
  WorkspaceReviewFileRow,
  WorkspaceReviewCommentRow,
  WorkspaceReviewTodoRow,
  MergeReadiness,
} from './db-workspace-review';

// ─── Workspace Providers ────────────────────────────────────────────────────────
export {
  createWorkspaceProvider,
  listWorkspaceProviders,
  getWorkspaceProvider,
  updateWorkspaceProvider,
  deleteWorkspaceProvider,
} from './db-workspace-providers';
export type { WorkspaceProviderRow } from './db-workspace-providers';

// ─── Workspace Provisioning Runs ─────────────────────────────────────────────
export {
  createProvisioningRun,
  listProvisioningRuns,
  getProvisioningRun,
  updateProvisioningRunStatus,
} from './db-workspace-provisioning';
export type { WorkspaceProvisioningRunRow } from './db-workspace-provisioning';

// ─── Documents ──────────────────────────────────────────────────────────────────
export {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  bulkDeleteDocuments,
} from './db-documents';

// ─── Deployments & Settings ────────────────────────────────────────────────────
export {
  getWorkspaceDeployment,
  upsertWorkspaceDeployment,
  updateWorkspaceDeploymentStatus,
  deleteWorkspaceDeployment,
  getRailwayToken,
  setRailwayToken,
} from './db-deployments';

// ─── Tracker ─────────────────────────────────────────────────────────────────
export {
  createTrackerProject,
  listTrackerProjects,
  getTrackerProject,
  getTrackerProjectBySlug,
  getTrackerProjectByProjectId,
  getTrackerProjectWithDetails,
  updateTrackerProject,
  deleteTrackerProject,
  listTrackerStatuses,
  createTrackerStatus,
  updateTrackerStatus,
  deleteTrackerStatus,
  listTrackerLabels,
  createTrackerLabel,
  deleteTrackerLabel,
  createTrackerIssue,
  getTrackerIssue,
  getTrackerIssueByIdentifier,
  listTrackerIssues,
  updateTrackerIssue,
  moveTrackerIssue,
  deleteTrackerIssue,
  listTrackerComments,
  createTrackerComment,
} from './db-tracker';

// ─── Google OAuth ──────────────────────────────────────────────────────────────
export {
  getGoogleOAuth,
  upsertGoogleOAuth,
  updateGoogleOAuthTokens,
  setGoogleOAuthError,
  clearGoogleOAuth,
} from './db-google';
export type { GoogleOAuthRecord } from './db-google';

// ─── Document Pipeline ──────────────────────────────────────────────────────────
export {
  getPipelineConfig,
  updatePipelineConfig,
  claimNextUnenrichedDocument,
  recoverStaleJobs,
  createStepRun,
  updateStepRun,
  getStepRunsForDocument,
  getLatestStepRun,
  upsertDocumentContent,
  getDocumentContent,
  deleteDocumentContent,
  upsertOcrOutput,
  getOcrOutputs,
  insertChunks,
  getChunksForDocument,
  deleteChunksForDocument,
  insertEntities,
  insertEntityRelationships,
  getEntitiesForDocument,
  getEntityRelationshipsForDocument,
  deleteEntitiesForDocument,
  cleanupDocumentEnrichment,
} from './db-pipeline';
