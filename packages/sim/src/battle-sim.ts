/**
 * Симулятор боёв бот-против-бота. Считает винрейты юнитов и составов.
 * Балансовый коридор: любой юнит вне 42–58% — повод править статы.
 */
import {
  indexCombat,
  runAuto,
  startBattle,
  Rng,
  type Ability,
  type BattleDef,
  type ContentBundle,
  type PartyUnit,
  type PlayerAbility,
  type UnitDef,
} from '@nameless/engine';

export const WINRATE_MIN = 0.42;
export const WINRATE_MAX = 0.58;
/**
 * Двойной коридор сюжетных боёв (MEMORY_POWERS §D.1).
 *
 * База БЕЗ умений — 55–75 при медиане главы 63–68. Прежние 60–85 остались
 * коридором боя при игроке С умениями: одна вспомненная жизнь любой ступени —
 * типовое состояние по B6, и мерить бой без умений тем же числом означало бы
 * мерить состояние, в котором игрок почти не бывает.
 */
export const BASE_MIN = 0.55;
export const BASE_MAX = 0.75;
export const BASE_MEDIAN_MIN = 0.63;
export const BASE_MEDIAN_MAX = 0.68;
export const POWER_MIN = 0.6;
export const POWER_MAX = 0.85;
/**
 * Допуск на ступень: насколько ступень умения поднимает винрейт над базой
 * без умений. Прежние «5–15 на ступень» отменены §D.1 как несовместимые с
 * потолком 85; новый допуск — 3–10 на каждую ступень (не на шаг между
 * ступенями: шаг II→III у трёх вершин отрицателен по замыслу, §A.7).
 */
export const TIER_GAIN_MIN = 3;
export const TIER_GAIN_MAX = 10;

/**
 * Контрольный прибор на отклик (§D.1): сколько даёт умение, которое НЕ ДЕЛАЕТ
 * НИЧЕГО, но у которого живая жизнь и живые сродственные.
 *
 * Зачем он существует. Прибавка ступени складывается из двух слагаемых —
 * самого умения и отклика сродственных, — и по общей цифре их не различить.
 * Однажды на этом уже обожглись: пустое умение давало +11.3 винрейта, то есть
 * почти всю прибавку платил отклик, а резали числа умений. Пустышка разводит
 * слагаемые: всё, что она набрала, — цена отклика и ничего больше.
 */
export const EMPTY_POWER_GAIN_MAX = 4;

/** Медиана списка. Чётная длина — среднее двух средних, как принято в отчётах. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const xs = values.slice().sort((a, b) => a - b);
  const mid = xs.length >> 1;
  return xs.length % 2 === 1 ? (xs[mid] as number) : (((xs[mid - 1] as number) + (xs[mid] as number)) / 2);
}
/**
 * Полуширина коридора вокруг ИЗМЕРЕННОЙ нулевой точки турнира.
 *
 * Нулевая точка не равна 50%: враги телеграфируют намерения в начале раунда
 * (`rollIntents`), а сторона игрока переприцеливается в момент хода — и потому
 * зеркало самого себя выигрывает примерно в 55% случаев. Это не баг, а
 * геймплейное решение (иконки намерений), поэтому симулятор не выправляет
 * асимметрию, а честно калибруется по ней.
 */
export const CORRIDOR_HALF_WIDTH = 0.08;
/** Бой короче — не успевает стать тактикой, длиннее — надоедает на телефоне. */
export const ROUNDS_MIN = 6;
export const ROUNDS_MAX = 14;

export interface UnitWinrate {
  unit: string;
  tier: number;
  battles: number;
  wins: number;
  winrate: number;
  /** Измеренная нулевая точка турнира для этого тира. */
  neutral: number;
  avgRounds: number;
  inCorridor: boolean;
  /** В тире меньше четырёх соседей: цифра справочная, коридор к ней неприменим. */
  thinSample: boolean;
}

export interface BattleReport {
  battle: string;
  runs: number;
  winrate: number;
  avgRounds: number;
  /** Средняя доля выживших юнитов игрока — метрика «бой был напряжённым». */
  avgSurvivors: number;
}

/**
 * Раскладка отряда по клеткам. Предпочтение ряда уважается, но строй
 * заполняется целиком: иначе отряд из пяти «передних» юнитов выходил бы вчетвером
 * против шестерых, и симулятор мерил бы размер отряда, а не силу юнита.
 */
function fillSlots(units: readonly UnitDef[]): PartyUnit[] {
  const front: UnitDef[] = [];
  const back: UnitDef[] = [];
  for (const u of units) {
    const prefer = u.row === 'front' ? front : back;
    const other = u.row === 'front' ? back : front;
    if (prefer.length < 3) prefer.push(u);
    else if (other.length < 3) other.push(u);
  }
  const out: PartyUnit[] = [];
  front.forEach((u, i) =>
    out.push({ uid: `p${out.length}:${u.id}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row: 'front', index: i } }),
  );
  back.forEach((u, i) =>
    out.push({ uid: `p${out.length}:${u.id}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row: 'back', index: i } }),
  );
  return out;
}

function partyFrom(units: readonly UnitDef[]): PartyUnit[] {
  return fillSlots(units);
}

function adHocBattle(id: string, units: readonly UnitDef[]): BattleDef {
  const placed = fillSlots(units);
  return {
    id,
    name: { ru: id, en: id },
    enemies: placed.map((p) => ({ unit: p.defId, row: p.slot.row, index: p.slot.index })),
  };
}

/**
 * Зеркальный турнир методом замены одного слота.
 *
 * Обе стороны получают ОДИН И ТОТ ЖЕ эталонный отряд из пула, после чего у
 * испытуемого одна клетка заменяется на проверяемого юнита. Винрейт 50% читается
 * буквально: «юнит ровно настолько же полезен, насколько тот, кого он вытеснил».
 * Прежняя схема (три копии юнита против случайного отряда) мерила везение
 * жеребьёвки и давала разброс, не связанный со статами.
 */
export function unitWinrates(content: ContentBundle, runsPerUnit = 60): UnitWinrate[] {
  const idx = indexCombat(content);
  const byTier = new Map<number, UnitDef[]>();
  for (const u of content.units) {
    const list = byTier.get(u.tier) ?? [];
    list.push(u);
    byTier.set(u.tier, list);
  }

  // Калибровка: одинаковые составы с обеих сторон. Всё, что заметно выше или
  // ниже этого числа, — вклад самого юнита, а не перекос харнесса.
  const neutralByTier = new Map<number, number>();
  for (const tier of new Set(content.units.map((u) => u.tier))) {
    const pool = content.units.filter((u) => u.tier === tier);
    const wide = pool.length >= 4 ? pool : content.units;
    let wins = 0;
    let played = 0;
    // Калибровка гоняется щедро: это одно число на весь тир, и его дрожание
    // ±7 пунктов между прогонами делало вердикт по юнитам случайным.
    const calibrationRuns = Math.max(300, runsPerUnit * 3);
    for (let i = 0; i < calibrationRuns; i++) {
      const rng = new Rng(`calib:${tier}:${i}`);
      const team = rng.shuffle(wide.concat(wide, wide)).slice(0, 6);
      if (team.length < 2) continue;
      const st = runAuto(idx, startBattle(idx, adHocBattle(`calib:${tier}:${i}`, team), fillSlots(team), `calib:${tier}:${i}`));
      played++;
      if (st.outcome === 'win') wins++;
    }
    neutralByTier.set(tier, played > 0 ? wins / played : 0.5);
  }

  const out: UnitWinrate[] = [];
  for (const unit of content.units) {
    // Эталон набирается из своего тира; если соседей мало, турнир вырождается,
    // и мы добираем соседние тиры — иначе цифра говорит о размере выборки.
    let pool = (byTier.get(unit.tier) ?? []).filter((u) => u.id !== unit.id);
    const thinSample = pool.length < 4;
    if (thinSample) {
      const neighbours = [unit.tier - 1, unit.tier + 1]
        .flatMap((t) => byTier.get(t) ?? [])
        .filter((u) => u.id !== unit.id);
      pool = [...pool, ...neighbours];
    }
    if (pool.length === 0) {
      out.push({
        unit: unit.id,
        tier: unit.tier,
        battles: 0,
        wins: 0,
        winrate: 0.5,
        neutral: neutralByTier.get(unit.tier) ?? 0.5,
        avgRounds: 0,
        inCorridor: true,
        thinSample,
      });
      continue;
    }

    const neutral = neutralByTier.get(unit.tier) ?? 0.5;
    let wins = 0;
    let rounds = 0;
    let played = 0;
    for (let i = 0; i < runsPerUnit; i++) {
      const rng = new Rng(`wr:${unit.id}:${i}`);
      const baseline = rng.shuffle(pool.concat(pool, pool)).slice(0, 6);
      if (baseline.length < 2) continue;

      // Вытесняем юнита того же ряда — иначе замена меняет ещё и строй.
      let victim = baseline.findIndex((u) => u.row === unit.row);
      if (victim === -1) victim = 0;
      const challenger = baseline.slice();
      challenger[victim] = unit;

      const battle = adHocBattle(`sim:${unit.id}:${i}`, baseline);
      const st = runAuto(idx, startBattle(idx, battle, fillSlots(challenger), `wr:${unit.id}:${i}`));
      played++;
      rounds += st.round;
      if (st.outcome === 'win') wins++;
    }
    const winrate = played > 0 ? wins / played : 0.5;
    out.push({
      unit: unit.id,
      tier: unit.tier,
      battles: played,
      wins,
      winrate,
      avgRounds: played > 0 ? rounds / played : 0,
      neutral,
      inCorridor: thinSample || Math.abs(winrate - neutral) <= CORRIDOR_HALF_WIDTH,
      thinSample,
    });
  }
  return out.sort((a, b) => a.winrate - b.winrate);
}

/**
 * Сюжетные бои: игрок должен выигрывать их уверенно, но не бесплатно.
 * Целевой коридор для боёв главы — 60–85% побед у бота-игрока
 * (живой игрок играет лучше бота, значит бой будет ощущаться посильным).
 */
/**
 * @param powersForBattle умения игрока, с которыми мерить бой. Не передали —
 * бой меряется без умений, ровно как раньше: сегодня это и есть правда, потому
 * что ни одно воспоминание умений не даёт. Когда канон их принесёт, отсюда
 * поедет честная цифра — бот-игрок умеет ими пользоваться (см. `planAction`).
 */
export function scriptedBattles(
  content: ContentBundle,
  partyForBattle: (battleId: string) => PartyUnit[],
  runs = 40,
  powersForBattle?: (battleId: string) => readonly PlayerAbility[],
): BattleReport[] {
  const idx = indexCombat(content);
  const out: BattleReport[] = [];
  for (const b of content.battles) {
    const party = partyForBattle(b.id);
    const powers = powersForBattle?.(b.id);
    let wins = 0;
    let rounds = 0;
    let survivors = 0;
    for (let i = 0; i < runs; i++) {
      const st = runAuto(idx, startBattle(idx, b, party, `scripted:${b.id}:${i}`, powers));
      rounds += st.round;
      if (st.outcome === 'win') wins++;
      const alivePlayers = st.units.filter((u) => u.side === 'player' && u.alive).length;
      const totalPlayers = st.units.filter((u) => u.side === 'player').length || 1;
      survivors += alivePlayers / totalPlayers;
    }
    out.push({
      battle: b.id,
      runs,
      winrate: wins / runs,
      avgRounds: rounds / runs,
      avgSurvivors: survivors / runs,
    });
  }
  return out;
}

/**
 * Замер одной ступени одного умения (MEMORY_POWERS §D.1–D.3, D.6).
 *
 * Что здесь меряется и почему именно это:
 * - `winrate`/`avgRounds` — коридоры 60–85 и 6–14 обязаны держаться на каждой
 *   ступени, иначе умение чинится, а не коридор;
 * - `usedShare` — доля боёв, где заряд вообще потрачен. Умение, которое бот
 *   не применяет, замерено не было: цифры выше означали бы «бой без умения»;
 * - `responsesPerBattle` — 1–3 по канону. Ноль значит, что сродство мертво;
 *   больше четырёх — что отряд собирается только под него.
 */
export interface PowerLadderReport {
  life: string;
  tier: number;
  battles: number;
  winrate: number;
  avgRounds: number;
  usedShare: number;
  responsesPerBattle: number;
  /** Набор состоит только из пассивов: тратить нечего, `usedShare` бессмыслен. */
  passiveOnly: boolean;
  /** Худший и лучший бой набора — по ним видно выход за коридор 60–85. */
  minWinrate: number;
  maxWinrate: number;
  /** Сколько боёв вышло за коридор 60–85. */
  outOfCorridor: number;
  /** Винрейты по боям — по ним видно, вверх бой вышел или вниз. */
  perBattle: { battle: string; winrate: number }[];
}

/**
 * Умение-пустышка: цель законная, эффектов нет, жизнь настоящая.
 *
 * Ход носителя оно тратит наравне с настоящим — иначе замер сравнивал бы не
 * «умение против отклика», а «умение против лишнего хода».
 */
export function emptyPower(life: string): PlayerAbility {
  const ability: Ability = {
    id: `__empty_${life}`,
    name: { ru: 'пустое умение', en: 'empty power' },
    description: { ru: 'ничего не делает', en: 'does nothing' },
    icon: 'spark',
    target: 'enemy_any',
    power: 0,
    cooldown: 99,
    effects: [],
  };
  return {
    id: ability.id,
    ability,
    grantedBy: [],
    amplifiedBy: [],
    amplify: {},
    costsTurn: true,
    life,
    // Пустышка изображает первую ступень: ниже неё умений не бывает.
    tier: 1,
  };
}

export function powerLadder(
  content: ContentBundle,
  partyForBattle: (battleId: string) => PartyUnit[],
  powersFor: (life: string, tier: number) => readonly PlayerAbility[],
  lives: readonly string[],
  runs = 40,
): PowerLadderReport[] {
  const idx = indexCombat(content);
  const out: PowerLadderReport[] = [];
  // Сюжетно летальные бои из замера исключены: их исход задан сценарием, и
  // умение в них не меряет ничего. Бои-знакомства — тоже: они выигрываются в
  // 99–100% и без умений, и их средняя длина (2–4 раунда) утягивает вниз
  // цифру, по которой судят о коридоре 6–14.
  const battles = content.battles.filter(
    (b) => !b.tags?.includes('lethal') && !b.tags?.includes('tutorial'),
  );
  for (const life of lives) {
    for (let tier = 1; tier <= 3; tier++) {
      const powers = powersFor(life, tier);
      const ids = new Set(powers.filter((p) => !p.ability.passive).map((p) => p.id));
      const passiveOnly = powers.length > 0 && ids.size === 0;
      let wins = 0;
      let rounds = 0;
      let used = 0;
      let responses = 0;
      let played = 0;
      const perBattle: number[] = [];
      const perBattleIds: string[] = [];
      for (const b of battles) {
        const party = partyForBattle(b.id);
        let localWins = 0;
        for (let i = 0; i < runs; i++) {
          const st = runAuto(idx, startBattle(idx, b, party, `ladder:${life}:${tier}:${b.id}:${i}`, powers));
          played++;
          rounds += st.round;
          if (st.outcome === 'win') {
            wins++;
            localWins++;
          }
          if (st.events.some((e) => e.type === 'act' && ids.has(e.ability))) used++;
          responses += st.events.filter((e) => e.type === 'response').length;
        }
        perBattle.push(localWins / Math.max(1, runs));
        perBattleIds.push(b.id);
      }
      const n = Math.max(1, played);
      out.push({
        life,
        tier,
        battles: played,
        winrate: wins / n,
        avgRounds: rounds / n,
        usedShare: used / n,
        responsesPerBattle: responses / n,
        passiveOnly,
        perBattle: perBattle.map((w, i) => ({ battle: perBattleIds[i] as string, winrate: w })),
        minWinrate: perBattle.length ? Math.min(...perBattle) : 0,
        maxWinrate: perBattle.length ? Math.max(...perBattle) : 0,
        outOfCorridor: perBattle.filter((w) => w < POWER_MIN || w > POWER_MAX).length,
      });
    }
  }
  return out;
}

/**
 * Детерминизм: один сид → один и тот же лог событий. Красный тест = баг движка.
 *
 * `powers` проверяется тем же прогоном, а не отдельным: умение игрока — такой
 * же участник боя, как способность юнита, и воспроизводимость с ним обязана
 * быть той же самой. Пустой набор даёт ровно прежнюю проверку.
 */
export function determinismCheck(
  content: ContentBundle,
  party: PartyUnit[],
  powers?: readonly PlayerAbility[],
): { ok: boolean; battle?: string } {
  const idx = indexCombat(content);
  for (const b of content.battles) {
    const a = runAuto(idx, startBattle(idx, b, party, 'det', powers));
    const c = runAuto(idx, startBattle(idx, b, party, 'det', powers));
    if (JSON.stringify(a.events) !== JSON.stringify(c.events)) return { ok: false, battle: b.id };
  }
  return { ok: true };
}
