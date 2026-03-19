import { describe, it, expect } from 'vitest';
import { looksLikeSlug, basenameFromPath, getProjectDisplayName } from '../project-display';
import type { Project } from '@claude-tauri/shared';

// ---------------------------------------------------------------------------
// looksLikeSlug
// ---------------------------------------------------------------------------

describe('looksLikeSlug', () => {
  it('detects mixed-case random suffixes (the ISSUE-007 case)', () => {
    expect(looksLikeSlug('reconcile-ws-fG6AeG')).toBe(true);
  });

  it('detects other mixed-case random suffixes', () => {
    expect(looksLikeSlug('my-project-aB3xZq')).toBe(true);
    expect(looksLikeSlug('workspace-Xy9mPL')).toBe(true);
    expect(looksLikeSlug('feature-ABC123')).toBe(true);
  });

  it('returns false for clean human-readable names', () => {
    expect(looksLikeSlug('my-app')).toBe(false);
    expect(looksLikeSlug('react-v18')).toBe(false);
    expect(looksLikeSlug('claude-tauri')).toBe(false);
    expect(looksLikeSlug('my-repo-name')).toBe(false);
  });

  it('returns false for single-segment names', () => {
    expect(looksLikeSlug('myapp')).toBe(false);
    expect(looksLikeSlug('project')).toBe(false);
  });

  it('returns false for all-lowercase suffixes that look like words', () => {
    expect(looksLikeSlug('my-project-name')).toBe(false);
    expect(looksLikeSlug('some-repo-main')).toBe(false);
  });

  it('returns false for very short suffixes (not enough entropy)', () => {
    expect(looksLikeSlug('my-app-ab')).toBe(false);
    expect(looksLikeSlug('my-app-1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// basenameFromPath
// ---------------------------------------------------------------------------

describe('basenameFromPath', () => {
  it('extracts the last segment from a Unix path', () => {
    expect(basenameFromPath('/Users/foo/projects/my-repo')).toBe('my-repo');
  });

  it('strips trailing slashes', () => {
    expect(basenameFromPath('/some/path/')).toBe('path');
  });

  it('handles Windows-style paths', () => {
    expect(basenameFromPath('C:\\Users\\foo\\my-project')).toBe('my-project');
  });

  it('returns the string as-is when there is no separator', () => {
    expect(basenameFromPath('standalone')).toBe('standalone');
  });

  it('handles deep nesting', () => {
    expect(basenameFromPath('/a/b/c/d/e/repo')).toBe('repo');
  });
});

// ---------------------------------------------------------------------------
// getProjectDisplayName
// ---------------------------------------------------------------------------

const baseProject: Project = {
  id: 'proj-1',
  name: 'my-clean-name',
  repoPath: '/Users/foo/projects/my-repo',
  repoPathCanonical: '/Users/foo/projects/my-repo',
  defaultBranch: 'main',
  isDeleted: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('getProjectDisplayName', () => {
  it('returns project.name when it is a clean human-readable string', () => {
    expect(getProjectDisplayName(baseProject)).toBe('my-clean-name');
  });

  it('falls back to repoPathCanonical basename when name looks like a slug (ISSUE-007)', () => {
    const project = { ...baseProject, name: 'reconcile-ws-fG6AeG' };
    expect(getProjectDisplayName(project)).toBe('my-repo');
  });

  it('falls back to repoPath basename when canonical path is missing', () => {
    const project = { ...baseProject, name: 'bad-slug-aBcDeF', repoPathCanonical: '' };
    expect(getProjectDisplayName(project)).toBe('my-repo');
  });

  it('returns the slug name as last resort when all paths are empty', () => {
    const project = {
      ...baseProject,
      name: 'some-slug-XyZabc',
      repoPath: '',
      repoPathCanonical: '',
    };
    expect(getProjectDisplayName(project)).toBe('some-slug-XyZabc');
  });

  it('uses the name as-is when it is a normal directory-like string', () => {
    const project = { ...baseProject, name: 'claude-tauri-boilerplate' };
    expect(getProjectDisplayName(project)).toBe('claude-tauri-boilerplate');
  });

  it('derives a clean name when project was added with a workspace-style slug', () => {
    const project = {
      ...baseProject,
      name: 'workspace-fG6AeG',
      repoPathCanonical: '/home/user/code/awesome-app',
      repoPath: '/home/user/code/awesome-app',
    };
    expect(getProjectDisplayName(project)).toBe('awesome-app');
  });
});
