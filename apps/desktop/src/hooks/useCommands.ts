import { useMemo, useCallback } from 'react';
import { toast } from 'sonner';

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
  showModelSelector?: () => void;
  showCostSummary?: () => void;
  showSettings?: () => void;
  showHelp?: () => void;
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
      const q = query.toLowerCase();
      return commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q)
      );
    },
    [commands]
  );

  return { commands, filterCommands };
}
