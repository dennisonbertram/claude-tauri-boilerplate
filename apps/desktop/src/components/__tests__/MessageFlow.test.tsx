import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageFlow } from '../teams/MessageFlow';
import type { TeamMessage } from '@claude-tauri/shared';

const mockMessages: TeamMessage[] = [
  {
    id: 'msg-1',
    from: 'researcher',
    to: 'coder',
    content: 'Found the root cause',
    timestamp: '2026-03-15T10:00:00Z',
    type: 'message',
  },
  {
    id: 'msg-2',
    from: 'team-lead',
    to: 'all',
    content: 'Time to wrap up',
    timestamp: '2026-03-15T10:01:00Z',
    type: 'broadcast',
  },
  {
    id: 'msg-3',
    from: 'team-lead',
    to: 'coder',
    content: 'Please stop now',
    timestamp: '2026-03-15T10:02:00Z',
    type: 'shutdown_request',
  },
];

describe('MessageFlow', () => {
  it('renders the message flow container', () => {
    render(<MessageFlow messages={[]} />);
    expect(screen.getByTestId('message-flow')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<MessageFlow messages={[]} />);
    expect(screen.getByTestId('message-empty')).toHaveTextContent('No messages yet');
  });

  it('renders all messages', () => {
    render(<MessageFlow messages={mockMessages} />);
    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-3')).toBeInTheDocument();
  });

  it('shows correct type labels', () => {
    render(<MessageFlow messages={mockMessages} />);
    expect(screen.getByTestId('message-type-msg-1')).toHaveTextContent('DM');
    expect(screen.getByTestId('message-type-msg-2')).toHaveTextContent('Broadcast');
    expect(screen.getByTestId('message-type-msg-3')).toHaveTextContent('Shutdown');
  });

  it('applies color coding per message type', () => {
    render(<MessageFlow messages={mockMessages} />);

    // Check that message type badges have appropriate classes
    const dmBadge = screen.getByTestId('message-type-msg-1');
    expect(dmBadge.className).toContain('text-blue-400');

    const broadcastBadge = screen.getByTestId('message-type-msg-2');
    expect(broadcastBadge.className).toContain('text-purple-400');

    const shutdownBadge = screen.getByTestId('message-type-msg-3');
    expect(shutdownBadge.className).toContain('text-red-400');
  });

  it('filters messages by agent name', () => {
    render(<MessageFlow messages={mockMessages} />);

    const filterInput = screen.getByTestId('message-filter');
    fireEvent.change(filterInput, { target: { value: 'researcher' } });

    // Only msg-1 has "researcher" in from or to
    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.queryByTestId('message-msg-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-msg-3')).not.toBeInTheDocument();
  });

  it('shows message count', () => {
    render(<MessageFlow messages={mockMessages} />);
    // Should show total count
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows filtered count', () => {
    render(<MessageFlow messages={mockMessages} />);
    const filterInput = screen.getByTestId('message-filter');
    fireEvent.change(filterInput, { target: { value: 'researcher' } });
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
