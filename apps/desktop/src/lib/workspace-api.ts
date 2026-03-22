// Barrel re-exporter - all domain API modules
// This file preserves backward compatibility for existing imports

export { fetchProjects, createProject, updateProject, deleteProject } from './api/projects-api';

export { fetchWorkspaces, createWorkspace, fetchWorkspaceStatus, renameWorkspace, deleteWorkspace, getWorkspaceSession } from './api/workspaces-api';

export type { WorkspaceDiffRange, WorkspaceRevision } from './api/diff-api';
export { fetchWorkspaceDiff, fetchChangedFiles, mergeWorkspace, fetchWorkspaceRevisions, discardWorkspace } from './api/diff-api';

export { fetchDiffComments, createDiffComment, deleteDiffComment } from './api/diff-comments-api';

export type { CodeReviewRequest } from './api/notes-api';
export { fetchWorkspaceNotes, saveWorkspaceNotes, fetchCodeReview } from './api/notes-api';

export type { GithubIssue, GithubBranch, GithubRepo, GithubReposResult } from './api/github-api';
export { fetchGithubIssues, fetchProjectBranches, fetchGitBranchesFromPath, searchGithubRepos, listGithubRepos, testGithubToken, createProjectFromGithub } from './api/github-api';

export type { WorkspaceReviewResponse } from './api/review-api';
export { fetchWorkspaceReview, updateWorkspaceReview, upsertReviewFile, fetchReviewComments, createReviewComment, updateReviewComment, deleteReviewComment, fetchReviewTodos, createReviewTodo, updateReviewTodo } from './api/review-api';

export { getWorkspaceDeployment, linkWorkspaceDeployment, refreshWorkspaceDeploymentStatus, getWorkspaceDeploymentLogs, unlinkWorkspaceDeployment, setDeploymentToken } from './api/deployment-api';

export { fetchSessionThread, generateArtifact, fetchProjectArtifacts, archiveArtifact, renameArtifact, regenerateArtifact } from './api/artifacts-api';

export { listWorkspaceProviders, createWorkspaceProvider, updateWorkspaceProvider, deleteWorkspaceProvider, listProvisioningRuns, createProvisioningRun, getProvisioningRun } from './api/providers-api';
