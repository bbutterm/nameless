/**
 * Темп начала игры. «Безымянный» — рогалик с сюжетом, а не текстовая игра:
 * игрок должен попасть в первый бой за пару минут, а не за шесть.
 * Метрика считает, сколько реплик игрок протапывает от старта главы до первого
 * боя, случайно выбирая варианты — то есть ведёт себя как живой человек,
 * а не как оптимальный маршрут.
 */
import {
  advance,
  applyDeath,
  applyEffects,
  choose,
  createInitialState,
  goTo,
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
/**
 * Ритм по всей игре: девять из десяти промежутков между боями должны укладываться
 * в это число реплик. Средняя величина тут обманывает — она была приличной (40)
 * при том, что каждый десятый промежуток тянулся на 150+ реплик, то есть девять
 * минут текста подряд без единого боя.
 */
export const BUBBLES_BETWEEN_BATTLES_P90 = 70;
/** Ни один промежуток не должен быть длиннее: это уже текстовая пустыня. */
export const BUBBLES_BETWEEN_BATTLES_MAX = 120;

export interface PacingReport {
  runs: number;
  reachedBattle: number;
  min: number;
  median: number;
  max: number;
  medianSeconds: number;
  ok: boolean;
}

export interface RhythmReport {
  intervals: number;
  median: number;
  p90: number;
  max: number;
  overP90: number;
  battlesPerRun: number;
  ok: boolean;
}

/**
 * Ритм «слово — бой» по всей игре. Прогоняет полные прохождения со случайными
 * выборами и случайным исходом боёв и смотрит, сколько реплик проходит между
 * драками. Игра — рогалик с сюжетом: длинные текстовые пустыни ломают жанр
 * сильнее, чем слабый баланс.
 */
export function battleRhythm(content: ContentBundle, runs = 60): RhythmReport {
  const idx = indexContent(content);
  const chapter = [...content.chapters].sort((a, b) => a.index - b.index)[0];
  const gaps: number[] = [];
  const perRun: number[] = [];
  if (!chapter) {
    return { intervals: 0, median: 0, p90: 0, max: 0, overP90: 0, battlesPerRun: 0, ok: true };
  }

  for (let i = 0; i < runs; i++) {
    const rng = new Rng(`rhythm:${i}`);
    let st = normalizeEntry(
      idx,
      createInitialState({
        seed: `rh${i}`,
        axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
        chapter: chapter.index,
        scene: chapter.entryScene,
        node: '@entry',
        now: 0,
      }),
    );
    let since = 0;
    let battles = 0;
    for (let step = 0; step < 4000; step++) {
      const r = resolve(idx, st);
      st = r.state;
      if (r.step.kind === 'bubble') {
        since++;
        st = advance(idx, st);
        continue;
      }
      if (r.step.kind === 'choice') {
        const pick = rng.pick(r.step.options);
        if (!pick) break;
        st = choose(idx, st, pick.id);
        continue;
      }
      if (r.step.kind === 'battle') {
        gaps.push(since);
        since = 0;
        battles++;
        const node = r.step.node;
        const won = rng.chance(0.8);
        const def = content.battles.find((b) => b.id === node.battle);
        if (won && def?.rewards) st = applyEffects(st, def.rewards, idx.effectCtx);
        st = normalizeEntry(idx, goTo(st, won ? node.onWin : node.onLose));
        continue;
      }
      if (r.step.kind === 'death') {
        const deathId = r.step.node.death;
        const death = content.deaths.find((d) => d.id === deathId);
        if (!death) break;
        st = applyDeath(st, content, death, idx.effectCtx).state;
        continue;
      }
      break;
    }
    perRun.push(battles);
  }

  gaps.sort((a, b) => a - b);
  perRun.sort((a, b) => a - b);
  const p90 = gaps[Math.floor(gaps.length * 0.9)] ?? 0;
  const max = gaps[gaps.length - 1] ?? 0;
  return {
    intervals: gaps.length,
    median: gaps[Math.floor(gaps.length / 2)] ?? 0,
    p90,
    max,
    overP90: gaps.filter((g) => g > BUBBLES_BETWEEN_BATTLES_P90).length,
    battlesPerRun: perRun[Math.floor(perRun.length / 2)] ?? 0,
    ok: p90 <= BUBBLES_BETWEEN_BATTLES_P90 && max <= BUBBLES_BETWEEN_BATTLES_MAX,
  };
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
