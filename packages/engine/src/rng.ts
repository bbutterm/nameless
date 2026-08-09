/**
 * Детерминированный ГПСЧ. Всё случайное в игре идёт только через него —
 * симуляции и воспроизведение боёв по сиду обязаны совпадать до последнего хита.
 */

export interface RngState {
  readonly seed: number;
  readonly calls: number;
}

const MASK = 0xffffffff;

/** Хэш строки в 32-битное число (FNV-1a). Сид из id сущности — стабилен между запусками. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 — быстрый, короткий, достаточно равномерный для игровой логики. */
function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) & MASK;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export class Rng {
  private state: number;
  private count = 0;

  constructor(seed: number | string) {
    this.state = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;
  }

  /** Снимок для сейва/реплея. */
  snapshot(): RngState {
    return { seed: this.state, calls: this.count };
  }

  static restore(s: RngState): Rng {
    const r = new Rng(1);
    // Состояние присваивается в обход конструктора умышленно. Конструктор
    // подменяет нулевой сид единицей — это защита от вырожденного `new Rng(0)`,
    // но для восстановления она вредна: ноль — легальное внутреннее состояние
    // (шанс 2⁻³² на вызов), и подмена его единицей разводит реплей с живым
    // прогоном. Здесь мы не выбираем сид, а возвращаем уже прожитое состояние.
    r.state = s.seed >>> 0;
    r.count = s.calls;
    return r;
  }

  /** [0, 1) */
  next(): number {
    this.count++;
    this.state = (this.state + 0x6d2b79f5) & MASK;
    return mulberry32(this.state - 0x6d2b79f5);
  }

  /** Целое в [min, max] включительно. */
  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Число с плавающей точкой в [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** true с вероятностью p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  /** Взвешенный выбор. Веса ≤0 игнорируются. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    for (const it of items) {
      const w = weight(it);
      if (w > 0) total += w;
    }
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const it of items) {
      const w = weight(it);
      if (w <= 0) continue;
      roll -= w;
      if (roll <= 0) return it;
    }
    return items[items.length - 1];
  }

  /** Перемешивание Фишера—Йетса. Возвращает новый массив. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const a = out[i] as T;
      const b = out[j] as T;
      out[i] = b;
      out[j] = a;
    }
    return out;
  }

  /** Порождает дочерний генератор — чтобы ветки логики не «съедали» ход друг у друга. */
  fork(label: string): Rng {
    return new Rng(hashSeed(`${this.state}:${label}`));
  }
}
