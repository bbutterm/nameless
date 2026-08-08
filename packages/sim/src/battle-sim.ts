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
/** Бой короче — не успевает стать тактикой, длиннее — надоедает на телефоне. */
export const ROUNDS_MIN = 6;
export const ROUNDS_MAX = 14;

export interface UnitWinrate {
  unit: string;
  tier: number;
  battles: number;
  wins: number;
  winrate: number;
  avgRounds: number;
  inCorridor: boolean;
}

export interface BattleReport {
  battle: string;
  runs: number;
  winrate: number;
  avgRounds: number;
  /** Средняя доля выживших юнитов игрока — метрика «бой был напряжённым». */
  avgSurvivors: number;
}

function partyFrom(units: UnitDef[]): PartyUnit[] {
  const front = units.filter((u) => u.row === 'front').slice(0, 3);
  const back = units.filter((u) => u.row === 'back').slice(0, 3);
  const out: PartyUnit[] = [];
  front.forEach((u, i) =>
    out.push({ uid: `p${out.length}:${u.id}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row: 'front', index: i } }),
  );
  back.forEach((u, i) =>
    out.push({ uid: `p${out.length}:${u.id}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row: 'back', index: i } }),
  );
  return out;
}

function adHocBattle(id: string, units: UnitDef[]): BattleDef {
  const front = units.filter((u) => u.row === 'front').slice(0, 3);
  const back = units.filter((u) => u.row === 'back').slice(0, 3);
  return {
    id,
    name: { ru: id, en: id },
    enemies: [
      ...front.map((u, i) => ({ unit: u.id, row: 'front' as const, index: i })),
      ...back.map((u, i) => ({ unit: u.id, row: 'back' as const, index: i })),
    ],
  };
}

/**
 * Зеркальный турнир: каждый юнит встаёт в отряд из трёх своих копий
 * против случайного отряда того же тира. Так изолируется вклад самого юнита.
 */
export function unitWinrates(content: ContentBundle, runsPerUnit = 60): UnitWinrate[] {
  const idx = indexCombat(content);
  const byTier = new Map<number, UnitDef[]>();
  for (const u of content.units) {
    const list = byTier.get(u.tier) ?? [];
    list.push(u);
    byTier.set(u.tier, list);
  }

  const out: UnitWinrate[] = [];
  for (const unit of content.units) {
    // Зеркалим внутри тира. Если в тире меньше четырёх соседей, турнир вырождается
    // (каждый дерётся с одними и теми же двумя), поэтому добираем соседний тир —
    // иначе винрейт тира 3 говорит не о балансе, а о размере выборки.
    let pool = (byTier.get(unit.tier) ?? []).filter((u) => u.id !== unit.id);
    if (pool.length < 4) {
      const neighbours = [unit.tier - 1, unit.tier + 1]
        .flatMap((t) => byTier.get(t) ?? [])
        .filter((u) => u.id !== unit.id);
      pool = [...pool, ...neighbours];
    }
    if (pool.length === 0) {
      out.push({ unit: unit.id, tier: unit.tier, battles: 0, wins: 0, winrate: 0.5, avgRounds: 0, inCorridor: true });
      continue;
    }
    let wins = 0;
    let rounds = 0;
    let played = 0;
    for (let i = 0; i < runsPerUnit; i++) {
      const rng = new Rng(`wr:${unit.id}:${i}`);
      const mine: UnitDef[] = [unit, unit, unit].map((u) => u);
      const support = rng.shuffle(pool).slice(0, 3);
      const team = [...mine, ...support].slice(0, 6);
      const foes = rng.shuffle(pool.concat(pool)).slice(0, 6);
      if (foes.length === 0) continue;
      const battle = adHocBattle(`sim:${unit.id}:${i}`, foes);
      const st = runAuto(idx, startBattle(idx, battle, partyFrom(team), `wr:${unit.id}:${i}`));
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
      inCorridor: winrate >= WINRATE_MIN && winrate <= WINRATE_MAX,
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
  party: PartyUnit[],
  runs = 40,
): BattleReport[] {
  const idx = indexCombat(content);
  const out: BattleReport[] = [];
  for (const b of content.battles) {
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
