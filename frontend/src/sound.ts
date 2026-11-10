/**
 * Tactical Sound & Speech Synthesizer for FloodGuard
 * Uses Web Audio API and SpeechSynthesis API (zero external dependencies).
 */

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

try {
  const saved = localStorage.getItem('floodguard_sound');
  if (saved !== null) soundEnabled = saved === 'true';
} catch {
  soundEnabled = true;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  try {
    localStorage.setItem('floodguard_sound', String(enabled));
  } catch {
    // ignore
  }
}

function getAudioContext(): AudioContext | null {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Subtle high-tech tactile click */
export function playClick(): void {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch {
    // Ignore audio failures
  }
}

/** Sonar radar ping for alert/detection */
export function playSonar(): void {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
    osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.12); // E6
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Ignore audio failures
  }
}

/** Tactical success confirmation sound */
export function playSuccess(): void {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.08, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.15);
    });
  } catch {
    // Ignore
  }
}

let activeSirenNodes: { stop: () => void } | null = null;

/**
 * Emergency warble siren test (extended 6-second realistic civil defense alert)
 */
export function playSiren(durationSec = 6.0): void {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (activeSirenNodes) {
      try { activeSirenNodes.stop(); } catch { /* ignore */ }
      activeSirenNodes = null;
    }

    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    subOsc.type = 'sine';
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);

    const now = ctx.currentTime;
    const cycleDuration = 0.9;
    const cycles = Math.ceil(durationSec / cycleDuration);

    // Realistic oscillating emergency siren pitch modulation
    for (let i = 0; i < cycles; i++) {
      const start = now + i * cycleDuration;
      const mid = start + cycleDuration * 0.5;
      const end = start + cycleDuration;
      
      osc.frequency.setValueAtTime(520, start);
      osc.frequency.linearRampToValueAtTime(1040, mid);
      osc.frequency.linearRampToValueAtTime(520, end);

      subOsc.frequency.setValueAtTime(260, start);
      subOsc.frequency.linearRampToValueAtTime(520, mid);
      subOsc.frequency.linearRampToValueAtTime(260, end);
    }

    // Dynamic envelope (smooth crescendo, sustain, and authentic wind-down)
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.35);
    gain.gain.setValueAtTime(0.14, now + durationSec - 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + durationSec);
    subOsc.stop(now + durationSec);

    activeSirenNodes = {
      stop: () => {
        try {
          gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.1);
          setTimeout(() => {
            try { osc.stop(); subOsc.stop(); } catch { /* ignore */ }
          }, 120);
        } catch { /* ignore */ }
      },
    };
  } catch {
    // Ignore audio failures
  }
}

/** Multilingual Speech Synthesizer for IVR Broadcast simulation */
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakScript(
  text: string,
  lang: 'en' | 'hi' | 'mr',
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  
  stopSpeech();

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
    utterance.lang = langMap[lang] || 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick best available voice matching language
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.startsWith(lang) || v.lang.startsWith(utterance.lang));
    if (match) utterance.voice = match;

    if (onStart) utterance.onstart = onStart;
    utterance.onend = () => {
      currentUtterance = null;
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      currentUtterance = null;
      if (onEnd) onEnd();
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking;
}

/** Plays realistic Dual-Tone Multi-Frequency (DTMF) telephone audio */
const DTMF_MAP: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

export function playDTMF(digit: string): void {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const freqs = DTMF_MAP[digit] || [770, 1336];
    const now = ctx.currentTime;
    const dur = 0.12;

    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    });
  } catch {
    // Ignore
  }
}


