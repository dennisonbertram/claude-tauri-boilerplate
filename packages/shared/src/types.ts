export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  plan?: string;
  error?: string;
}

export interface Session {
  id: string;
  title: string;
  claudeSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionId?: string;
}
