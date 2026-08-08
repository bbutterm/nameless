import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from './rng.js';

/** Вся случайность игры идёт через Rng. Если он «поплывёт», симуляции врут. */

function take(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => rng.next());
}

describe('hashSeed', () => {
  it('стабилен между вызовами', () => {
    expect(hashSeed('zaklad')).toBe(hashSeed('zaklad'));
  });

  it('различает похожие строки', () => {
    expect(hashSeed('osoka')).not.toBe(hashSeed('osoka '));
  });

  it('всегда даёт беззнаковое 32-битное', () => {
    for (const s of ['', 'a', 'великий ломбард', 'x'.repeat(200)]) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('Rng', () => {
  it('один сид — одна последовательность', () => {
    expect(take(new Rng('vklad-pervyy'), 24)).toEqual(take(new Rng('vklad-pervyy'), 24));
  });

  it('разные сиды расходятся', () => {
    expect(take(new Rng('a'), 12)).not.toEqual(take(new Rng('b'), 12));
  });

  it('числовой и строковый сид — разные конструкторы, одинаковый контракт', () => {
    expect(take(new Rng(12345), 8)).toEqual(take(new Rng(12345), 8));
  });

  it('next() лежит в [0, 1)', () => {
    const rng = new Rng('range');
    for (const v of take(rng, 500)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('snapshot/restore продолжает ту же последовательность', () => {
    const a = new Rng('prilavok');
    take(a, 7);
    const snap = a.snapshot();
    const tail = take(a, 10);
    const b = Rng.restore(snap);
    expect(take(b, 10)).toEqual(tail);
  });

  it('snapshot считает вызовы', () => {
    const rng = new Rng('calls');
    take(rng, 5);
    expect(rng.snapshot().calls).toBe(5);
  });

  it('int() не выходит за границы и берёт оба края', () => {
    const rng = new Rng('int');
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const v = rng.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6]));
  });

  it('int() с вырожденным диапазоном возвращает min', () => {
    expect(new Rng('deg').int(5, 5)).toBe(5);
    expect(new Rng('deg').int(5, 2)).toBe(5);
  });

  it('float() держится в [min, max)', () => {
    const rng = new Rng('float');
    for (let i = 0; i < 200; i++) {
      const v = rng.float(-1.5, 2.5);
      expect(v).toBeGreaterThanOrEqual(-1.5);
      expect(v).toBeLessThan(2.5);
    }
  });

  it('chance() на краях детерминирован', () => {
    const rng = new Rng('chance');
    for (let i = 0; i < 50; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('pick() на пустом списке — undefined', () => {
    expect(new Rng('pick').pick([])).toBeUndefined();
  });

  it('weighted() игнорирует нулевые веса', () => {
    const rng = new Rng('weighted');
    for (let i = 0; i < 100; i++) {
      expect(rng.weighted(['gar', 'posul'], (x) => (x === 'gar' ? 0 : 1))).toBe('posul');
    }
  });

  it('weighted() без положительных весов — undefined', () => {
    expect(new Rng('w0').weighted(['a', 'b'], () => 0)).toBeUndefined();
  });

  it('shuffle() — перестановка, не потеря элементов', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = new Rng('shuffle').shuffle(src);
    expect(out.slice().sort((a, b) => a - b)).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('shuffle() детерминирован по сиду', () => {
    const src = ['a', 'b', 'c', 'd', 'e'];
    expect(new Rng('s').shuffle(src)).toEqual(new Rng('s').shuffle(src));
  });

  it('fork() детерминирован и не совпадает с родителем', () => {
    const parent = new Rng('fork-root');
    const f1 = parent.fork('ai');
    const f2 = new Rng('fork-root').fork('ai');
    expect(take(f1, 10)).toEqual(take(f2, 10));
    expect(take(new Rng('fork-root').fork('ai'), 6)).not.toEqual(take(new Rng('fork-root'), 6));
  });

  it('fork() с разными метками расходится', () => {
    const a = new Rng('root').fork('intent');
    const b = new Rng('root').fork('damage');
    expect(take(a, 8)).not.toEqual(take(b, 8));
  });

  it('fork() не сдвигает состояние родителя', () => {
    const parent = new Rng('quiet');
    const before = parent.snapshot();
    parent.fork('side');
    expect(parent.snapshot()).toEqual(before);
  });
});
