import { content } from '@nameless/content';
import { unitWinrates } from './battle-sim.js';
const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.split('=')[1] ?? 60);
const wr = unitWinrates(content, runs);
let out = 0;
for (const w of wr) {
  const mark = w.thinSample ? '~~' : w.inCorridor ? '  ' : '!!';
  if (!w.inCorridor) out++;
  console.log(`${mark} ${w.unit.padEnd(24)} t${w.tier} ${(w.winrate * 100).toFixed(1)}%  r${w.avgRounds.toFixed(1)}`);
}
const avg = wr.reduce((a, w) => a + w.avgRounds, 0) / wr.length;
console.log(`ВНЕ КОРИДОРА ${out} из ${wr.length}; средняя длина ${avg.toFixed(2)}`);
