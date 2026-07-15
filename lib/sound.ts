"use client";

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const MUSIC_NOTES = [220, 261.63, 293.66, 329.63, 392, 329.63, 293.66, 261.63];

class KeepsakeSoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
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
    this.musicGain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.8);
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
    this.tone(510, now, 0.07, 0.12, "triangle", 300);
    this.tone(180, now, 0.045, 0.065, "sine", 120);
  }

  playMiss() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    this.tone(145, now, 0.12, 0.07, "sine", 105);
    this.tone(112, now + 0.025, 0.11, 0.04, "triangle", 92);
  }

  playTimerPulse() {
    const context = this.readyContext();
    if (!context) return;
    this.tone(880, context.currentTime, 0.035, 0.022, "sine", 760);
  }

  playComplete() {
    const context = this.readyContext();
    if (!context) return;
    const now = context.currentTime;
    [261.63, 329.63, 392, 523.25].forEach((frequency, index) => {
      this.tone(frequency, now + index * 0.115, 0.65, 0.095, "sine");
      this.tone(frequency * 2, now + index * 0.115, 0.42, 0.025, "triangle");
    });
  }

  private getContext() {
    if (this.context) return this.context;
    try {
      const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.context.destination);
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
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.17 : 0.055, start + 0.35);
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
