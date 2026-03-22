/**
 * In-memory per-workspace operation lock to prevent concurrent mutations.
 *
 * If a second operation is attempted while one is already in-flight, the caller
 * receives a 423 LOCKED response immediately rather than queuing.
 */

const workspaceOperationLocks = new Map<string, Promise<unknown>>();

export async function withWorkspaceOperationLock<T>(
  workspaceId: string,
  operation: () => Promise<T>
): Promise<T> {
  if (workspaceOperationLocks.has(workspaceId)) {
    throw Object.assign(
      new Error(`Workspace '${workspaceId}' is already being operated on`),
      { status: 423, code: 'LOCKED' }
    );
  }

  const pending = operation();
  workspaceOperationLocks.set(workspaceId, pending);

  try {
    return await pending;
  } finally {
    if (workspaceOperationLocks.get(workspaceId) === pending) {
      workspaceOperationLocks.delete(workspaceId);
    }
  }
}
