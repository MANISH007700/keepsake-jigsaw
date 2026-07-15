"use client";

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const MUSIC_NOTES = [220, 261.63, 293.66, 329.63, 392, 329.63, 293.66, 261.63];

class KeepsakeSoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNodes = new Set<OscillatorNode>();
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopMusic();
  }

  activate() {
    if (!this.enabled) return;
    const context = this.getContext();
    if (context?.state === "suspended") void context.resume().catch(() => undefined);
  }

  startMusic() {
    if (!this.enabled || this.musicTimer !== null) return;
    const context = this.getContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);

    this.musicGain = context.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, context.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(0.42, context.currentTime + 0.8);
    this.musicGain.connect(this.master!);
    this.scheduleMusicPhrase();
    this.musicTimer = window.setInterval(() => this.scheduleMusicPhrase(), 3200);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    const context = this.context;
    const musicGain = this.musicGain;
    const nodesToStop = [...this.musicNodes];
    nodesToStop.forEach((node) => this.musicNodes.delete(node));
    if (context && musicGain) {
      musicGain.gain.cancelScheduledValues(context.currentTime);
      musicGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.08);
    }
    window.setTimeout(() => {
      nodesToStop.forEach((node) => {
        try { node.stop(); } catch { /* The note may already have ended. */ }
      });
      musicGain?.disconnect();
    }, 450);
    this.musicGain = null;
  }

  playSnap() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    this.tone(540, now, 0.09, 0.34, "triangle", 300);
    this.tone(190, now, 0.065, 0.24, "sine", 115);
  }

  playMiss() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    this.tone(150, now, 0.16, 0.27, "sine", 92);
    this.tone(112, now + 0.025, 0.14, 0.18, "triangle", 78);
  }

  playPickup() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    this.tone(230, now, 0.045, 0.21, "triangle", 360);
    this.tone(720, now + 0.018, 0.035, 0.14, "sine", 560);
  }

  playShuffle() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    [180, 235, 310, 410].forEach((frequency, index) => {
      this.tone(frequency, now + index * 0.045, 0.13, 0.2, "triangle", frequency * 1.45);
    });
  }

  playRotate() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    this.tone(390, now, 0.06, 0.23, "square", 560);
    this.tone(620, now + 0.055, 0.045, 0.18, "triangle", 470);
  }

  playHint() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    [660, 880, 1100].forEach((frequency, index) => {
      this.tone(frequency, now + index * 0.07, 0.28, 0.17, "sine");
    });
  }

  playPause() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    this.tone(440, now, 0.22, 0.24, "sine", 220);
    this.tone(330, now + 0.04, 0.22, 0.18, "triangle", 165);
  }

  playResume() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    this.tone(220, now, 0.18, 0.25, "sine", 440);
    this.tone(330, now + 0.08, 0.2, 0.19, "triangle", 660);
  }

  playTimerPulse() {
    const context = this.readyContext();
    if (!context) return;
    this.tone(920, context.currentTime, 0.055, 0.16, "sine", 760);
  }

  playComplete() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    [261.63, 329.63, 392, 523.25].forEach((frequency, index) => {
      this.tone(frequency, now + index * 0.115, 0.75, 0.28, "sine");
      this.tone(frequency * 2, now + index * 0.115, 0.5, 0.13, "triangle");
    });
  }

  private getContext() {
    if (this.context) return this.context;
    try {
      const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.limiter = this.context.createDynamicsCompressor();
      this.master.gain.value = 1;
      this.limiter.threshold.value = -10;
      this.limiter.knee.value = 12;
      this.limiter.ratio.value = 5;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.22;
      this.master.connect(this.limiter).connect(this.context.destination);
      return this.context;
    } catch {
      return null;
    }
  }

  private readyContext() {
    if (!this.enabled) return null;
    const context = this.getContext();
    if (context?.state === "suspended") void context.resume().catch(() => undefined);
    return context;
  }

  private scheduleMusicPhrase() {
    const context = this.context;
    const destination = this.musicGain;
    if (!context || !destination || !this.enabled) return;
    const start = context.currentTime + 0.04;
    const rootIndex = this.musicStep % MUSIC_NOTES.length;
    const notes = [MUSIC_NOTES[rootIndex], MUSIC_NOTES[(rootIndex + 2) % MUSIC_NOTES.length]];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency / (index + 1), start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.24 : 0.11, start + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.9);
      oscillator.connect(gain).connect(destination);
      this.musicNodes.add(oscillator);
      oscillator.addEventListener("ended", () => this.musicNodes.delete(oscillator));
      oscillator.start(start);
      oscillator.stop(start + 3);
    });
    this.musicStep = (this.musicStep + 1) % MUSIC_NOTES.length;
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    endFrequency?: number,
  ) {
    const context = this.context;
    if (!context || !this.master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }
}

export const soundEngine = new KeepsakeSoundEngine();
