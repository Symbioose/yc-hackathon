// Self-contained WebAudio SFX. No audio files to load = nothing to break live.
// Chiptune-style blips synthesized on the fly. Honors a global mute flag.

type Wave = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  // Call from a user gesture to unlock audio on browsers that block autoplay.
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.32;
  }

  private tone(freq: number, dur: number, wave: Wave, vol = 1, slideTo?: number, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol = 1, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;
    src.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  // ---- Named cues mapped to choreography beats ----
  dispatch() { this.tone(220, 0.12, "square", 0.6, 660); }
  stampOk() { this.tone(523, 0.06, "square", 0.7); this.tone(784, 0.1, "square", 0.7, undefined, 0.06); }
  stampBad() { this.tone(180, 0.22, "sawtooth", 0.8, 70); }
  mask() { this.tone(440, 0.14, "triangle", 0.5, 160); }
  launch() { this.tone(180, 0.18, "square", 0.5, 720); this.noise(0.12, 0.25); }
  blip() { this.tone(880, 0.05, "square", 0.4); }
  loot() { this.tone(660, 0.05, "square", 0.6); this.tone(990, 0.08, "square", 0.6, undefined, 0.05); }
  orb() { this.tone(330, 0.5, "sine", 0.5, 880); }
  alarm() {
    for (let i = 0; i < 4; i++) this.tone(880, 0.1, "sawtooth", 0.8, 440, i * 0.13);
    this.noise(0.3, 0.4);
  }
  incinerate() { this.tone(300, 0.4, "sawtooth", 0.7, 40); this.noise(0.4, 0.5); }
  sanitize() { this.tone(700, 0.18, "sine", 0.4, 1400); }
  sign() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, "square", 0.6, undefined, i * 0.08)); }
  block() { this.tone(140, 0.07, "square", 0.5); }
  sealed() { [784, 1047].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.6, undefined, i * 0.1)); }
  tamper() { this.tone(200, 0.5, "sawtooth", 0.9, 50); this.noise(0.5, 0.6); }
}

export const sfx = new Sfx();
