/**
 * Notification service for desktop notifications and sounds.
 *
 * Uses the browser Notification API (works in Tauri webview) and
 * the Web Audio API for programmatic sound generation.
 */

export type NotificationSound = 'none' | 'chime' | 'beep';

/**
 * Request browser notification permission.
 * Returns the resulting permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!window.Notification) {
    return 'denied';
  }
  if (window.Notification.permission === 'granted') {
    return 'granted';
  }
  return window.Notification.requestPermission();
}

/**
 * Send a desktop notification if permission is granted.
 * Silently no-ops if permission is not granted or API is unavailable.
 */
export function sendNotification(title: string, body: string): void {
  if (!window.Notification) return;
  if (window.Notification.permission !== 'granted') return;
  new window.Notification(title, { body });
}

/**
 * Play a notification sound using the Web Audio API.
 * 'none' — no sound
 * 'beep' — short sine wave beep
 * 'chime' — two-tone chime
 */
export function playNotificationSound(sound: NotificationSound): void {
  if (sound === 'none') return;

  try {
    const AudioCtx = window.AudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (sound === 'beep') {
      playBeep(ctx, 880, 0, 0.15);
    } else if (sound === 'chime') {
      // Two-tone chime: a higher note followed by a lower one
      playBeep(ctx, 1046.5, 0, 0.15); // C6
      playBeep(ctx, 783.99, 0.18, 0.2); // G5
    }

    // Close the context after all sounds finish
    setTimeout(() => {
      ctx.close().catch(() => {
        // ignore close errors
      });
    }, 600);
  } catch {
    // AudioContext may be unavailable in some environments (e.g., tests)
  }
}

function playBeep(
  ctx: AudioContext,
  frequency: number,
  startOffset: number,
  duration: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.value = frequency;

  const start = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.25, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  osc.start(start);
  osc.stop(start + duration + 0.05);
}
