// The page's one AudioContext. iOS starts sound only from a tap, so a tool calls `unlockAudio()` in
// its tap handler and plays afterwards. `playback: true` sets Safari's audio session to playback, so
// the ring/silent switch doesn't mute it (the hearing test); Timers leaves the session as it is.

type Session = { type: string };

let context: AudioContext | null = null;

export function unlockAudio(options: { playback?: boolean } = {}): AudioContext | null {
  try {
    const session = (navigator as Navigator & { audioSession?: Session }).audioSession;
    if (options.playback && session && session.type !== 'playback') session.type = 'playback';
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!context && Ctx) context = new Ctx();
    if (context?.state === 'suspended') void context.resume().catch(() => {});
  } catch {
    context = null;
  }
  return context;
}
