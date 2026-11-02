// The screen kept on (Wake Lock) while a tool needs it, taken back when the page shows again, and full
// screen where the browser has it for a page (not the iPhone: there a tool's stage covers the window
// instead). Timers, the teleprompter and the flip clock use it.

export type AwakeNote = '' | 'on' | 'off' | 'denied';

export class Awake {
  /** '' when not asked, 'on' while held, 'off' when the browser has no Wake Lock, 'denied' when it refused. */
  note = $state<AwakeNote>('');
  #want = false;
  #sentinel: WakeLockSentinel | null = null;
  #onVisible = () => {
    if (document.visibilityState === 'visible' && this.#want) void this.#take();
  };

  constructor() {
    document.addEventListener('visibilitychange', this.#onVisible);
  }

  /** Keep the screen on, or let it go. */
  set(on: boolean): Promise<void> {
    this.#want = on;
    return on ? this.#take() : this.#drop();
  }

  /** Let it go for good (the tool closes). */
  destroy(): void {
    document.removeEventListener('visibilitychange', this.#onVisible);
    void this.set(false);
  }

  async #take() {
    if (!('wakeLock' in navigator)) {
      this.note = 'off';
      return;
    }
    if (this.#sentinel || document.visibilityState !== 'visible') return;
    try {
      const s = await navigator.wakeLock.request('screen');
      if (!this.#want) {
        void s.release().catch(() => {});
        return;
      }
      this.#sentinel = s;
      this.note = 'on';
      // The browser lets it go when the tab is hidden; visibilitychange takes it back.
      s.addEventListener('release', () => {
        if (this.#sentinel === s) this.#sentinel = null;
      });
    } catch {
      this.note = 'denied';
    }
  }

  async #drop() {
    this.note = '';
    const s = this.#sentinel;
    this.#sentinel = null;
    try {
      await s?.release();
    } catch {}
  }
}

type FsDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsElement = Element & { webkitRequestFullscreen?: () => Promise<void> | void };

/** Whether the browser can put a page's element in full screen (not the iPhone). */
export function canFullscreen(): boolean {
  const d = document as FsDocument;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function fullscreenElement(): Element | null {
  const d = document as FsDocument;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** Full screen for an element; false when the browser refused or can't. */
export async function enterFullscreen(el: Element): Promise<boolean> {
  const e = el as FsElement;
  try {
    if (e.requestFullscreen) await e.requestFullscreen();
    else if (e.webkitRequestFullscreen) await e.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FsDocument;
  try {
    if (!fullscreenElement()) return;
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
  } catch {}
}

/** Calls `back` whenever full screen ends (Esc, the browser's own button). Returns the unsubscribe. */
export function onFullscreenChange(back: (on: boolean) => void): () => void {
  const fire = () => back(Boolean(fullscreenElement()));
  document.addEventListener('fullscreenchange', fire);
  document.addEventListener('webkitfullscreenchange', fire);
  return () => {
    document.removeEventListener('fullscreenchange', fire);
    document.removeEventListener('webkitfullscreenchange', fire);
  };
}
