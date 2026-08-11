import { beforeEach, describe, expect, it } from 'vitest';
import { content } from '@nameless/content';
import {
  attemptsOf,
  clearScore,
  emptyScore,
  isRangeHash,
  loadScore,
  pct,
  rangeParty,
  rangePowers,
  rangeRows,
  rangeSeed,
  rangeTotals,
  recordResult,
  saveSetup,
  RANGE_DEFAULT,
  type RangeRow,
} from './range';

/**
 * Полигон — прибор. Прибор, который врёт, хуже отсутствующего: по его цифрам
 * будут править баланс. Поэтому проверяется не «рендерится ли экран», а ровно
 * три вещи, в которых он может соврать молча:
 *   1) отряд и умения собираются по тому же правилу, что и у симулятора,
 *      иначе сравнение «ты против бота» сравнивает разные бои;
 *   2) счёт считается взвешенно и переживает перезагрузку;
 *   3) сюжетный сейв не трогается ВООБЩЕ — ни на чтение, ни на запись.
 */

const SAVE_KEY = 'nameless:save:v1';

/** Минимальный localStorage: клиентские тесты гоняются без DOM. */
class MemStorage {
  private data = new Map<string, string>();
  /** Все ключи, к которым вообще прикасались, — по ним ловится поход в сейв. */
  readonly touched: string[] = [];
  getItem(k: string): string | null {
    this.touched.push(k);
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.touched.push(k);
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.touched.push(k);
    this.data.delete(k);
  }
}

let mem: MemStorage;

beforeEach(() => {
  mem = new MemStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true });
});

describe('адрес полигона', () => {
  it('открывается точным хешем, в том числе закодированным', () => {
    expect(isRangeHash('#полигон')).toBe(true);
    expect(isRangeHash('#%D0%BF%D0%BE%D0%BB%D0%B8%D0%B3%D0%BE%D0%BD')).toBe(true);
  });

  it('ничем другим не открывается', () => {
    for (const h of ['', '#', '#poligon', '#полигон2', '#Полигон', '#%%%']) {
      expect(isRangeHash(h), h).toBe(false);
    }
  });
});

describe('отряд', () => {
  it('бой с объявленным expectParty получает ровно его', () => {
    const def = content.battles.find((b) => b.expectParty?.length);
    expect(def).toBeDefined();
    if (!def?.expectParty) return;
    const party = rangeParty(def, { ...RANGE_DEFAULT, chapter: 3, level: 1 });
    expect(party.map((p) => p.defId)).toEqual(def.expectParty);
  });

  it('бой без expectParty получает шестёрку по главе, а глава двигает состав', () => {
    const def = content.battles.find((b) => !b.expectParty?.length);
    expect(def).toBeDefined();
    if (!def) return;
    const ch1 = rangeParty(def, { ...RANGE_DEFAULT, chapter: 1 });
    const ch3 = rangeParty(def, { ...RANGE_DEFAULT, chapter: 3 });
    expect(ch1).toHaveLength(6);
    expect(ch3).toHaveLength(6);
    expect(ch1.map((p) => p.defId)).not.toEqual(ch3.map((p) => p.defId));
  });

  it('уровень поднимает и уровень юнита, и его hp', () => {
    const def = content.battles.find((b) => !b.expectParty?.length);
    if (!def) return;
    const l1 = rangeParty(def, { ...RANGE_DEFAULT, level: 1 });
    const l5 = rangeParty(def, { ...RANGE_DEFAULT, level: 5 });
    expect(l5.every((p) => p.level === 5)).toBe(true);
    expect(l5[0]!.hp).toBeGreaterThan(l1[0]!.hp);
  });

  it('уровень слушается и названным отрядом — ручку прибора не игнорируют', () => {
    const def = content.battles.find((b) => b.expectParty?.length);
    if (!def) return;
    const l1 = rangeParty(def, { ...RANGE_DEFAULT, level: 1 });
    const l5 = rangeParty(def, { ...RANGE_DEFAULT, level: 5 });
    expect(l5[0]!.hp).toBeGreaterThan(l1[0]!.hp);
  });
});

describe('умения памяти', () => {
  it('«нет» не даёт ни одного умения', () => {
    expect(rangePowers(0)).toHaveLength(0);
  });

  it('ступень — это счётчик воспоминаний, и она растёт вместе с выбором', () => {
    const t1 = rangePowers(1);
    const t3 = rangePowers(3);
    expect(t1.length).toBeGreaterThan(0);
    // На первой ступени каждое умение стоит на одном воспоминании, на третьей —
    // на трёх. Ровно это и означает «ступень» в каноне.
    expect(Math.max(...t1.map((p) => p.tier))).toBe(1);
    expect(Math.max(...t3.map((p) => p.tier))).toBe(3);
  });

  it('первая ступень берёт ДАЮЩЕЕ воспоминание, а не первое по алфавиту', () => {
    // Тот самый капкан, в который однажды угодил симулятор: у трёх жизней из
    // пяти первым по алфавиту идёт усиливающее воспоминание, и «ступень I»
    // выходила пустой — отчёт при этом выглядел правдоподобно.
    const lives = new Set(rangePowers(1).map((p) => p.life));
    expect(lives.size).toBe(content.lives.length);
  });
});

describe('сид', () => {
  it('номер попытки входит в сид: десять прогонов — десять разных боёв', () => {
    expect(rangeSeed('battle_x', 0)).toBe('range:battle_x:0');
    expect(rangeSeed('battle_x', 1)).not.toBe(rangeSeed('battle_x', 0));
  });
});

describe('счёт', () => {
  it('пустое хранилище — пустой счёт', () => {
    expect(loadScore().battles).toEqual({});
    expect(loadScore().setup).toEqual(RANGE_DEFAULT);
  });

  it('исходы копятся и переживают перечитывание', () => {
    recordResult('battle_x', true);
    recordResult('battle_x', false);
    recordResult('battle_x', true);
    expect(loadScore().battles.battle_x).toEqual({ played: 3, won: 2 });
    expect(attemptsOf(loadScore(), 'battle_x')).toBe(3);
  });

  it('обнуление стирает счёт', () => {
    recordResult('battle_x', true);
    clearScore();
    expect(loadScore().battles).toEqual({});
  });

  it('настройка переживает бой, а обнуление счёта её не сбивает', () => {
    saveSetup({ chapter: 3, level: 4, tier: 2 });
    recordResult('battle_x', true);
    expect(loadScore().setup).toEqual({ chapter: 3, level: 4, tier: 2 });
  });

  it('мусор в хранилище не роняет прибор', () => {
    mem.setItem('nameless:range:v1', '{ это не json');
    expect(loadScore()).toEqual(emptyScore());
    mem.setItem('nameless:range:v1', '{"battles":{"a":{"played":"много"}},"setup":42}');
    expect(loadScore().battles).toEqual({});
    expect(loadScore().setup).toEqual(RANGE_DEFAULT);
  });

  it('СЮЖЕТНОГО СЕЙВА полигон не касается ни одним обращением', () => {
    // Железное правило: владелец проходит игру и гоняет полигон в один вечер.
    // Полигон, стерший прохождение, обесценил бы оба замера сразу.
    saveSetup({ chapter: 2, level: 3, tier: 1 });
    recordResult('battle_x', true);
    loadScore();
    clearScore();
    rangeRows(loadScore());
    expect(mem.touched).not.toContain(SAVE_KEY);
  });
});

describe('итог', () => {
  const row = (id: string, botWinrate: number | undefined, played: number, won: number): RangeRow =>
    ({
      def: { id, name: { ru: id, en: id }, enemies: [] },
      chapter: 1,
      bot: botWinrate === undefined ? undefined : { winrate: botWinrate, rounds: 7, runs: 150 },
      tally: { played, won },
      lethal: false,
    }) as RangeRow;

  it('доля бота взвешена ТВОИМИ прогонами, а не усреднена по боям', () => {
    // Девять прогонов лёгкого боя и один тяжёлого: простое среднее по боям
    // дало бы боту 50%, хотя девять десятых замера — лёгкий бой.
    const t = rangeTotals([row('easy', 0.9, 9, 9), row('hard', 0.1, 1, 0)]);
    expect(t.played).toBe(10);
    expect(t.won).toBe(9);
    expect(t.human).toBeCloseTo(0.9);
    expect(t.bot).toBeCloseTo(0.82);
    expect(t.gapPoints).toBe(8);
  });

  it('несыгранные бои в итог не входят', () => {
    const t = rangeTotals([row('a', 0.5, 0, 0), row('b', 0.5, 2, 1)]);
    expect(t.played).toBe(2);
  });

  it('бой без снимка бота считается отдельно и не портит долю бота', () => {
    const t = rangeTotals([row('a', 0.5, 2, 1), row('new', undefined, 3, 3)]);
    expect(t.bot).toBeCloseTo(0.5);
    expect(t.unmeasured).toBe(3);
  });

  it('пустой полигон не делит на ноль', () => {
    const t = rangeTotals([]);
    expect(t).toMatchObject({ played: 0, human: 0, bot: 0, gapPoints: 0 });
  });
});

describe('список боёв', () => {
  it('показывает все бои игры, помечает летальные и знает главу', () => {
    const rows = rangeRows(emptyScore());
    expect(rows).toHaveLength(content.battles.length);
    expect(rows.some((r) => r.lethal)).toBe(true);
    expect(rows.every((r) => r.chapter >= 0)).toBe(true);
    // Главы идут по возрастанию — список читается как порядок прохождения.
    const chapters = rows.map((r) => r.chapter);
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
  });

  it('у каждого боя есть цифра бота — иначе сравнивать не с чем', () => {
    const rows = rangeRows(emptyScore());
    const blind = rows.filter((r) => !r.bot).map((r) => r.def.id);
    expect(blind).toEqual([]);
  });
});

describe('проценты', () => {
  it('печатаются целыми', () => {
    expect(pct(0.8)).toBe('80%');
    expect(pct(0.667)).toBe('67%');
  });
});
