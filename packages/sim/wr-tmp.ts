import { content } from '@nameless/content';
import { unitWinrates } from './src/battle-sim.js';

const runs = Number(process.argv[2] ?? 60);
const wr = unitWinrates(content, runs);
let bad = 0;
for (const w of wr) {
  if (!w.inCorridor) bad++;
  console.log(
    `${w.inCorridor ? '  ' : '!!'} ${w.unit.padEnd(24)} t${w.tier} ${(w.winrate * 100).toFixed(1).padStart(5)}%  р ${w.avgRounds.toFixed(1)}`,
  );
}
console.log(`вне коридора ${bad}/${wr.length}`);
