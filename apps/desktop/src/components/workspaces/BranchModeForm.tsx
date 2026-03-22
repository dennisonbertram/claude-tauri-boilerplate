import { SpinnerGap } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import type { GithubBranch } from '@/lib/workspace-api';

interface BranchModeFormProps {
  branches: GithubBranch[];
  branchLoading: boolean;
  branchError: string | null;
  selectedBranch: string;
  onSelectedBranchChange: (value: string) => void;
  workspaceName: string;
  onWorkspaceNameChange: (value: string) => void;
}

export function BranchModeForm({
  branches,
  branchLoading,
  branchError,
  selectedBranch,
  onSelectedBranchChange,
  workspaceName,
  onWorkspaceNameChange,
}: BranchModeFormProps) {
  return (
    <>
      <div>
        <label className="text-sm font-medium text-foreground">Select Branch</label>
        {branchLoading ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <SpinnerGap className="h-4 w-4 animate-spin" />
            Loading branches...
          </div>
        ) : branchError ? (
          <p className="mt-2 text-sm text-destructive">{branchError}</p>
        ) : (
          <select
            className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            value={selectedBranch}
            onChange={(e) => onSelectedBranchChange(e.target.value)}
          >
            <option value="" disabled>Select a branch...</option>
            {branches.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Workspace Name</label>
        <Input
          type="text"
          placeholder="my-workspace"
          value={workspaceName}
          onChange={(e) => onWorkspaceNameChange(e.target.value)}
          className="mt-1"
        />
      </div>
    </>
  );
}
