import { content } from '@nameless/content';
import { advance, choose, createInitialState, indexContent, normalizeEntry, resolve, Rng } from '@nameless/engine';

const idx = indexContent(content);
const ch = [...content.chapters].sort((a, b) => a.index - b.index)[0]!;
const runs = 200;
const results: number[] = [];

for (let i = 0; i < runs; i++) {
  const rng = new Rng(`ttfb:${i}`);
  let st = normalizeEntry(idx, createInitialState({
    seed: `t${i}`, axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
    chapter: ch.index, scene: ch.entryScene, node: '@entry', now: 0,
  }));
  let bubbles = 0;
  for (let step = 0; step < 3000; step++) {
    const r = resolve(idx, st); st = r.state;
    if (r.step.kind === 'battle') { results.push(bubbles); break; }
    if (r.step.kind === 'bubble') { bubbles++; st = advance(idx, st); continue; }
    if (r.step.kind === 'choice') {
      const pick = rng.pick(r.step.options); if (!pick) break;
      st = choose(idx, st, pick.id); continue;
    }
    break;
  }
}
results.sort((a, b) => a - b);
const med = results[Math.floor(results.length / 2)] ?? 0;
console.log(`прогонов с боем: ${results.length} из ${runs}`);
console.log(`пузырей до первого боя — минимум ${results[0]}, медиана ${med}, максимум ${results[results.length - 1]}`);
console.log(`медиана по времени: ~${Math.round(med * 3.5 / 60)} мин (3.5 с на реплику)`);
