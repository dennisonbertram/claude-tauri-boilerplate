export const routes = {
  chat: (sessionId?: string) => (sessionId ? `/chat/${sessionId}` : '/chat'),
  workspaces: (projectId?: string) =>
    projectId ? `/workspaces/${projectId}` : '/workspaces',
  teams: (teamId?: string) => (teamId ? `/teams/${teamId}` : '/teams'),
  agents: (profileId?: string) =>
    profileId ? `/agents/${profileId}` : '/agents',
  documents: '/documents',
  tracker: '/tracker',
  finance: '/finance',
} as const;

export type ActiveView =
  | 'chat'
  | 'teams'
  | 'workspaces'
  | 'agents'
  | 'documents'
  | 'tracker'
  | 'finance';

export function pathToView(pathname: string): ActiveView {
  if (pathname.startsWith('/workspaces')) return 'workspaces';
  if (pathname.startsWith('/teams')) return 'teams';
  if (pathname.startsWith('/agents')) return 'agents';
  if (pathname.startsWith('/documents')) return 'documents';
  if (pathname.startsWith('/tracker')) return 'tracker';
  if (pathname.startsWith('/finance')) return 'finance';
  return 'chat';
}
