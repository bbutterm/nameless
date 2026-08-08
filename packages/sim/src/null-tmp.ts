import { content } from '@nameless/content';
import { indexCombat, runAuto, startBattle, Rng, type BattleDef, type PartyUnit, type UnitDef } from '@nameless/engine';

function fillSlots(units: readonly UnitDef[]): PartyUnit[] {
  const front: UnitDef[] = []; const back: UnitDef[] = [];
  for (const u of units) {
    const prefer = u.row === 'front' ? front : back;
    const other = u.row === 'front' ? back : front;
    if (prefer.length < 3) prefer.push(u); else if (other.length < 3) other.push(u);
  }
  const out: PartyUnit[] = [];
  front.forEach((u, i) => out.push({ uid: `p${out.length}:${u.id}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row: 'front', index: i } }));
  back.forEach((u, i) => out.push({ uid: `p${out.length}:${u.id}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row: 'back', index: i } }));
  return out;
}
const hpMul = Number(process.argv.find((a) => a.startsWith('--hp='))?.split('=')[1] ?? 1);
const scaled = { ...content, units: content.units.map((u) => ({ ...u, stats: { ...u.stats, hp: Math.round(u.stats.hp * hpMul) } })) };
const idx = indexCombat(scaled as any);
const byTier = new Map<number, UnitDef[]>();
for (const u of scaled.units) { const l = byTier.get(u.tier) ?? []; l.push(u); byTier.set(u.tier, l); }
const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.split('=')[1] ?? 400);
const per = new Map<number, [number, number, number]>();
for (const unit of scaled.units) {
  if (unit.tier === 3) continue;
  const pool = (byTier.get(unit.tier) ?? []).filter((u) => u.id !== unit.id);
  let wins = 0, played = 0, draws = 0, rounds = 0;
  for (let i = 0; i < runs; i++) {
    const rng = new Rng(`wr:${unit.id}:${i}`);
    const baseline = rng.shuffle(pool.concat(pool, pool)).slice(0, 6);
    if (baseline.length < 2) continue;
    const battle: BattleDef = { id: `sim:${unit.id}:${i}`, name: { ru: 'x', en: 'x' }, enemies: fillSlots(baseline).map((p) => ({ unit: p.defId, row: p.slot.row, index: p.slot.index })) };
    const st = runAuto(idx, startBattle(idx, battle, fillSlots(baseline), `wr:${unit.id}:${i}`));
    played++; rounds += st.round; if (st.outcome === 'win') wins++; if (st.outcome === 'draw') draws++;
  }
  const c = per.get(unit.tier) ?? [0,0,0]; per.set(unit.tier, [c[0]+wins, c[1]+played, c[2]+rounds]);
}
for (const [t, [w, p, r]] of [...per].sort()) console.log(`hp×${hpMul} тир${t}: сторона-игрок побеждает зеркало в ${(100*w/p).toFixed(1)}% (боёв ${p}, раундов ${(r/p).toFixed(1)})`);
