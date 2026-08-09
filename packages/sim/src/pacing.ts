/**
 * Темп начала игры. «Безымянный» — рогалик с сюжетом, а не текстовая игра:
 * игрок должен попасть в первый бой за пару минут, а не за шесть.
 * Метрика считает, сколько реплик игрок протапывает от старта главы до первого
 * боя, случайно выбирая варианты — то есть ведёт себя как живой человек,
 * а не как оптимальный маршрут.
 */
import {
  advance,
  choose,
  createInitialState,
  indexContent,
  normalizeEntry,
  resolve,
  Rng,
  type ContentBundle,
} from '@nameless/engine';

/** Секунд на реплику: замер по автопрохождению в браузере. */
export const SECONDS_PER_BUBBLE = 3.5;
/** Медиана выше — начало затянуто. */
export const BUBBLES_TO_BATTLE_MAX = 30;

export interface PacingReport {
  runs: number;
  reachedBattle: number;
  min: number;
  median: number;
  max: number;
  medianSeconds: number;
  ok: boolean;
}

export function timeToFirstBattle(content: ContentBundle, runs = 200): PacingReport {
  const idx = indexContent(content);
  const chapter = [...content.chapters].sort((a, b) => a.index - b.index)[0];
  const results: number[] = [];
  if (!chapter) {
    return { runs: 0, reachedBattle: 0, min: 0, median: 0, max: 0, medianSeconds: 0, ok: true };
  }

  for (let i = 0; i < runs; i++) {
    const rng = new Rng(`pacing:${i}`);
    let st = normalizeEntry(
      idx,
      createInitialState({
        seed: `p${i}`,
        axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
        chapter: chapter.index,
        scene: chapter.entryScene,
        node: '@entry',
        now: 0,
      }),
    );
    let bubbles = 0;
    for (let step = 0; step < 3000; step++) {
      const r = resolve(idx, st);
      st = r.state;
      if (r.step.kind === 'battle') {
        results.push(bubbles);
        break;
      }
      if (r.step.kind === 'bubble') {
        bubbles++;
        st = advance(idx, st);
        continue;
      }
      if (r.step.kind === 'choice') {
        const pick = rng.pick(r.step.options);
        if (!pick) break;
        st = choose(idx, st, pick.id);
        continue;
      }
      break;
    }
  }

  results.sort((a, b) => a - b);
  const median = results[Math.floor(results.length / 2)] ?? 0;
  return {
    runs,
    reachedBattle: results.length,
    min: results[0] ?? 0,
    median,
    max: results[results.length - 1] ?? 0,
    medianSeconds: Math.round(median * SECONDS_PER_BUBBLE),
    ok: results.length >= runs * 0.9 && median <= BUBBLES_TO_BATTLE_MAX,
  };
}
