/**
 * Звук синтезом, без единого файла. Причина не в экономии: у игры нет сервера
 * и нет бюджета на загрузку, а мир звучит как ломбард под вечер — сухие
 * деревянные щелчки, глухие удары, стеклянный звон склянки с памятью.
 * Всё это дешевле и цельнее собрать осциллятором, чем надёргать сэмплов.
 */
const KEY = 'nameless:sound';

let ctx: AudioContext | undefined;
let enabled = true;
try {
  enabled = localStorage.getItem(KEY) !== '0';
} catch {
  enabled = true;
}

export function soundEnabled(): boolean {
  return enabled;
}

export function setSound(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // не критично
  }
  if (on) void resume();
}

/** Контекст создаётся лениво: браузеры не дают звук до первого жеста. */
function audio(): AudioContext | undefined {
  if (!enabled) return undefined;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return undefined;
    ctx = new Ctor();
  }
  return ctx;
}

export async function resume(): Promise<void> {
  const a = audio();
  if (a && a.state === 'suspended') {
    try {
      await a.resume();
    } catch {
      // пользователь ещё не тапал — попробуем в следующий раз
    }
  }
}

interface ToneOpts {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, to, dur, type = 'sine', gain = 0.12, delay = 0 }: ToneOpts): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const env = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Шум с быстрым затуханием — основа ударов и рассыпания в труху. */
function noise(dur: number, gain = 0.1, filterHz = 1400, delay = 0): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const frames = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, frames, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterHz, t0);
  const env = a.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(a.destination);
  src.start(t0);
}

export type Sfx = 'bubble' | 'choice' | 'hit' | 'crit' | 'death' | 'memory' | 'victory' | 'defeat';

export function playSfx(kind: Sfx): void {
  if (!enabled) return;
  switch (kind) {
    case 'bubble': // сухой деревянный щелчок счётов
      tone({ freq: 880, to: 660, dur: 0.045, type: 'triangle', gain: 0.045 });
      break;
    case 'choice': // печать по бумаге
      noise(0.07, 0.07, 2600);
      tone({ freq: 320, to: 200, dur: 0.09, type: 'square', gain: 0.05 });
      break;
    case 'hit':
      noise(0.11, 0.13, 900);
      tone({ freq: 180, to: 70, dur: 0.14, type: 'sawtooth', gain: 0.07 });
      break;
    case 'crit':
      noise(0.16, 0.17, 1500);
      tone({ freq: 260, to: 60, dur: 0.2, type: 'sawtooth', gain: 0.1 });
      tone({ freq: 1200, to: 500, dur: 0.12, type: 'square', gain: 0.05, delay: 0.02 });
      break;
    case 'death': // выцветание в труху
      noise(0.7, 0.1, 700);
      tone({ freq: 140, to: 40, dur: 0.8, type: 'sine', gain: 0.07 });
      break;
    case 'memory': // склянка с памятью: чистый стеклянный звон
      tone({ freq: 1318, dur: 0.9, type: 'sine', gain: 0.07 });
      tone({ freq: 1975, dur: 0.7, type: 'sine', gain: 0.035, delay: 0.06 });
      tone({ freq: 659, dur: 1.2, type: 'sine', gain: 0.05, delay: 0.12 });
      break;
    case 'victory':
      [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.06, delay: i * 0.09 }));
      break;
    case 'defeat':
      [392, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.42, type: 'triangle', gain: 0.06, delay: i * 0.13 }));
      break;
    default:
      break;
  }
}
