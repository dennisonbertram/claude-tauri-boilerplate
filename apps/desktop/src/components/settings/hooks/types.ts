import type { HookHandler } from '@claude-tauri/shared';

export type HandlerType = 'command' | 'http' | 'prompt';

export interface AddHookForm {
  event: string;
  matcher: string;
  handlerType: HandlerType;
  command: string;
  timeout: string;
  url: string;
  method: string;
  headers: string;
  prompt: string;
}

export const EMPTY_FORM: AddHookForm = {
  event: '',
  matcher: '',
  handlerType: 'command',
  command: '',
  timeout: '30',
  url: '',
  method: 'POST',
  headers: '',
  prompt: '',
};

export const HANDLER_TYPE_STYLES: Record<HookHandler['type'], { label: string; className: string }> = {
  command: { label: 'command', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  http: { label: 'http', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  prompt: { label: 'prompt', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

export interface HookExecutionLog {
  timestamp: string;
  event: string;
  hookName: string;
  result: 'success' | 'failure';
}
