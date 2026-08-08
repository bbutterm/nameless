/**
 * Симулятор боёв бот-против-бота. Считает винрейты юнитов и составов.
 * Балансовый коридор: любой юнит вне 42–58% — повод править статы.
 */
import {
  indexCombat,
  runAuto,
  startBattle,
  Rng,
  type BattleDef,
  type ContentBundle,
  type PartyUnit,
  type UnitDef,
} from '@nameless/engine';

export const WINRATE_MIN = 0.42;
export const WINRATE_MAX = 0.58;
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
export function scriptedBattles(
  content: ContentBundle,
  partyForBattle: (battleId: string) => PartyUnit[],
  runs = 40,
): BattleReport[] {
  const idx = indexCombat(content);
  const out: BattleReport[] = [];
  for (const b of content.battles) {
    const party = partyForBattle(b.id);
    let wins = 0;
    let rounds = 0;
    let survivors = 0;
    for (let i = 0; i < runs; i++) {
      const st = runAuto(idx, startBattle(idx, b, party, `scripted:${b.id}:${i}`));
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

/** Детерминизм: один сид → один и тот же лог событий. Красный тест = баг движка. */
export function determinismCheck(content: ContentBundle, party: PartyUnit[]): { ok: boolean; battle?: string } {
  const idx = indexCombat(content);
  for (const b of content.battles) {
    const a = runAuto(idx, startBattle(idx, b, party, 'det'));
    const c = runAuto(idx, startBattle(idx, b, party, 'det'));
    if (JSON.stringify(a.events) !== JSON.stringify(c.events)) return { ok: false, battle: b.id };
  }
  return { ok: true };
}
