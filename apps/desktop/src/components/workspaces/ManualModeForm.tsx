import { SpinnerGap, FolderOpen } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isTauri } from '@/lib/platform';

interface ManualModeFormProps {
  name: string;
  onNameChange: (value: string) => void;
  nameError: string;
  baseBranch: string;
  onBaseBranchChange: (value: string) => void;
  sourceBranch: string;
  onSourceBranchChange: (value: string) => void;
  defaultBranch: string;
  folderPath: string;
  onFolderPathChange: (value: string) => void;
  localBranches: { name: string }[];
  branchesLoading: boolean;
  onBrowseFolder: () => void;
}

export function ManualModeForm({
  name,
  onNameChange,
  nameError,
  baseBranch,
  onBaseBranchChange,
  sourceBranch,
  onSourceBranchChange,
  defaultBranch,
  folderPath,
  onFolderPathChange,
  localBranches,
  branchesLoading,
  onBrowseFolder,
}: ManualModeFormProps) {
  return (
    <>
      <div>
        <label className="text-sm font-medium text-foreground">Repository Path</label>
        <div className="mt-1 flex gap-2">
          <Input
            type="text"
            placeholder="/path/to/repo or leave blank to use project default"
            value={folderPath}
            onChange={(e) => onFolderPathChange(e.target.value)}
            className="flex-1 text-xs"
          />
          {isTauri() && (
            <Button type="button" variant="outline" size="sm" onClick={onBrowseFolder}>
              <FolderOpen className="h-3.5 w-3.5 mr-1" />
              Browse
            </Button>
          )}
        </div>
        {branchesLoading && (
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <SpinnerGap className="h-3 w-3 animate-spin" /> Detecting branches...
          </p>
        )}
        {!branchesLoading && localBranches.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{localBranches.length} branches detected</p>
        )}
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Name</label>
        <Input
          type="text"
          placeholder="my-feature"
          value={name}
          onChange={(e) => { onNameChange(e.target.value); }}
          className="mt-1"
          autoFocus
        />
        {nameError && <p className="text-sm text-destructive mt-1">{nameError}</p>}
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Base Branch</label>
        {localBranches.length > 0 ? (
          <select
            className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            value={baseBranch}
            onChange={(e) => onBaseBranchChange(e.target.value)}
          >
            <option value="">{defaultBranch} (default)</option>
            {localBranches.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        ) : (
          <Input
            type="text"
            placeholder={defaultBranch}
            value={baseBranch}
            onChange={(e) => onBaseBranchChange(e.target.value)}
            className="mt-1"
          />
        )}
        <p className="mt-1 text-xs text-muted-foreground">Defaults to {defaultBranch}</p>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Source Branch (optional)</label>
        {localBranches.length > 0 ? (
          <select
            className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            value={sourceBranch}
            onChange={(e) => onSourceBranchChange(e.target.value)}
          >
            <option value="">{defaultBranch} (default)</option>
            {localBranches.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        ) : (
          <Input
            type="text"
            placeholder="feature/auth"
            value={sourceBranch}
            onChange={(e) => onSourceBranchChange(e.target.value)}
            className="mt-1"
          />
        )}
        <p className="mt-1 text-xs text-muted-foreground">Optional custom branch to base this workspace on.</p>
      </div>
    </>
  );
}
