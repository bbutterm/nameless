import { describe, expect, it } from 'vitest';
import {
  ECHO_IDS,
  PORTRAIT_IDS,
  echoDiff,
  hasPortrait,
  houseOf,
  portraitSvg,
  readableDiff,
  resolveFace,
} from '@nameless/content/portraits';
import { content } from './index.js';

/**
 * Канон лиц (`docs/PORTRAITS.md`) держится на двух вещах, которые нельзя
 * проверить глазами каждый раз, когда кто-то добавит говорящего: на различии
 * соседей по дому и на детерминизме. И то и другое ломается тихо — портреты
 * останутся красивыми, просто двое станут неотличимы, а кеш перестанет
 * попадать. Поэтому оба правила живут тестом.
 */

function pairs<T>(xs: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) out.push([xs[i]!, xs[j]!]);
  }
  return out;
}

describe('портреты: различие соседей', () => {
  it('соседи по дому расходятся минимум двумя позициями, читаемыми на 44px', () => {
    const byHouse = new Map<string, string[]>();
    for (const id of PORTRAIT_IDS) {
      const house = houseOf(id);
      if (!house) continue;
      byHouse.set(house, [...(byHouse.get(house) ?? []), id]);
    }

    const tooClose: string[] = [];
    for (const [house, ids] of byHouse) {
      for (const [a, b] of pairs(ids)) {
        const fa = resolveFace(a);
        const fb = resolveFace(b);
        if (!fa || !fb) continue;
        // Отголоски меряются своим правилом: у следа одного дня нет ни
        // причёски, ни ворота, и требовать от него людскую первую группу
        // значит требовать украшений (канон §3.1).
        const diff = fa.echo && fb.echo ? echoDiff(fa, fb) : readableDiff(fa, fb);
        if (diff.length < 2) tooClose.push(`[${house}] ${a} / ${b} — различий ${diff.length}`);
      }
    }
    expect(tooClose).toEqual([]);
  });

  it('у каждого говорящего сцен есть лицо или осознанный отказ от него', () => {
    for (const s of content.speakers) {
      // Рассказчик — единственный, кому лицо не положено: лицо сделало бы его
      // свидетелем, а это в мире должность, и она занята.
      if (s.id === 'narrator') {
        expect(hasPortrait(s.id)).toBe(false);
        continue;
      }
      expect(hasPortrait(s.id), `нет лица у ${s.id}`).toBe(true);
    }
  });
});

describe('портреты: детерминизм', () => {
  it('одни и те же аргументы дают побайтово одинаковый SVG', () => {
    for (const id of [...PORTRAIT_IDS, ...ECHO_IDS, 'narrator']) {
      const a = portraitSvg(id, { deaths: 3, chapter: 2 });
      const b = portraitSvg(id, { deaths: 3, chapter: 2 });
      expect(b, `недетерминизм у ${id}`).toBe(a);
    }
  });

  it('лицо игрока сереет со смертями и упирается в потолок', () => {
    const at = (deaths: number) => resolveFace('player', { deaths })?.fade ?? 0;
    expect(at(0)).toBeLessThan(at(3));
    expect(at(3)).toBeLessThan(at(8));
    // Потолок канона §2.2: даже у того, кто умирал двадцать раз, лицо остаётся
    // лицом. Полностью выцветший игрок неотличим от отголоска, а он не он.
    expect(at(40)).toBeLessThanOrEqual(0.8);
  });

  it('Клёст, наоборот, проявляется от главы к главе', () => {
    const at = (chapter: number) => resolveFace('klyost', { chapter })?.fade ?? 0;
    expect(at(1)).toBeGreaterThan(at(2));
    expect(at(2)).toBeGreaterThan(at(3));
  });
});
