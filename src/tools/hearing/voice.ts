// One tone: an oscillator through a gain and a stereo panner. Every start and stop ramps over
// 30 ms (no click), changes glide, and the gain is clamped to the ceiling whatever it's asked for.

import { CEILING, type Wave } from './hearing.ts';

const RAMP = 0.03;

export interface VoiceOptions {
  hz: number;
  wave: Wave;
  level: number;
  /** −1 left … 1 right. */
  pan: number;
}

export class Voice {
  private ctx: AudioContext;
  private osc: OscillatorNode;
  private gain: GainNode;
  private panner: StereoPannerNode | null;
  private stopped = false;

  /** Whether this browser can put the tone in one ear. */
  readonly pans: boolean;

  constructor(ctx: AudioContext, o: VoiceOptions) {
    this.ctx = ctx;
    this.osc = ctx.createOscillator();
    this.osc.type = o.wave;
    this.gain = ctx.createGain();
    this.panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    this.pans = this.panner !== null;
    const t = ctx.currentTime;
    this.osc.frequency.setValueAtTime(o.hz, t);
    this.gain.gain.setValueAtTime(0, t);
    this.gain.gain.linearRampToValueAtTime(safe(o.level), t + RAMP);
    this.osc.connect(this.gain);
    if (this.panner) {
      this.panner.pan.setValueAtTime(o.pan, t);
      this.gain.connect(this.panner).connect(ctx.destination);
    } else this.gain.connect(ctx.destination);
    this.osc.start(t);
  }

  /** Climbs exponentially from `from` to `to` over `seconds`, starting now. */
  sweep(from: number, to: number, seconds: number) {
    const t = this.ctx.currentTime;
    const f = this.osc.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(from, t);
    f.exponentialRampToValueAtTime(to, t + seconds);
  }

  /** A new frequency, glided to. */
  glide(hz: number) {
    if (this.stopped) return;
    const t = this.ctx.currentTime;
    this.osc.frequency.cancelScheduledValues(t);
    this.osc.frequency.setTargetAtTime(hz, t, 0.03);
  }

  level(level: number) {
    if (this.stopped) return;
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(safe(level), t, 0.02);
  }

  pan(pan: number) {
    if (this.stopped || !this.panner) return;
    this.panner.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.02);
  }

  wave(wave: Wave, level: number) {
    if (this.stopped) return;
    this.osc.type = wave;
    this.level(level);
  }

  /** Fades out over 30 ms and lets go of the nodes. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    const g = this.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(safe(g.value), t);
    g.linearRampToValueAtTime(0, t + RAMP);
    this.osc.onended = () => {
      this.osc.disconnect();
      this.gain.disconnect();
      this.panner?.disconnect();
    };
    try {
      this.osc.stop(t + RAMP + 0.02);
    } catch {}
  }
}

const safe = (level: number) => (Number.isFinite(level) ? Math.min(CEILING, Math.max(0, level)) : 0);
