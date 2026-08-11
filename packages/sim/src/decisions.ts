/**
 * Прибор к жалобе владельца «бой не динамичный и скучный».
 *
 * `DIRECTION_COMBAT.md` §A.1 формулирует диагноз словами: «лучший ход
 * вычисляется, а не выбирается» — жадная эвристика `planAction` в сорок строк
 * играет почти оптимально, значит развилок в пространстве решений нет. Здесь
 * это утверждение превращается в число, которое можно проверить машиной и
 * сравнить до и после правок Б2–Б10.
 *
 * ─── Что считается «ходом без решения» ──────────────────────────────────────
 *
 * На каждом ходу стороны игрока прибор:
 *   1. перечисляет ВСЕ законные действия актора (способность × цель), схлопывая
 *      площадные в один вариант на область — иначе «ударить по всем, целясь в
 *      первого» и «ударить по всем, целясь во второго» считались бы двумя
 *      разными решениями, хотя это одно и то же действие;
 *   2. если вариант один — ход ВЫНУЖДЕННЫЙ: решения не предлагали вовсе;
 *   3. иначе каждый вариант прокатывается до конца боя R раз и получает оценку;
 *   4. если жадный ход набрал не меньше лучшего (с точностью до ε) — ход БЕЗ
 *      РЕШЕНИЯ: считать было нечего, арифметика на экране даёт ответ.
 *
 * `доля ходов без решения = (вынужденные + жадный-и-есть-лучший) / все ходы`.
 *
 * ─── Оценка прогона: почему не винрейт ──────────────────────────────────────
 *
 * Винрейт — бинарная величина: при R прогонах его стандартная ошибка ≈ 0.5/√R,
 * то есть при R = 6 около 20 пунктов. Прибор мерил бы собственный шум. Оценка
 * здесь непрерывная — ЗАПАС, с которым бой кончился:
 *
 *     score = доля hp, оставшаяся у отряда − доля hp, оставшаяся у врага
 *
 * Победа даёт положительное число (у врага ноль), поражение — отрицательное,
 * и между «выиграл в ноль» и «выиграл целым отрядом» есть разница. Разброс
 * такой оценки в разы меньше, чем у флага победы.
 *
 * ─── Общие случайные числа ──────────────────────────────────────────────────
 *
 * Все варианты одного хода катаются на ОДНОМ И ТОМ ЖЕ наборе сидов. Тогда
 * разница между вариантами — это разница действий, а не разница жеребьёвок:
 * критический удар, выпавший в прогоне №3, выпадет в нём у всех вариантов.
 * Без этого приёма ε пришлось бы задирать втрое.
 *
 * ─── Честность прибора ──────────────────────────────────────────────────────
 *
 * Прибор обязан уметь сказать «я этого не различаю». Поэтому на каждом ходу
 * жадный вариант оценивается ДВАЖДЫ — двумя разными семьями сидов, — и разница
 * между двумя оценками одного и того же действия копится как шум. Если шум
 * окажется сравним с ε, число «ходов с решением» — это шум, и `cli.ts` говорит
 * об этом вслух отдельной строкой.
 */
import {
  act,
  autoAct,
  commonActions,
  currentActor,
  indexCombat,
  legalTargets,
  planAction,
  readyAbilities,
  readyPlayerAbilities,
  runAuto,
  startBattle,
  Rng,
  type Ability,
  type Action,
  type BattleDef,
  type BattleState,
  type CombatIndex,
  type ContentBundle,
  type PartyUnit,
  type PlayerAbility,
} from '@nameless/engine';

/**
 * Порог безразличия: насколько лучший ход должен обыгрывать жадный, чтобы
 * счесть, что на этом ходу было что решать.
 *
 * 0.04 — четыре процента общей полосы здоровья отряда. Меньше игрок не
 * почувствует: разброс урона в движке ±12%, крит 8%, и ход, выигрывающий два
 * процента полосы, отличается от жадного только на бумаге. Больше — прибор
 * перестал бы замечать настоящие развилки.
 */
export const DECISION_EPS = 0.04;

/**
 * Целевой предел доли ходов без решения (`docs/БОЙ_ЗАМЕРЫ.md`, метрика А).
 *
 * 70% выбраны не из вкуса, а из арифметики раунда. Сторона игрока ходит
 * примерно трижды за раунд (шесть клеток строя, из них живых к середине боя
 * три-четыре). При доле ходов без решения p раунд приносит 3·(1−p) развилок;
 * p = 0.70 — это ровно одна развилка на раунд. Договор простой и проверяемый:
 * **в каждом раунде игрок хотя бы раз решает, а не считает**. Сегодняшние 84%
 * дают одну развилку на два раунда — и именно это владелец назвал скукой
 * (DIRECTION_COMBAT §A.1: «лучший ход вычисляется, а не выбирается»).
 */
export const NO_DECISION_MAX = 0.7;

/**
 * Число прокатов на вариант — ЧАСТЬ ОПРЕДЕЛЕНИЯ метрики, а не настройка
 * скорости.
 *
 * Развилка засчитывается только доказанная (превосходство больше двух
 * стандартных ошибок), а сила доказательства растёт с числом прокатов: при 8
 * прокатах прибор насчитал 91% ходов без решения, при 16 — 88%, при 32 — 84%.
 * Значит, сравнивать «было» и «стало» можно только при одном и том же числе
 * прокатов, и оно закреплено здесь, а не берётся из `--runs`. 32 выбраны по
 * точке, где шум разницы (≈0.029) уходит ниже порога заметности ε = 0.04: с
 * этого места вердикт определяет смысл, а не жеребьёвка.
 */
export const DECISION_ROLLOUTS = 32;
/** Прогонов боя на разбор. Ходов набирается около 390 — этого хватает на ±2 пункта. */
export const DECISION_RUNS = 1;

export interface DecisionReport {
  battle: string;
  /** Сколько ходов стороны игрока разобрано. */
  turns: number;
  /** Ходов, где вариант был ровно один: решение не предлагали. */
  forced: number;
  /** Ходов, где вариантов много, но жадный не хуже лучшего. */
  greedyOptimal: number;
  /** forced + greedyOptimal. */
  noDecision: number;
  /** Среднее число различимых вариантов на ходу — ширина выбора. */
  branching: number;
  /**
   * Средний проигрыш жадного лучшему, в долях полосы здоровья отряда.
   * Ноль означает «эвристика играет идеально»; это и есть жалоба §A.1.
   */
  regret: number;
  /** Шум прибора: одно и то же действие, две разные семьи сидов. */
  noise: number;
}

export interface DecisionSummary {
  perBattle: DecisionReport[];
  turns: number;
  forced: number;
  greedyOptimal: number;
  noDecision: number;
  noDecisionShare: number;
  forcedShare: number;
  branching: number;
  regret: number;
  /** Средний шум прибора: с ним сравнивают ε, иначе цифра ничего не значит. */
  noise: number;
  /** Худший (наибольший) шум по бою — верхняя оценка разрешающей способности. */
  noiseMax: number;
}

/**
 * Различимые действия актора. Площадные схлопываются: у «ударить по всем»
 * выбор цели ничего не меняет, у «ударить по ряду» вариантов ровно столько,
 * сколько занятых рядов.
 */
function candidates(idx: CombatIndex, state: BattleState, actorUid: string): Action[] {
  const actor = state.units.find((u) => u.uid === actorUid);
  if (!actor) return [];
  const abilities: { id: string; ability: Ability }[] = [
    ...readyAbilities(idx, actor).map((a) => ({ id: a.id, ability: a })),
    // Общие действия правил боя («Заслонить»): слота в наборе они не занимают,
    // но игроку предъявлены наравне с кнопками — значит, и прибор обязан их
    // перечислять. Не перечисляли бы — метрика мерила бы бой без механики.
    ...commonActions(idx, actor).map((a) => ({ id: a.id, ability: a })),
    ...readyPlayerAbilities(state, actor).map((p: PlayerAbility) => ({ id: p.id, ability: p.ability })),
  ];
  const out: Action[] = [];
  for (const { id, ability } of abilities) {
    const targets = legalTargets(state, actorUid, ability);
    if (targets.length === 0) continue;
    switch (ability.target) {
      case 'self':
      case 'enemy_all':
      case 'ally_all':
        // Одно действие: выбор цели ни на что не влияет.
        out.push({ ability: id, targetUid: targets[0]?.uid });
        break;
      case 'enemy_row':
      case 'ally_row': {
        for (const row of ['front', 'back'] as const) {
          const first = targets.find((u) => u.row === row);
          if (first) out.push({ ability: id, targetUid: first.uid });
        }
        break;
      }
      default:
        for (const t of targets) out.push({ ability: id, targetUid: t.uid });
    }
  }
  return out;
}

/** Запас, с которым бой кончился: доля hp отряда минус доля hp врага. */
function margin(state: BattleState): number {
  let ph = 0;
  let pm = 0;
  let eh = 0;
  let em = 0;
  for (const u of state.units) {
    if (u.side === 'player') {
      ph += Math.max(0, u.hp);
      pm += u.maxHp;
    } else {
      eh += Math.max(0, u.hp);
      em += u.maxHp;
    }
  }
  return (pm > 0 ? ph / pm : 0) - (em > 0 ? eh / em : 0);
}

/**
 * Запас по каждому прогону. Возвращается СПИСОК, а не среднее: разница двух
 * действий считается попрогонно (одна жеребьёвка — одна пара), и по этим же
 * парам считается стандартная ошибка разницы. Среднее такой возможности не
 * даёт.
 *
 * Сиды передаются снаружи — так все варианты одного хода катаются по одной и
 * той же жеребьёвке (см. шапку файла).
 */
function probe(
  idx: CombatIndex,
  state: BattleState,
  action: Action,
  seeds: readonly string[],
): number[] {
  return seeds.map((seed) => {
    const seeded: BattleState = { ...state, rng: new Rng(seed).snapshot() };
    return margin(runAuto(idx, act(idx, seeded, action)));
  });
}

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, x) => a + x, 0) / xs.length;
}

/** Стандартная ошибка среднего по выборке. */
function stderr(xs: readonly number[]): number {
  if (xs.length < 2) return Infinity;
  const m = mean(xs);
  const varSum = xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(varSum / xs.length);
}

function sameAction(a: Action, b: Action): boolean {
  return a.ability === b.ability && a.targetUid === b.targetUid;
}

export interface DecisionOptions {
  /** Прокатов на вариант. Меньше четырёх — прибор мерит жеребьёвку. */
  rollouts?: number;
  /** Прогонов боя, по которым идёт разбор ходов. */
  runs?: number;
  /** Умения игрока, с которыми меряем. По умолчанию — без умений, как база §D.1. */
  powers?: readonly PlayerAbility[];
}

/**
 * Разбор одного боя. Траектория — ЖАДНАЯ: ходы делает та самая эвристика,
 * про которую написан §A.1. Так прибор меряет бой, каким его видит игрок,
 * играющий «правильно», а не бой в вымышленной идеальной линии.
 */
function measureBattle(
  idx: CombatIndex,
  battleId: string,
  battle: BattleDef,
  party: PartyUnit[],
  opts: Required<Pick<DecisionOptions, 'rollouts' | 'runs'>> & { powers?: readonly PlayerAbility[] },
): DecisionReport {
  let turns = 0;
  let forced = 0;
  let greedyOptimal = 0;
  let branching = 0;
  let regret = 0;
  let noise = 0;
  let noiseSamples = 0;

  for (let run = 0; run < opts.runs; run++) {
    let state = startBattle(idx, battle, party, `dec:${battleId}:${run}`, opts.powers);
    // Предел шагов тот же, что у runAuto: бой обязан кончиться сам.
    for (let step = 0; step < 2000 && state.outcome === 'ongoing'; step++) {
      const actor = currentActor(state);
      if (!actor || actor.side !== 'player') {
        state = autoAct(idx, state);
        continue;
      }
      const options = candidates(idx, state, actor.uid);
      const greedy = planAction(idx, state, actor);
      turns++;
      branching += Math.max(1, options.length);
      if (options.length <= 1 || !greedy) {
        forced++;
        state = autoAct(idx, state);
        continue;
      }
      /*
       * ОТБОР И ПРОВЕРКА РАЗВЕДЕНЫ ПО РАЗНЫМ ЖЕРЕБЬЁВКАМ — иначе прибор врал бы
       * систематически, а не случайно. Максимум пяти шумных оценок сам по себе
       * завышен («проклятие победителя»): при пяти вариантах и шуме σ лучший из
       * них в среднем на 1.5σ выше своего истинного значения, и любой бой
       * выглядел бы полным развилок, даже если все ходы равноценны. Первая
       * семья сидов ТОЛЬКО выбирает претендента, вторая ТОЛЬКО меряет, на
       * сколько он обыгрывает жадный ход. Смещение отбора во вторую семью не
       * переносится.
       */
      const key = `${battleId}:${run}:${state.round}:${state.turnIndex}`;
      const seedsA = Array.from({ length: opts.rollouts }, (_, i) => `pickA:${key}:${i}`);
      const seedsB = Array.from({ length: opts.rollouts }, (_, i) => `testB:${key}:${i}`);
      let challenger: Action | undefined;
      let bestPick = -Infinity;
      for (const option of options) {
        if (sameAction(option, greedy)) continue;
        const m = mean(probe(idx, state, option, seedsA));
        if (m > bestPick) {
          bestPick = m;
          challenger = option;
        }
      }
      if (!challenger) {
        // Все варианты — тот же самый жадный ход: решать нечего.
        greedyOptimal++;
        state = autoAct(idx, state);
        continue;
      }
      const rivalB = probe(idx, state, challenger, seedsB);
      const greedyB = probe(idx, state, greedy, seedsB);
      // Разница попрогонно: одна жеребьёвка — одна пара. По этим же парам
      // считается стандартная ошибка, то есть прибор сам говорит, что он
      // различает.
      const paired = rivalB.map((v, i) => v - (greedyB[i] as number));
      const gain = mean(paired);
      const se = stderr(paired);
      noise += se;
      noiseSamples++;
      regret += Math.max(0, gain);
      /*
       * Ход считается ходом С РЕШЕНИЕМ, только если превосходство соперника
       * над жадным одновременно ЗАМЕТНО (больше ε) и ДОКАЗАНО (больше двух
       * стандартных ошибок разницы). Второе условие — не педантизм: шум
       * прибора сравним с ε, и без проверки на значимость каждый шестой
       * равноценный ход записывался бы в развилки, а прибор показывал бы
       * решения там, где их нет. Сомнение всегда толкуется в пользу жалобы
       * владельца: не доказали развилку — значит, ход без решения.
       */
      if (!(gain > DECISION_EPS && gain > 2 * se)) greedyOptimal++;
      state = autoAct(idx, state);
    }
  }

  const n = Math.max(1, turns);
  return {
    battle: battleId,
    turns,
    forced,
    greedyOptimal,
    noDecision: forced + greedyOptimal,
    branching: branching / n,
    regret: regret / n,
    noise: noise / Math.max(1, noiseSamples),
  };
}

/**
 * Доля ходов без решения по всем сюжетным боям.
 *
 * Летальные и знакомства исключены по той же причине, что и на лестнице
 * ступеней: исход первых задан сценарием, вторые кончаются за два раунда, и
 * ни те, ни другие ничего не говорят о развилках.
 */
export function decisionDensity(
  content: ContentBundle,
  partyForBattle: (battleId: string) => PartyUnit[],
  opts: DecisionOptions = {},
): DecisionSummary {
  const idx = indexCombat(content);
  const rollouts = opts.rollouts ?? DECISION_ROLLOUTS;
  const runs = opts.runs ?? DECISION_RUNS;
  const battles = content.battles.filter(
    (b) => !b.tags?.includes('lethal') && !b.tags?.includes('tutorial'),
  );
  const perBattle = battles.map((b) =>
    measureBattle(idx, b.id, b, partyForBattle(b.id), {
      rollouts,
      runs,
      ...(opts.powers ? { powers: opts.powers } : {}),
    }),
  );
  const turns = perBattle.reduce((a, r) => a + r.turns, 0);
  const forced = perBattle.reduce((a, r) => a + r.forced, 0);
  const greedyOptimal = perBattle.reduce((a, r) => a + r.greedyOptimal, 0);
  const n = Math.max(1, turns);
  const weighted = (pick: (r: DecisionReport) => number): number =>
    perBattle.reduce((a, r) => a + pick(r) * r.turns, 0) / n;
  return {
    perBattle,
    turns,
    forced,
    greedyOptimal,
    noDecision: forced + greedyOptimal,
    noDecisionShare: (forced + greedyOptimal) / n,
    forcedShare: forced / n,
    branching: weighted((r) => r.branching),
    regret: weighted((r) => r.regret),
    noise: weighted((r) => r.noise),
    noiseMax: perBattle.reduce((a, r) => Math.max(a, r.noise), 0),
  };
}
