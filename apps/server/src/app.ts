import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { createChatRouter } from './routes/chat';
import { createPermissionRouter } from './routes/permission';
import { createPlanRouter } from './routes/plan';
import { createSessionsRouter } from './routes/sessions';
import { createGitRouter } from './routes/git';
import { createInstructionsRouter } from './routes/instructions';
import { createMemoryRouter } from './routes/memory';
import { createMcpRouter } from './routes/mcp';
import { createHooksRouter } from './routes/hooks';
import { createTeamsRouter } from './routes/teams';
import { createCheckpointsRouter } from './routes/checkpoints';
import { createProjectRouter } from './routes/projects';
import { createWorkspaceRouter, createFlatWorkspaceRouter } from './routes/workspaces';
import { createDiffCommentsRouter } from './routes/diff-comments';
import { createWorkspaceNotesRouter } from './routes/workspace-notes';
import { createCodeReviewRouter } from './routes/code-review';
import { createArtifactsRouter, createProjectArtifactsRouter } from './routes/artifacts';
import { createSessionThreadRouter } from './routes/sessions-thread';
import { createLinearRouter } from './routes/linear';
import { createGithubIssuesRouter } from './routes/github-issues';
import { createGithubReposRouter } from './routes/github-repos';
import { createProjectsGithubRouter } from './routes/projects-github';
import { createAgentProfilesRouter } from './routes/agent-profiles';
import { createSystemRouter } from './routes/system';
import { createRuntimeCapabilitiesRouter } from './routes/runtime-capabilities';
import { createWorkspaceProvidersRouter } from './routes/workspace-providers';
import { createWorkspaceProvisioningRouter } from './routes/workspace-provisioning';
import { createDeploymentRouter, createDeploymentSettingsRouter } from './routes/deployment';
import { createTrackerRouter } from './routes/tracker';
import { createDb } from './db';
import { errorHandler } from './middleware/error-handler';
import { bearerAuth } from './middleware/bearer-auth';

const app = new Hono();

// Centralized error handler -- catches all unhandled errors and returns
// consistent JSON responses: { error, code, details? }
app.onError(errorHandler);

const vitePort = process.env.VITE_PORT || '1420';
app.use(
  '*',
  cors({
    origin: [`http://localhost:${vitePort}`, 'tauri://localhost'],
    credentials: true,
    exposeHeaders: ['Content-Disposition'],
  })
);

// Bearer token auth — enforced when SIDECAR_BEARER_TOKEN is set (production).
// Skipped in dev mode (no token configured). Health endpoint is always open.
app.use('*', bearerAuth());

const db = createDb();

app.get('/api/health', (c) => c.json({ status: 'ok' }));
app.route('/api/auth', authRouter);
app.route('/api/chat', createChatRouter(db));
app.route('/api/chat/permission', createPermissionRouter(db));
app.route('/api/chat/plan', createPlanRouter(db));
app.route('/api/sessions', createSessionsRouter(db));
app.route('/api/git', createGitRouter());
app.route('/api/instructions', createInstructionsRouter());
app.route('/api/memory', createMemoryRouter());
app.route('/api/mcp', createMcpRouter());
app.route('/api/hooks', createHooksRouter());
app.route('/api/teams', createTeamsRouter());
app.route('/api/linear', createLinearRouter(db));
app.route('/api/projects', createProjectRouter(db));
app.route('/api/projects', createWorkspaceRouter(db));
app.route('/api/projects', createGithubIssuesRouter(db));
app.route('/api/github', createGithubReposRouter(db));
app.route('/api/projects', createProjectsGithubRouter(db));
app.route('/api/workspaces', createFlatWorkspaceRouter(db));
app.route('/api/workspaces', createDiffCommentsRouter(db));
app.route('/api/workspaces', createWorkspaceNotesRouter(db));
app.route('/api/workspaces', createCodeReviewRouter(db));
app.route('/api/agent-profiles', createAgentProfilesRouter(db));
app.route('/api/artifacts', createArtifactsRouter(db));
app.route('/api/projects', createProjectArtifactsRouter(db));
app.route('/api/sessions', createSessionThreadRouter(db));
app.route('/api/system', createSystemRouter());
app.route('/api/runtime-capabilities', createRuntimeCapabilitiesRouter());
app.route('/api/workspace-providers', createWorkspaceProvidersRouter(db));
app.route('/api/workspaces', createWorkspaceProvisioningRouter(db));
app.route('/api/workspaces', createDeploymentRouter(db));
app.route('/api/deployment-settings', createDeploymentSettingsRouter(db));
app.route('/api/tracker', createTrackerRouter(db));

// Checkpoints are nested under sessions: /api/sessions/:sessionId/checkpoints
// We mount a sub-router that receives sessionId as a param.
const checkpointsApp = new Hono();
checkpointsApp.route('/:sessionId/checkpoints', createCheckpointsRouter(db));
app.route('/api/sessions', checkpointsApp);

export { app };
