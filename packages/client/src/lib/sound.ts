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
  // Воздух гасится сразу: выключатель звука обязан выключать и то, что уже
  // играет, иначе подложка тянется ещё минуту после нажатия.
  else stopAir();
}

// Свёрнутая вкладка не должна шуметь в кармане: это мобильная игра, её
// сворачивают, не закрывая.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAir();
    else if (enabled && lastPlace) setAir(lastPlace);
  });
}

/** Последнее место — чтобы вернуть тот же воздух после сворачивания. */
let lastPlace: string | undefined;

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

// ─────────────────────────────────────────────────────────────────────────────
// Воздух места
//
// События звучали, а комната — нет, и от этого игра оставалась экраном с
// текстом. Двенадцать мест канона получают свой воздух: не мелодию и не
// «эмбиент-трек», а то, что слышно, когда все замолчали. Синтезом, как и всё
// остальное: шумовая подложка через фильтр плюс редкие одиночные звуки,
// которые в этом месте и должны раздаваться, — костяшка счётов в зале Учёта,
// капля в подвалах, ветер на дороге в Выцветь, шорох бумаги в читальне.
//
// Громкость нарочно на границе слышимого (0.006–0.02 против 0.05–0.13 у
// событий): воздух не должен спорить с репликой. Проверять его надо не на
// колонках, а в наушниках на телефоне — там он и живёт.
// ─────────────────────────────────────────────────────────────────────────────

interface Air {
  /** Частота среза подложки: ниже — глуше и теснее помещение. */
  hz: number;
  /** Громкость подложки. */
  bed: number;
  /** Редкое событие места и как часто оно случается (секунды между). */
  every: [number, number];
  drop: () => void;
}

const AIR: Record<string, Air> = {
  // Зал Учёта: сухо, тесно, где-то считают.
  hall: { hz: 520, bed: 0.012, every: [2.5, 7], drop: () => tone({ freq: 1500, to: 1180, dur: 0.03, type: 'triangle', gain: 0.02 }) },
  counter: { hz: 480, bed: 0.011, every: [3, 8], drop: () => tone({ freq: 1320, to: 990, dur: 0.035, type: 'triangle', gain: 0.018 }) },
  // Подвалы: гулко и капает.
  vault: { hz: 260, bed: 0.018, every: [3.5, 9], drop: () => { tone({ freq: 2100, to: 620, dur: 0.06, type: 'sine', gain: 0.03 }); noise(0.05, 0.012, 400, 0.05); } },
  archive: { hz: 340, bed: 0.013, every: [4, 11], drop: () => noise(0.22, 0.016, 3200) },
  lowest: { hz: 200, bed: 0.02, every: [4, 10], drop: () => tone({ freq: 90, to: 55, dur: 0.5, type: 'sine', gain: 0.025 }) },
  // Двор и ворота: улица за стеной.
  gate: { hz: 700, bed: 0.014, every: [2.5, 6], drop: () => noise(0.3, 0.014, 900) },
  // Дорога в Выцветь: ветер и ничего больше.
  road: { hz: 900, bed: 0.02, every: [3, 7], drop: () => noise(0.9, 0.014, 700) },
  garden: { hz: 1100, bed: 0.012, every: [2, 6], drop: () => noise(0.35, 0.01, 4200) },
  // Цех: чужая память шуршит по-своему, выше и суше.
  guild: { hz: 800, bed: 0.013, every: [2.5, 6], drop: () => tone({ freq: 2400, to: 1700, dur: 0.05, type: 'sine', gain: 0.014 }) },
  audit: { hz: 420, bed: 0.012, every: [3, 8], drop: () => tone({ freq: 240, to: 190, dur: 0.12, type: 'square', gain: 0.016 }) },
  ledger: { hz: 560, bed: 0.011, every: [3, 9], drop: () => noise(0.16, 0.013, 2800) },
  // Чулан: срок идёт.
  hourglass: { hz: 300, bed: 0.014, every: [1.6, 3.2], drop: () => noise(0.035, 0.012, 1800) },
  tower: { hz: 600, bed: 0.012, every: [3, 8], drop: () => noise(0.25, 0.012, 1200) },
};

let bedSrc: AudioBufferSourceNode | undefined;
let bedGain: GainNode | undefined;
let bedFilter: BiquadFilterNode | undefined;
let dropTimer: ReturnType<typeof setTimeout> | undefined;
let airNow: string | undefined;

/** Одна секунда розоватого шума в петле — подложка любого места. */
function bedBuffer(a: AudioContext): AudioBuffer {
  const buf = a.createBuffer(1, a.sampleRate, a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    // Простое сглаживание: белый шум режет ухо, «дыхание помещения» — нет.
    last = last * 0.96 + white * 0.04;
    d[i] = last * 6;
  }
  return buf;
}

function scheduleDrop(air: Air): void {
  if (dropTimer) clearTimeout(dropTimer);
  const [lo, hi] = air.every;
  const wait = (lo + Math.random() * (hi - lo)) * 1000;
  dropTimer = setTimeout(() => {
    if (enabled && !document.hidden) air.drop();
    scheduleDrop(air);
  }, wait);
}

/**
 * Включить воздух места. Зовётся с id сцены или боя — ключ места считается тем
 * же правилом, что и знак места, чтобы картинка и звук никогда не разошлись.
 */
export function setAir(placeKey: string): void {
  lastPlace = placeKey;
  if (!enabled) {
    stopAir();
    return;
  }
  const air = AIR[placeKey] ?? AIR['tower']!;
  const a = audio();
  if (!a) return;

  if (!bedSrc || !bedGain || !bedFilter) {
    bedGain = a.createGain();
    bedGain.gain.setValueAtTime(0.0001, a.currentTime);
    bedFilter = a.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedSrc = a.createBufferSource();
    bedSrc.buffer = bedBuffer(a);
    bedSrc.loop = true;
    bedSrc.connect(bedFilter).connect(bedGain).connect(a.destination);
    bedSrc.start();
  }
  if (airNow === placeKey) return;
  airNow = placeKey;

  // Переход между местами — не переключатель, а сквозняк: полторы секунды.
  const t = a.currentTime;
  bedFilter.frequency.cancelScheduledValues(t);
  bedFilter.frequency.setValueAtTime(bedFilter.frequency.value || air.hz, t);
  bedFilter.frequency.linearRampToValueAtTime(air.hz, t + 1.5);
  bedGain.gain.cancelScheduledValues(t);
  bedGain.gain.setValueAtTime(Math.max(0.0001, bedGain.gain.value), t);
  bedGain.gain.linearRampToValueAtTime(air.bed, t + 1.5);

  scheduleDrop(air);
}

/** Заглушить воздух: выключенный звук, свёрнутая вкладка, конец игры. */
export function stopAir(): void {
  if (dropTimer) clearTimeout(dropTimer);
  dropTimer = undefined;
  airNow = undefined;
  const a = ctx;
  if (a && bedGain) {
    const t = a.currentTime;
    bedGain.gain.cancelScheduledValues(t);
    bedGain.gain.setValueAtTime(Math.max(0.0001, bedGain.gain.value), t);
    bedGain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
  }
}
