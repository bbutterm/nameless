/** ВРЕМЕННЫЙ инструмент замера. Удалить перед сдачей. */
import { content } from '@nameless/content';
import {
  indexCombat,
  runAuto,
  startBattle,
  Rng,
  type BattleDef,
  type PartyUnit,
  type UnitDef,
} from '@nameless/engine';
import { scriptedBattles } from './battle-sim.js';

const mode = process.argv[2] ?? 'battles';
const which = process.argv[3];

function namedParty(units: UnitDef[], ids: string[]): PartyUnit[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const out: PartyUnit[] = [];
  let front = 0;
  let back = 0;
  for (const id of ids) {
    const u = byId.get(id);
    if (!u) continue;
    const row = u.row;
    const index = row === 'front' ? front++ : back++;
    if (index > 2) continue;
    out.push({ uid: `n${out.length}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row, index } });
  }
  return out;
}

function defaultParty(units: UnitDef[], maxTier: number, level: number): PartyUnit[] {
  const pool = units.filter((u) => u.tier <= maxTier);
  const byTier = (a: UnitDef, b: UnitDef) => b.tier - a.tier;
  const front = pool.filter((u) => u.row === 'front').sort(byTier).slice(0, 3);
  const back = pool.filter((u) => u.row === 'back').sort(byTier).slice(0, 3);
  const out: PartyUnit[] = [];
  const push = (u: UnitDef, row: 'front' | 'back', i: number) =>
    out.push({
      uid: `d${out.length}`,
      defId: u.id,
      hp: Math.round(u.stats.hp * (1 + 0.12 * (level - 1))),
      xp: 0,
      level,
      slot: { row, index: i },
    });
  front.forEach((u, i) => push(u, 'front', i));
  back.forEach((u, i) => push(u, 'back', i));
  return out;
}

if (mode === 'party') {
  for (const ch of [1, 2, 3]) {
    const p = defaultParty(content.units, ch === 1 ? 1 : ch === 2 ? 2 : 3, ch);
    console.log(`глава ${ch}: ${p.map((u) => `${u.defId}(${u.slot.row}${u.slot.index})`).join(', ')}`);
  }
} else if (mode === 'battles') {
  const ids = which ? which.split(',') : null;
  const battleChapter = new Map<string, number>();
  for (const sc of content.scenes) {
    for (const n of sc.nodes) {
      if (n.kind === 'battle') battleChapter.set(n.battle, sc.chapter);
    }
  }
  const subset = { ...content, battles: content.battles.filter((b) => !ids || ids.includes(b.id)) };
  const rep = scriptedBattles(
    subset,
    (id) => {
      const def = content.battles.find((b) => b.id === id);
      if (def?.expectParty?.length) return namedParty(content.units, def.expectParty);
      const ch = battleChapter.get(id) ?? 1;
      return defaultParty(content.units, ch === 1 ? 1 : ch === 2 ? 2 : 3, ch);
    },
    150,
  );
  for (const r of rep) {
    console.log(
      `${r.battle.padEnd(24)} побед ${(r.winrate * 100).toFixed(0)}%  раундов ${r.avgRounds.toFixed(1)}  выжило ${(r.avgSurvivors * 100).toFixed(0)}%`,
    );
  }
} else if (mode === 'units') {
  // Урезанный турнир: норма тира + винрейты выбранных юнитов.
  const idx = indexCombat(content);
  const runs = Number(process.argv[4] ?? 300);
  const targets = which ? which.split(',') : content.units.map((u) => u.id);
  const tiers = new Set(content.units.filter((u) => targets.includes(u.id)).map((u) => u.tier));
  const fillSlots = (units: readonly UnitDef[]): PartyUnit[] => {
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
  };
  const adHoc = (id: string, units: readonly UnitDef[]): BattleDef => {
    const placed = fillSlots(units);
    return { id, name: { ru: id, en: id }, enemies: placed.map((p) => ({ unit: p.defId, row: p.slot.row, index: p.slot.index })) };
  };
  const neutrals = new Map<number, number>();
  for (const tier of tiers) {
    const pool = content.units.filter((u) => u.tier === tier);
    const wide = pool.length >= 4 ? pool : content.units;
    let wins = 0;
    let played = 0;
    const calibrationRuns = Math.max(300, runs * 3);
    for (let i = 0; i < calibrationRuns; i++) {
      const rng = new Rng(`calib:${tier}:${i}`);
      const team = rng.shuffle(wide.concat(wide, wide)).slice(0, 6);
      if (team.length < 2) continue;
      const st = runAuto(idx, startBattle(idx, adHoc(`calib:${tier}:${i}`, team), fillSlots(team), `calib:${tier}:${i}`));
      played++;
      if (st.outcome === 'win') wins++;
    }
    neutrals.set(tier, played > 0 ? wins / played : 0.5);
    console.log(`норма t${tier}: ${((played > 0 ? wins / played : 0.5) * 100).toFixed(1)}%`);
  }
  const byTier = new Map<number, UnitDef[]>();
  for (const u of content.units) {
    const list = byTier.get(u.tier) ?? [];
    list.push(u);
    byTier.set(u.tier, list);
  }
  for (const unit of content.units.filter((u) => targets.includes(u.id))) {
    let pool = (byTier.get(unit.tier) ?? []).filter((u) => u.id !== unit.id);
    if (pool.length < 4) {
      const neighbours = [unit.tier - 1, unit.tier + 1].flatMap((t) => byTier.get(t) ?? []).filter((u) => u.id !== unit.id);
      pool = [...pool, ...neighbours];
    }
    let wins = 0;
    let rounds = 0;
    let played = 0;
    for (let i = 0; i < runs; i++) {
      const rng = new Rng(`wr:${unit.id}:${i}`);
      const baseline = rng.shuffle(pool.concat(pool, pool)).slice(0, 6);
      if (baseline.length < 2) continue;
      let victim = baseline.findIndex((u) => u.row === unit.row);
      if (victim === -1) victim = 0;
      const challenger = baseline.slice();
      challenger[victim] = unit;
      const st = runAuto(idx, startBattle(idx, adHoc(`sim:${unit.id}:${i}`, baseline), fillSlots(challenger), `wr:${unit.id}:${i}`));
      played++;
      rounds += st.round;
      if (st.outcome === 'win') wins++;
    }
    const n = neutrals.get(unit.tier) ?? 0.5;
    const wr = wins / played;
    console.log(
      `${Math.abs(wr - n) <= 0.08 ? '  ' : '!!'} ${unit.id.padEnd(24)} t${unit.tier} ${(wr * 100).toFixed(1)}%  (норма ${(n * 100).toFixed(1)}%, отрыв ${((wr - n) * 100).toFixed(1)})  раундов ${(rounds / played).toFixed(1)}`,
    );
  }
}
