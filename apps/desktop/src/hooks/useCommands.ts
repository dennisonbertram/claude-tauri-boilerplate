import { useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { rankCommandsByRelevance } from './commandSearch';

export type CommandCategory = 'chat' | 'navigation' | 'tools';

export interface Command {
  name: string;
  description: string;
  category: CommandCategory;
  shortcut?: string;
  execute: () => void | Promise<void>;
}

export interface CommandContext {
  clearChat: () => void;
  createSession: () => void | Promise<void>;
  exportSession: () => void | Promise<void>;
  showSessionList?: () => void;
  showModelSelector?: () => void;
  showCostSummary?: () => void;
  showSettings?: () => void;
  showHelp?: () => void;
  openPullRequests?: () => void;
  showLinearIssues?: () => void;
}

export function useCommands(context: CommandContext) {
  const commands: Command[] = useMemo(
    () => [
      // -- Chat commands --
      {
        name: 'clear',
        description: 'Clear current chat',
        category: 'chat' as CommandCategory,
        shortcut: 'Cmd+L',
        execute: () => context.clearChat(),
      },
      {
        name: 'new',
        description: 'Start a new session',
        category: 'chat' as CommandCategory,
        shortcut: 'Cmd+N',
        execute: () => context.createSession(),
      },
      {
        name: 'sessions',
        description: 'Open session navigation',
        category: 'navigation' as CommandCategory,
        execute: () => context.showSessionList?.(),
      },
      {
        name: 'pr',
        description: 'Open pull requests',
        category: 'navigation' as CommandCategory,
        execute: () => context.openPullRequests?.(),
      },
      {
        name: 'help',
        description: 'Show help and keyboard shortcuts',
        category: 'chat' as CommandCategory,
        shortcut: 'Cmd+?',
        execute: () => context.showHelp?.(),
      },
      // -- Navigation commands --
      {
        name: 'settings',
        description: 'Open settings',
        category: 'navigation' as CommandCategory,
        shortcut: 'Cmd+,',
        execute: () => context.showSettings?.(),
      },

      // -- Tools commands --
      {
        name: 'model',
        description: 'Switch the AI model',
        category: 'tools' as CommandCategory,
        execute: () => context.showModelSelector?.(),
      },
      {
        name: 'cost',
        description: 'Show session cost summary',
        category: 'tools' as CommandCategory,
        execute: () => context.showCostSummary?.(),
      },
      {
        name: 'export',
        description: 'Export current session',
        category: 'tools' as CommandCategory,
        execute: () => context.exportSession(),
      },
      {
        name: 'linear',
        description: 'Browse and attach Linear issues',
        category: 'tools' as CommandCategory,
        execute: () => {
          if (context.showLinearIssues) return context.showLinearIssues();
          toast.info('Linear issue picker is not available here');
        },
      },
      {
        name: 'compact',
        description: 'Compact conversation context',
        category: 'chat' as CommandCategory,
        execute: () => {
          toast.info('Context compaction is automatic', {
            description: 'Configure Auto-Compact in Settings → Advanced',
            duration: 6000,
            action: {
              label: 'Open Settings',
              onClick: () => context.showSettings?.(),
            },
          });
        },
      },
    ],
    [context]
  );

  const filterCommands = useCallback(
    (query: string): Command[] => {
      if (!query) return commands;
      return rankCommandsByRelevance(commands, query);
    },
    [commands]
  );

  return { commands, filterCommands };
}
