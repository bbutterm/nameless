import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  compareToBaseline,
  FINDING_KINDS,
  findingKey,
  parseBaseline,
  verdict,
  type Baseline,
  type Finding,
} from './baseline.js';

const BASELINE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'sim-baseline.json');

const known: Finding = {
  kind: 'rhythm',
  id: 'max',
  value: 145,
  note: 'длинный промежуток в закладском корпусе',
};
const base: Baseline = { known: [known] };

describe('база известного красного', () => {
  it('известное красное прогон НЕ роняет', () => {
    const v = verdict([known], base);
    expect(v.exitCode).toBe(0);
    expect(v.lines.join('\n')).toContain('известное rhythm:max');
  });

  it('НОВОЕ КРАСНОЕ роняет прогон', () => {
    // Ровно тот случай, ради которого база и заведена: под известным красным
    // жили три настоящих дефекта, и итог «КРАСНЫЙ» не отличал их от фона.
    const fresh: Finding = {
      kind: 'invisibleOption',
      id: 'hire_wall#hire_choice/hire_pledge_holder',
      note: 'вариант не попадает на экран никогда',
    };
    const v = verdict([known, fresh], base);
    expect(v.exitCode).toBe(1);
    expect(v.comparison.fresh).toEqual([fresh]);
    expect(v.lines.join('\n')).toContain('НОВОЕ КРАСНОЕ invisibleOption:hire_wall');
  });

  it('новое красное того же класса, но с другим id — тоже новое', () => {
    const v = verdict([{ ...known, id: 'p90', note: 'девять из десяти вне коридора' }], base);
    expect(v.exitCode).toBe(1);
  });

  it('значение поехало, ключ прежний — это по-прежнему известное', () => {
    // Сверка идёт по паре kind:id, а не по числу: винрейт ступени гуляет на
    // пункт от любой правки контента, и база по значениям устаревала бы каждую
    // итерацию, приучая вычёркивать записи не глядя.
    const v = verdict([{ ...known, value: 151 }], base);
    expect(v.exitCode).toBe(0);
    expect(v.lines.join('\n')).toContain('в базе 145, сейчас 151');
  });

  it('починенное красное не роняет, но база объявляется устаревшей', () => {
    const v = verdict([], base);
    expect(v.exitCode).toBe(0);
    expect(v.lines.join('\n')).toContain('база устарела: rhythm:max');
  });

  it('нечитаемая база роняет прогон, а не тихо считает всё известным', () => {
    const v = verdict([], { known: [] }, 'файл не читается');
    expect(v.exitCode).toBe(1);
    expect(v.lines.join('\n')).toContain('база известного красного не прочитана');
  });

  it('сравнение раскладывает строки на три кучи без потерь', () => {
    const a: Finding = { kind: 'ladderGain', id: 'smolokur:3', note: 'a' };
    const b: Finding = { kind: 'ladderGain', id: 'klyuchar:3', note: 'b' };
    const c = compareToBaseline([a], { known: [b] });
    expect(c.fresh.map(findingKey)).toEqual(['ladderGain:smolokur:3']);
    expect(c.stale.map(findingKey)).toEqual(['ladderGain:klyuchar:3']);
    expect(c.known).toEqual([]);
  });
});

describe('разбор sim-baseline.json', () => {
  it('запись без причины отвергается', () => {
    const r = parseBaseline(JSON.stringify({ known: [{ kind: 'rhythm', id: 'max', note: '  ' }] }));
    expect(r.error).toContain('пустая причина');
  });

  it('опечатка в классе замера отвергается', () => {
    const r = parseBaseline(
      JSON.stringify({ known: [{ kind: 'ladderGaen', id: 'smolokur:3', note: 'x' }] }),
    );
    expect(r.error).toContain('неизвестный класс замера');
  });

  it('повтор ключа отвергается', () => {
    const r = parseBaseline(
      JSON.stringify({
        known: [
          { kind: 'rhythm', id: 'max', note: 'x' },
          { kind: 'rhythm', id: 'max', note: 'y' },
        ],
      }),
    );
    expect(r.error).toContain('дважды');
  });

  it('мусор вместо JSON отвергается', () => {
    expect(parseBaseline('{').error).toBeDefined();
  });

  it('искусственная запись поверх настоящей базы роняет прогон', () => {
    // Тот же путь, которым ходит `cli.ts`: настоящий файл базы плюс одна
    // выдуманная красная строка — прогон обязан вернуть ненулевой код.
    const { baseline } = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
    const invented: Finding = {
      kind: 'unitWinrate',
      id: 'выдуманный_юнит',
      value: 91,
      note: 'красное, которого в базе нет',
    };
    expect(verdict([invented], baseline).exitCode).toBe(1);
    expect(verdict([...baseline.known], baseline).exitCode).toBe(0);
  });

  it('настоящая база лежит в корне, разбирается и объясняет каждую запись', () => {
    const r = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
    expect(r.error).toBeUndefined();
    expect(r.baseline.known.length).toBeGreaterThan(0);
    for (const k of r.baseline.known) {
      expect((FINDING_KINDS as readonly string[]).includes(k.kind), findingKey(k)).toBe(true);
      // Причина — не отписка: по ней должно быть понятно, что именно красное.
      expect(k.note.length, findingKey(k)).toBeGreaterThan(20);
    }
  });
});
