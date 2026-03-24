import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  requestNotificationPermission,
  sendNotification,
  playNotificationSound,
} from '../notifications';

// ─── Notification API mock setup ─────────────────────────────────────────────

function installNotificationMock(permission: NotificationPermission) {
  const instances: Array<{ title: string; body: string }> = [];
  const requestPermission = vi.fn(async () => permission);

  class MockNotification {
    static permission: NotificationPermission = permission;
    static requestPermission = requestPermission;
    title: string;
    body: string;
    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      this.body = options?.body ?? '';
      instances.push({ title: this.title, body: this.body });
    }
  }

  Object.defineProperty(window, 'Notification', {
    value: MockNotification,
    writable: true,
    configurable: true,
  });

  return { instances, requestPermission };
}

// ─── AudioContext mock setup ──────────────────────────────────────────────────

type OscSpy = {
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  frequency: { value: number };
  type: string;
};

type GainSpy = {
  connect: ReturnType<typeof vi.fn>;
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
};

type MockCtx = {
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  destination: object;
  currentTime: number;
  close: ReturnType<typeof vi.fn>;
  oscillators: OscSpy[];
};

function installAudioContextMock(): { ctxInstances: MockCtx[]; AudioContextSpy: ReturnType<typeof vi.fn> } {
  const ctxInstances: MockCtx[] = [];

  function makeCtx(): MockCtx {
    const osc: OscSpy = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 0 },
      type: 'sine',
    };
    const gain: GainSpy = {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
    const ctx: MockCtx = {
      createOscillator: vi.fn(() => osc),
      createGain: vi.fn(() => gain),
      destination: {},
      currentTime: 0,
      close: vi.fn(async () => {}),
      oscillators: [osc],
    };
    return ctx;
  }

  // Must be a real function used with `new`
  const AudioContextSpy = vi.fn(function MockAudioContextConstructor(this: MockCtx) {
    const ctx = makeCtx();
    ctxInstances.push(ctx);
    Object.assign(this, ctx);
  });

  Object.defineProperty(window, 'AudioContext', {
    value: AudioContextSpy,
    writable: true,
    configurable: true,
  });

  return { ctxInstances, AudioContextSpy };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('requestNotificationPermission', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Notification.requestPermission when permission is default', async () => {
    const { requestPermission } = installNotificationMock('default');
    await requestNotificationPermission();
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it('returns immediately with granted when already granted — no requestPermission call', async () => {
    const { requestPermission } = installNotificationMock('granted');
    const result = await requestNotificationPermission();
    expect(result).toBe('granted');
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('returns denied when Notification API is unavailable', async () => {
    Object.defineProperty(window, 'Notification', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const result = await requestNotificationPermission();
    expect(result).toBe('denied');
  });
});

describe('sendNotification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Notification when permission is granted', () => {
    const { instances } = installNotificationMock('granted');
    sendNotification('Task complete', 'workspace/branch finished');
    expect(instances).toHaveLength(1);
    expect(instances[0].title).toBe('Task complete');
    expect(instances[0].body).toBe('workspace/branch finished');
  });

  it('does not create a Notification when permission is denied', () => {
    const { instances } = installNotificationMock('denied');
    sendNotification('Task complete', 'body text');
    expect(instances).toHaveLength(0);
  });

  it('does not create a Notification when permission is default (not yet requested)', () => {
    const { instances } = installNotificationMock('default');
    sendNotification('Task complete', 'body text');
    expect(instances).toHaveLength(0);
  });

  it('does nothing when Notification API is unavailable', () => {
    Object.defineProperty(window, 'Notification', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    // Must not throw
    expect(() => sendNotification('title', 'body')).not.toThrow();
  });
});

describe('playNotificationSound', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not create an AudioContext when sound is none', () => {
    const { AudioContextSpy } = installAudioContextMock();
    playNotificationSound('none');
    expect(AudioContextSpy).not.toHaveBeenCalled();
  });

  it('creates an AudioContext and starts oscillator for sound=beep', () => {
    const { ctxInstances } = installAudioContextMock();
    playNotificationSound('beep');
    expect(ctxInstances).toHaveLength(1);
    const ctx = ctxInstances[0];
    expect(ctx.createOscillator).toHaveBeenCalledOnce();
    const osc = ctx.createOscillator.mock.results[0].value as OscSpy;
    expect(osc.start).toHaveBeenCalled();
  });

  it('creates an AudioContext and plays two oscillators for sound=chime', () => {
    const { ctxInstances } = installAudioContextMock();
    playNotificationSound('chime');
    expect(ctxInstances).toHaveLength(1);
    const ctx = ctxInstances[0];
    // Chime plays two notes
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('does not throw when AudioContext is unavailable', () => {
    Object.defineProperty(window, 'AudioContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => playNotificationSound('beep')).not.toThrow();
  });

  it('does not throw when AudioContext is unavailable for chime', () => {
    Object.defineProperty(window, 'AudioContext', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => playNotificationSound('chime')).not.toThrow();
  });
});
