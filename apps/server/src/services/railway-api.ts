const RAILWAY_GRAPHQL_URL = 'https://backboard.railway.app/graphql/v2';

export async function queryRailwayDeployments(
  token: string,
  projectId: string,
  serviceId: string,
  environmentId: string
): Promise<{
  lastDeploymentStatus: 'success' | 'failed' | 'building' | 'deploying' | null;
  lastDeploymentId: string | null;
  lastDeploymentCreatedAt: string | null;
}> {
  const query = `
    query GetDeployments($projectId: String!, $serviceId: String!, $environmentId: String!) {
      deployments(first: 1, projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId) {
        edges { node { id status createdAt } }
      }
    }
  `;
  const res = await fetch(RAILWAY_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { projectId, serviceId, environmentId } }),
  });
  if (!res.ok) throw new Error(`Railway API error: ${res.status}`);
  const data = await res.json() as any;
  if (data.errors) throw new Error(`Railway GraphQL error: ${data.errors[0]?.message}`);
  const node = data.data?.deployments?.edges?.[0]?.node;
  return {
    lastDeploymentStatus: mapRailwayStatus(node?.status),
    lastDeploymentId: node?.id ?? null,
    lastDeploymentCreatedAt: node?.createdAt ?? null,
  };
}

export async function fetchRailwayDeploymentLogs(
  token: string,
  deploymentId: string,
  limit: number = 50
): Promise<{ entries: Array<{ timestamp: string; level: string; message: string }>; total: number }> {
  const res = await fetch(`https://backboard.railway.app/api/v1/deployments/${deploymentId}/logs?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Railway logs API error: ${res.status}`);
  const data = await res.json() as any;
  const entries = Array.isArray(data) ? data : (data.logs ?? []);
  return {
    entries: entries.slice(0, limit).map((e: any) => ({
      timestamp: e.timestamp ?? e.ts ?? new Date().toISOString(),
      level: e.level ?? 'info',
      message: e.message ?? e.msg ?? String(e),
    })),
    total: entries.length,
  };
}

function mapRailwayStatus(status: string | undefined): 'success' | 'failed' | 'building' | 'deploying' | null {
  switch (status?.toUpperCase()) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'failed';
    case 'BUILDING': return 'building';
    case 'DEPLOYING': return 'deploying';
    default: return null;
  }
}
