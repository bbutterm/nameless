/**
 * Замер «сколько раз вариант РЕАЛЬНО доехал до игрока» — filterOptions, не rawPassing.
 * Личности генерируются тем же makePersonalities, что и в фаззере.
 */
import { content } from '@nameless/content';
import { filterOptions, createInitialState, type GameState } from '@nameless/engine';
import { makePersonalities, type Personality } from './dialogue-fuzz.js';

const N = Number(process.argv[2] ?? 3000);
const only = process.argv[3];

function stateFrom(p: Personality, scene: string, node: string): GameState {
  const base = createInitialState({
    seed: p.id,
    axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
    chapter: p.chapter,
    scene,
    node,
    now: 0,
  });
  return {
    ...base,
    axes: { ...base.axes, ...p.axes },
    flags: p.flags,
    counters: p.counters,
    lockedMemories: p.lockedMemories,
    awakenedLives: p.awakenedLives,
    deaths: p.deaths,
    party: p.units.map((u, i) => ({
      uid: `f${i}:${u}`,
      defId: u,
      hp: 10,
      xp: 0,
      level: 1,
      slot: { row: i < 3 ? ('front' as const) : ('back' as const), index: i % 3 },
    })),
    visitedScenes: p.visited,
  };
}

const people = makePersonalities(content, N);
const scenesArg = only ? only.split(',') : null;

let totalDead = 0;
for (const scene of content.scenes) {
  if (scenesArg && !scenesArg.includes(scene.id)) continue;
  for (const node of scene.nodes) {
    if (node.kind !== 'choice') continue;
    const shown = new Map<string, number>();
    for (const o of node.options) shown.set(o.id, 0);
    let minShown = Infinity;
    for (const p of people) {
      const st = stateFrom(p, scene.id, node.id);
      const opts = filterOptions(node.options, st);
      minShown = Math.min(minShown, opts.length);
      for (const o of opts) shown.set(o.id, (shown.get(o.id) ?? 0) + 1);
    }
    const rows = [...shown.entries()];
    const dead = rows.filter(([, c]) => c === 0);
    const rare = rows.filter(([, c]) => c > 0 && c < N * 0.02);
    totalDead += dead.length;
    if (dead.length || rare.length || process.env['ALL']) {
      console.log(
        `\n${scene.id}#${node.id} (${node.options.length} опц., мин.показано=${minShown})`,
      );
      for (const [id, c] of rows) {
        const opt = node.options.find((o) => o.id === id)!;
        const mark = c === 0 ? ' <<< МЁРТВ' : c < N * 0.02 ? ' <<< редкий' : '';
        console.log(
          `   ${String(c).padStart(5)}  ${id.padEnd(24)} prio=${opt.priority ?? 0}${opt.conditions ? '' : ' [безусл.]'}${mark}`,
        );
      }
    }
  }
}
console.log(`\nИТОГО мёртвых вариантов: ${totalDead}`);
