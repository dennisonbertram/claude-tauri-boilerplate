import { useState, useRef } from 'react';
import { SpinnerGap, CaretDown, CaretRight, X, ClockCounterClockwise } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Input } from '@/components/ui/input';
import type { GithubIssue } from '@/lib/workspace-api';

interface GithubIssueModeFormProps {
  issueQuery: string;
  onIssueQueryChange: (value: string) => void;
  issues: GithubIssue[];
  issueLoading: boolean;
  issueError: string | null;
  selectedIssue: GithubIssue | null;
  onSelectIssue: (issue: GithubIssue) => void;
  workspaceName: string;
  onWorkspaceNameChange: (value: string) => void;
  issueBranch: string;
  onIssueBranchChange: (value: string) => void;
  searchHistory?: string[];
  onRemoveHistory?: (query: string) => void;
  onClearHistory?: () => void;
}

export function GithubIssueModeForm({
  issueQuery,
  onIssueQueryChange,
  issues,
  issueLoading,
  issueError,
  selectedIssue,
  onSelectIssue,
  workspaceName,
  onWorkspaceNameChange,
  issueBranch,
  onIssueBranchChange,
  searchHistory = [],
  onRemoveHistory,
  onClearHistory,
}: GithubIssueModeFormProps) {
  const [expandedIssue, setExpandedIssue] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasHistory = searchHistory.length > 0;
  const shouldShowHistory = showHistory && hasHistory && !issueQuery.trim();

  return (
    <>
      <div className="relative">
        <label className="text-sm font-medium text-foreground">Search Issues</label>
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search by title or number..."
          value={issueQuery}
          onChange={(e) => onIssueQueryChange(e.target.value)}
          onFocus={() => setShowHistory(true)}
          onBlur={() => {
            // Delay to allow click on history items
            setTimeout(() => setShowHistory(false), 200);
          }}
          className="mt-1"
          autoFocus
        />
        {shouldShowHistory && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ClockCounterClockwise className="h-3 w-3" />
                Recent searches
              </span>
              {onClearHistory && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onClearHistory()}
                >
                  Clear all
                </button>
              )}
            </div>
            {searchHistory.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onIssueQueryChange(item);
                  setShowHistory(false);
                }}
              >
                <span className="text-sm truncate flex-1">{item}</span>
                {onRemoveHistory && (
                  <button
                    type="button"
                    className="p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveHistory(item);
                    }}
                    title="Remove from history"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="max-h-64 overflow-auto rounded-md border border-border">
        {issueLoading ? (
          <div className="p-3 flex items-center gap-2 text-sm text-muted-foreground">
            <SpinnerGap className="h-4 w-4 animate-spin" />
            Loading issues...
          </div>
        ) : issueError ? (
          <p className="p-3 text-sm text-destructive">{issueError}</p>
        ) : issues.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No issues found. Try a different search.</p>
        ) : (
          issues.map((issue) => {
            const isActive = selectedIssue?.number === issue.number;
            const isExpanded = expandedIssue === issue.number;
            return (
              <div key={issue.number} className={`border-b border-border last:border-b-0 ${isActive ? 'bg-primary/10' : ''}`}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left transition-colors ${
                    isActive ? '' : 'hover:bg-accent'
                  }`}
                  onClick={() => onSelectIssue(issue)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">#{issue.number}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      issue.state === 'OPEN' ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-500'
                    }`}>{issue.state}</span>
                    {issue.body && (
                      <button
                        type="button"
                        className="ml-auto p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedIssue(isExpanded ? null : issue.number);
                        }}
                        title={isExpanded ? 'Collapse preview' : 'Expand preview'}
                      >
                        {isExpanded ? <CaretDown className="h-3.5 w-3.5" /> : <CaretRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm font-medium truncate">{issue.title}</div>
                </button>
                {isExpanded && issue.body && (
                  <div className="px-3 pb-2">
                    <div className="rounded border border-border bg-muted/30 p-2 text-xs prose prose-xs dark:prose-invert max-w-none max-h-40 overflow-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.body}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {selectedIssue && (
        <>
          <div>
            <label className="text-sm font-medium text-foreground">Workspace Name</label>
            <Input
              type="text"
              value={workspaceName}
              onChange={(e) => onWorkspaceNameChange(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Auto-filled from issue title. You can edit this.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Branch Name</label>
            <Input
              type="text"
              value={issueBranch}
              onChange={(e) => onIssueBranchChange(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">Branch will be created as <code className="text-xs bg-muted px-1 rounded">issue/{issueBranch}</code></p>
          </div>
        </>
      )}
    </>
  );
}
