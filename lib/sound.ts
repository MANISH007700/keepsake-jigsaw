"use client";

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const MEMORY_CHORDS = [
  { chord: [130.81, 164.81, 196, 246.94], melody: [523.25, 493.88] }, // Cmaj7
  { chord: [123.47, 146.83, 196, 220], melody: [440, 392] }, // G6/B
  { chord: [110, 130.81, 164.81, 196], melody: [392, 329.63] }, // Am7
  { chord: [98, 123.47, 146.83, 164.81], melody: [369.99, 392] }, // Em7/G
  { chord: [87.31, 110, 130.81, 164.81], melody: [440, 392] }, // Fmaj7
  { chord: [82.41, 98, 130.81, 164.81], melody: [329.63, 293.66] }, // C/E
  { chord: [73.42, 87.31, 110, 130.81], melody: [349.23, 329.63] }, // Dm7
  { chord: [98, 130.81, 146.83, 196], melody: [293.66, 392] }, // Gsus4
];

const HOMECOMING_CHORDS = [
  { chord: [146.83, 185, 220, 277.18], melody: [587.33, 554.37] }, // Dmaj7
  { chord: [138.59, 164.81, 220, 246.94], melody: [493.88, 440] }, // Aadd9/C#
  { chord: [123.47, 146.83, 185, 220], melody: [440, 369.99] }, // Bm7
  { chord: [110, 138.59, 164.81, 185], melody: [369.99, 440] }, // F#m7/A
  { chord: [98, 123.47, 146.83, 185], melody: [493.88, 440] }, // Gmaj7
  { chord: [92.5, 110, 146.83, 185], melody: [369.99, 329.63] }, // D/F#
  { chord: [82.41, 98, 123.47, 146.83], melody: [392, 369.99] }, // Em7
  { chord: [110, 146.83, 164.81, 220], melody: [329.63, 440] }, // Asus4
];

export type MusicTheme = "sparkle" | "homecoming" | "memory";
type SynthMusicTheme = Exclude<MusicTheme, "sparkle">;

const MUSIC_THEMES = {
  memory: { chords: MEMORY_CHORDS, interval: 5400, arpeggio: 0.14, melodyDelay: 1.15, melodyStep: 1.62 },
  homecoming: { chords: HOMECOMING_CHORDS, interval: 6200, arpeggio: 0.22, melodyDelay: 0.88, melodyStep: 2.05 },
} satisfies Record<SynthMusicTheme, {
  chords: typeof MEMORY_CHORDS;
  interval: number;
  arpeggio: number;
  melodyDelay: number;
  melodyStep: number;
}>;

class KeepsakeSoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNodes = new Set<OscillatorNode>();
  private musicTheme: MusicTheme = "sparkle";
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

  setMusicTheme(theme: MusicTheme) {
    if (theme === this.musicTheme) return;
    const wasPlaying = this.musicTimer !== null;
    if (wasPlaying) this.stopMusic();
    this.musicTheme = theme;
    this.musicStep = 0;
    if (wasPlaying) this.startMusic();
  }

  startMusic() {
    if (!this.enabled || this.musicTimer !== null || this.musicTheme === "sparkle") return;
    const context = this.getContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);

    this.musicGain = context.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, context.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(1, context.currentTime + 1.2);
    this.musicGain.connect(this.master!);
    this.scheduleMusicPhrase();
    this.musicTimer = window.setInterval(() => this.scheduleMusicPhrase(), MUSIC_THEMES[this.musicTheme].interval);
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
    if (!context || !destination || !this.enabled || this.musicTheme === "sparkle") return;
    const start = context.currentTime + 0.06;
    const theme = MUSIC_THEMES[this.musicTheme];
    const phrase = theme.chords[this.musicStep % theme.chords.length];
    const phraseDuration = theme.interval / 1000;

    phrase.chord.forEach((frequency, index) => {
      this.musicTone(frequency, start + index * theme.arpeggio, phraseDuration - 0.65 - index * 0.08, index === 0 ? 0.2 : 0.125, index === 0 ? "sine" : "triangle", "piano");
      if (index > 0) this.musicTone(frequency * 2, start + index * theme.arpeggio + 0.018, phraseDuration * 0.48, 0.035, "sine", "piano");
    });
    phrase.melody.forEach((frequency, index) => {
      const noteStart = start + theme.melodyDelay + index * theme.melodyStep;
      this.musicTone(frequency, noteStart, this.musicTheme === "homecoming" ? 2.25 : 1.85, 0.17, "triangle", "piano");
      this.musicTone(frequency * 2, noteStart + 0.012, 1.2, 0.032, "sine", "piano");
    });
    this.musicTone(phrase.melody[0], start + 0.72, phraseDuration * 0.64, 0.055, "sawtooth", "violin");
    this.musicTone(phrase.melody[1], start + phraseDuration * 0.58, phraseDuration * 0.36, 0.048, "sawtooth", "violin");
    this.musicStep = (this.musicStep + 1) % theme.chords.length;
  }

  private musicTone(
    frequency: number,
    start: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    voice: "piano" | "violin" = "piano",
  ) {
    const context = this.context;
    const destination = this.musicGain;
    if (!context || !destination) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.detune.setValueAtTime(voice === "violin" ? -5 : type === "triangle" ? -3 : 2, start);
    if (voice === "violin") {
      oscillator.detune.linearRampToValueAtTime(5, start + 0.58);
      oscillator.detune.linearRampToValueAtTime(-4, start + 1.12);
      oscillator.detune.linearRampToValueAtTime(4, start + Math.min(duration - 0.1, 1.75));
    }
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(voice === "violin" ? 1650 : 3600, start);
    filter.Q.value = voice === "violin" ? 1.1 : 0.45;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + (voice === "violin" ? 0.62 : 0.018));
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, volume * (voice === "violin" ? 0.72 : 0.24)),
      start + duration * (voice === "violin" ? 0.68 : 0.38),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter).connect(gain).connect(destination);
    this.musicNodes.add(oscillator);
    oscillator.addEventListener("ended", () => this.musicNodes.delete(oscillator));
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
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
