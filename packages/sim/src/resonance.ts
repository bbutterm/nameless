/**
 * Доказательство итерации B6 — «Архив узнаёт не всех».
 *
 * Два инварианта, которые проверяются здесь:
 *
 *  1. **Смерть не молчит.** Лестница резонанса из `silver_counter` на любом
 *     достижимом состоянии либо досыпает осколки и выдаёт лот, либо приходит
 *     в узел «раздел не отзывается» — с репликой Осоки и начисленной
 *     неустойкой. Состояния «ни лота, ни реплики» не существует.
 *     Дополнительно: если лестница ДОСЫПАЛА, `selectMemoryOnDeath` обязан
 *     вернуть воспоминание — иначе склянка поднялась, а лот не закрепился.
 *
 *  2. **Личности расходятся.** Три профиля по 16 смертей приходят к РАЗНЫМ
 *     наборам закреплённого, и ни один не выкупает архив целиком.
 *
 * Перебор по осям — исчерпывающий не «на сетке», а по классам эквивалентности:
 * лестница и движок сравнивают оси только с порогами −60/−40/−20/0/20/40/60,
 * поэтому восьми представителей на ось хватает, чтобы покрыть ВСЕ значения
 * из [−100, 100]. 8³ конфигураций × 2¹⁵ наборов закреплённого = 16 777 216
 * состояний, и это весь достижимый вход лестницы, а не выборка.
 */
import {
  advance,
  applyDeath,
  applyEffects,
  choose,
  createInitialState,
  deedFragments,
  evalCondition,
  goTo,
  indexContent,

  lifeRecognizes,
  normalizeEntry,
  resolve,
  Rng,
  selectMemoryOnDeath,
  type ContentBundle,
  type GameState,
  type SceneNode,
} from '@nameless/engine';

export const COUNTER_SCENE = 'silver_counter';
export const LADDER_ENTRY = 'resonance';

/** Представители классов эквивалентности оси: пороги мира — ±20/±40/±60 и 0. */
export const AXIS_CLASS_REPS = [-60, -40, -20, -10, 0, 20, 40, 60];

export interface LadderOutcome {
  /** Узел, на котором лестница перестала быть развилкой. */
  terminal: string;
  /** Воспоминание, которому досыпаны осколки (лот), если досыпаны. */
  funded?: string;
  /** Воспоминание, которому начислена неустойка (архив не отозвался). */
  dust?: string;
  state: GameState;
}

function counterNodes(content: ContentBundle): Map<string, SceneNode> {
  const scene = content.scenes.find((s) => s.id === COUNTER_SCENE);
  if (!scene) throw new Error(`Нет сцены ${COUNTER_SCENE}`);
  return new Map(scene.nodes.map((n) => [n.id, n]));
}

/**
 * Прогон лестницы резонанса от узла `resonance` до первой реплики.
 * Возвращает состояние ПОСЛЕ эффектов лестницы — то самое, с которым
 * движок будет выбирать лот на узле смерти.
 */
export function walkLadder(
  nodes: Map<string, SceneNode>,
  start: GameState,
  entry = LADDER_ENTRY,
): LadderOutcome {
  let state = start;
  let id = entry;
  for (let step = 0; step < 128; step++) {
    const node = nodes.get(id);
    if (!node) throw new Error(`Лестница ушла в несуществующий узел ${id}`);
    if (node.kind === 'branch') {
      const hit = node.branches.find((b) => evalCondition(b.when, state));
      id = hit ? hit.to : node.fallback;
      continue;
    }
    if (node.kind === 'effects') {
      state = applyEffects(state, node.effects);
      const frag = node.effects.find((e) => e.kind === 'fragment');
      const memory = frag && frag.kind === 'fragment' ? frag.memory : undefined;
      const out: LadderOutcome = { terminal: node.next, state };
      if (memory) {
        if (id.startsWith('res_dust_')) out.dust = memory;
        else out.funded = memory;
      }
      // Дальше по цепочке эффектов лестница не идёт: res_frag_* и res_dust_*
      // ведут прямо в текст. Но если однажды пойдёт — доводим до реплики.
      const next = nodes.get(node.next);
      if (next && (next.kind === 'branch' || next.kind === 'effects')) {
        const tail = walkLadder(nodes, state, node.next);
        return { ...tail, funded: out.funded ?? tail.funded, dust: out.dust ?? tail.dust };
      }
      return out;
    }
    return { terminal: id, state };
  }
  throw new Error('Лестница зациклилась');
}

// ─────────────────────────────────────────────────────────────────────────────
// Инвариант 1: исчерпывающий перебор
// ─────────────────────────────────────────────────────────────────────────────

export interface ExhaustiveReport {
  axisClasses: number;
  lockedSets: number;
  combos: number;
  /** Смертей, на которых лестница не сказала ничего и ничего не начислила. */
  silent: number;
  /** Лестница досыпала осколки, а лот не закрепился — склянка в никуда. */
  fundedButNoLot: number;
  /** Лот выдан. */
  lots: number;
  /** «Раздел не отзывается»: реплика + неустойка, лота нет. */
  noEcho: number;
  /** Финал по механической линии. */
  archiveEmpty: number;
  /** `archive_empty` при неполном архиве — преждевременный финал. */
  archiveEmptyEarly: number;
  /**
   * Состояния, где Осока говорит «не отзывается», но среди незакреплённого
   * есть раздел, который движок бы узнал: значит, оставшиеся с прошлых смертей
   * осколки могли бы выдать лот вопреки реплике. Шов между контентом и движком.
   */
  noEchoSeam: number;
  /** Примеры для отчёта. */
  samples: string[];
}

export function exhaustiveLadderCheck(content: ContentBundle): ExhaustiveReport {
  const nodes = counterNodes(content);
  const memories = content.memories;
  const lifeById = new Map(content.lives.map((l) => [l.id, l]));
  const n = memories.length;
  const masks = 1 << n;

  // Наборы закреплённого и пробуждённые жизни считаются один раз на маску,
  // а не 512 раз: без этого перебор упирается в сборщик мусора.
  const lockedByMask: string[][] = new Array(masks);
  const awakenedByMask: string[][] = new Array(masks);
  for (let mask = 0; mask < masks; mask++) {
    const locked: string[] = [];
    const lives = new Set<string>();
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        const m = memories[i];
        if (!m) continue;
        locked.push(m.id);
        lives.add(m.life);
      }
    }
    lockedByMask[mask] = locked;
    awakenedByMask[mask] = [...lives];
  }

  const base = createInitialState({
    seed: 'b6',
    axes: content.axes.map((a) => ({ id: a.id, start: 0 })),
    chapter: 1,
    scene: COUNTER_SCENE,
    node: LADDER_ENTRY,
    now: 0,
  });

  const rep: ExhaustiveReport = {
    axisClasses: AXIS_CLASS_REPS.length ** 3,
    lockedSets: masks,
    combos: 0,
    silent: 0,
    fundedButNoLot: 0,
    lots: 0,
    noEcho: 0,
    archiveEmpty: 0,
    archiveEmptyEarly: 0,
    noEchoSeam: 0,
    samples: [],
  };

  for (const mercy of AXIS_CLASS_REPS) {
    for (const honesty of AXIS_CLASS_REPS) {
      for (const reason of AXIS_CLASS_REPS) {
        const axes = {
          mercy_cruelty: mercy,
          honesty_deceit: honesty,
          reason_obsession: reason,
          grasp_release: 0,
        };
        for (let mask = 0; mask < masks; mask++) {
          const state: GameState = {
            ...base,
            axes,
            lockedMemories: lockedByMask[mask] ?? [],
            awakenedLives: awakenedByMask[mask] ?? [],
          };
          rep.combos++;
          const out = walkLadder(nodes, state);
          const memory = selectMemoryOnDeath(out.state, content);

          if (out.funded) {
            if (!memory) {
              rep.fundedButNoLot++;
              if (rep.samples.length < 10) {
                rep.samples.push(
                  `досыпано ${out.funded}, лота нет: оси ${mercy}/${honesty}/${reason}, ` +
                    `закреплено ${(lockedByMask[mask] ?? []).length}`,
                );
              }
            } else {
              rep.lots++;
            }
            continue;
          }
          if (out.dust) {
            rep.noEcho++;
            // Шов: остался ли среди незакреплённого раздел, который движок узнаёт.
            const seam = memories.some((m) => {
              if ((lockedByMask[mask] ?? []).includes(m.id)) return false;
              const life = lifeById.get(m.life);
              return life ? lifeRecognizes(state, life) : true;
            });
            if (seam) rep.noEchoSeam++;
            continue;
          }
          if (out.terminal === 'archive_empty') {
            rep.archiveEmpty++;
            if (mask !== masks - 1) {
              rep.archiveEmptyEarly++;
              if (rep.samples.length < 10) {
                rep.samples.push(
                  `archive_empty при ${(lockedByMask[mask] ?? []).length}/15: ` +
                    `оси ${mercy}/${honesty}/${reason}`,
                );
              }
            }
            continue;
          }
          rep.silent++;
          if (rep.samples.length < 10) {
            rep.samples.push(`молчание в ${out.terminal}: оси ${mercy}/${honesty}/${reason}`);
          }
        }
      }
    }
  }
  return rep;
}

// ─────────────────────────────────────────────────────────────────────────────
// Инвариант 2: три личности приходят к разным наборам
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonaProfile {
  id: string;
  name: string;
  /** Вес оси: +1 — тянуть к положительному полюсу, −1 — к отрицательному. */
  weights: Record<string, number>;
  /** Личность, которая переменилась: после стольких смертей веса переворачиваются. */
  turnAt?: number;
}

/**
 * Три профиля — те же три личности, которыми игрался плейтест
 * (`PLAYTEST_REPORT` §«Оси и отряд»), с одной поправкой: «расследующий» стал
 * «рассудочным», потому что после починки оси рассудка (`PROGRESSION_FIX` §1)
 * полюс рассудка наконец достижим, и именно он — самый интересный случай:
 * у рассудка нет своей жизни, это канон (CANON 5, конец раздела).
 */
export const PERSONAS: PersonaProfile[] = [
  {
    id: 'cruel',
    name: 'жестокий',
    weights: { mercy_cruelty: -1, honesty_deceit: -0.6, reason_obsession: -0.5, grasp_release: 0.3 },
  },
  {
    id: 'merciful',
    name: 'милосердный',
    weights: { mercy_cruelty: 1, honesty_deceit: 0.6, reason_obsession: -0.5, grasp_release: -0.3 },
  },
  {
    id: 'reasoning',
    name: 'рассудочный',
    weights: {
      mercy_cruelty: -0.15,
      honesty_deceit: 1,
      reason_obsession: 1,
      grasp_release: 0.2,
    },
  },
];

/** Случайные личности — для распределения размеров набора, а не для примеров. */
export function randomPersonas(count: number, content: ContentBundle): PersonaProfile[] {
  const out: PersonaProfile[] = [];
  for (let i = 0; i < count; i++) {
    const rng = new Rng(`b6:rand:${i}`);
    const weights: Record<string, number> = {};
    for (const a of content.axes) weights[a.id] = rng.next() * 2 - 1;
    out.push({ id: `rand${i}`, name: `случайная ${i}`, weights });
  }
  return out;
}

/** Четвёртый профиль — сверх задания: личность, которая переменилась на полпути. */
export const TURNED_PERSONA: PersonaProfile = {
  id: 'turned',
  name: 'переменившийся',
  weights: { mercy_cruelty: -1, honesty_deceit: -0.6, reason_obsession: -0.5, grasp_release: 0.3 },
  turnAt: 6,
};

export interface PersonaRun {
  persona: string;
  deaths: number;
  locked: string[];
  lives: string[];
  /** Смертей с выданным лотом. */
  lots: number;
  /** Смертей, на которых архив не отозвался (реплика + неустойка). */
  noEcho: number;
  /** Смертей без лота и без реплики — этого быть не должно. */
  silent: number;
  /** Лестница досыпала, а лот не закрепился — этого быть не должно. */
  fundedButNoLot: number;
  /** Осока сказала «не отзывается», а лот всё же вышел — шов. */
  seam: number;
  /** Осколки, набранные поступками (без неустоек), к концу прогона. */
  deedShards: Record<string, number>;
  axes: Record<string, number>;
}

/** Сколько осколков за игру досыпала лестница (её след — служебный счётчик). */
function resonanceTotal(state: GameState): number {
  let sum = 0;
  for (const [k, v] of Object.entries(state.counters)) {
    if (k.startsWith('_res:')) sum += v;
  }
  return sum;
}

/** Выбор варианта личностью: берём тот, что сильнее тянет в её сторону. */
function scoreOption(
  effects: { kind: string; axis?: string; delta?: number }[] | undefined,
  weights: Record<string, number>,
): number {
  if (!effects) return 0;
  let score = 0;
  for (const e of effects) {
    if (e.kind === 'axis' && e.axis && typeof e.delta === 'number') {
      score += (weights[e.axis] ?? 0) * e.delta;
    }
  }
  return score;
}

/**
 * Прогон личности: она проходит игру по-настоящему (сцены, бои, выборы),
 * а когда игра кончается раньше нужного числа смертей — снова встаёт в
 * очередь у Прилавка. Оси, осколки и закреплённое переносятся как есть.
 */
export function personaRun(
  content: ContentBundle,
  profile: PersonaProfile,
  targetDeaths = 16,
): PersonaRun {
  const idx = indexContent(content);
  const rng = new Rng(`b6:${profile.id}`);
  const firstChapter = [...content.chapters].sort((a, b) => a.index - b.index)[0];
  if (!firstChapter) throw new Error('Нет глав');

  let state = normalizeEntry(
    idx,
    createInitialState({
      seed: `b6:${profile.id}`,
      axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
      chapter: firstChapter.index,
      scene: firstChapter.entryScene,
      node: '@entry',
      now: 0,
    }),
  );

  const run: PersonaRun = {
    persona: profile.name,
    deaths: 0,
    locked: [],
    lives: [],
    lots: 0,
    noEcho: 0,
    silent: 0,
    fundedButNoLot: 0,
    seam: 0,
    deedShards: {},
    axes: {},
  };
  let resSeen = 0;
  // Игра не обязана предложить шестнадцать смертей подряд: в хабе главы 3
  // личность может ходить кругами сколько угодно. Застрявшую отправляем в
  // очередь сами — мерим церемонию, а не проходимость.
  let stall = 0;

  for (let step = 0; step < 200_000 && run.deaths < targetDeaths; step++) {
    const r = resolve(idx, state);
    state = r.state;
    if (r.step.kind === 'error' || r.step.kind === 'end' || ++stall > 400) {
      stall = 0;
      state = normalizeEntry(idx, goTo(state, `scene:${COUNTER_SCENE}#queue_entry`));
      continue;
    }
    if (r.step.kind === 'bubble') {
      state = advance(idx, state);
      continue;
    }
    if (r.step.kind === 'choice') {
      const options = r.step.options;
      if (options.length === 0) {
        state = normalizeEntry(idx, goTo(state, `scene:${COUNTER_SCENE}#queue_entry`));
        continue;
      }
      const weights =
        profile.turnAt !== undefined && run.deaths >= profile.turnAt
          ? Object.fromEntries(Object.entries(profile.weights).map(([k, v]) => [k, -v]))
          : profile.weights;
      let best = options[0];
      let bestScore = -Infinity;
      for (const o of options) {
        // Жребий только для ничьих: без него личность в хабе ходит по кругу.
        const s = scoreOption(o.effects, weights) + rng.next() * 0.5;
        if (s > bestScore) {
          bestScore = s;
          best = o;
        }
      }
      if (!best) return run;
      state = choose(idx, state, best.id);
      continue;
    }
    if (r.step.kind === 'battle') {
      const battleNode = r.step.node;
      const won = rng.chance(0.7);
      const def = content.battles.find((b) => b.id === battleNode.battle);
      if (won && def?.rewards) state = applyEffects(state, def.rewards, idx.effectCtx);
      state = normalizeEntry(idx, goTo(state, won ? battleNode.onWin : battleNode.onLose));
      continue;
    }
    if (r.step.kind === 'death') {
      const deathId = r.step.node.death;
      const death = content.deaths.find((d) => d.id === deathId);
      if (!death) return run;
      // Чем кончилась лестница на этой смерти, видно по её следу: неустойка —
      // ровно один осколок, досыпка лота — цена воспоминания, то есть два и
      // больше. Ноль означает, что лестница не сделала ничего.
      const granted = resonanceTotal(state) - resSeen;
      resSeen += granted;
      const out = applyDeath(state, content, death, idx.effectCtx);
      state = out.state;
      run.deaths++;
      stall = 0;
      if (granted >= 2) {
        if (out.memory) run.lots++;
        else run.fundedButNoLot++;
      } else if (granted === 1) {
        run.noEcho++;
        if (out.memory) run.seam++;
      } else if (out.memory) {
        run.lots++;
      } else {
        run.silent++;
      }
      continue;
    }
  }

  run.locked = [...state.lockedMemories];
  run.lives = [...state.awakenedLives];
  run.axes = { ...state.axes };
  for (const m of content.memories) {
    const deed = deedFragments(state, m);
    if (deed > 0) run.deedShards[m.id] = deed;
  }
  return run;
}

export function lifeOfMemory(content: ContentBundle, id: string): string {
  return content.memories.find((m) => m.id === id)?.life ?? '?';
}
