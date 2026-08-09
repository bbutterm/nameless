import { content } from '@nameless/content';
import { indexContent, createInitialState, normalizeEntry, resolve, advance, choose, goTo, applyDeath, applyEffects, Rng } from '@nameless/engine';
const idx = indexContent(content);
const ch = [...content.chapters].sort((a,b)=>a.index-b.index)[0]!;
let peak = 0, peakScene = '', final = 0;
const peaks: number[] = [];
for (let i = 0; i < 30; i++) {
  const rng = new Rng(`log:${i}`);
  let st = normalizeEntry(idx, createInitialState({ seed:`l${i}`, axes: content.axes.map(a=>({id:a.id,start:a.start})), chapter: ch.index, scene: ch.entryScene, node:'@entry', now:0 }));
  let localPeak = 0;
  for (let s = 0; s < 3000; s++) {
    const r = resolve(idx, st); st = r.state;
    if (st.log.length > localPeak) localPeak = st.log.length;
    if (st.log.length > peak) { peak = st.log.length; peakScene = st.scene; }
    if (r.step.kind === 'bubble') { st = advance(idx, st); continue; }
    if (r.step.kind === 'choice') { const p = rng.pick(r.step.options); if (!p) break; st = choose(idx, st, p.id); continue; }
    if (r.step.kind === 'battle') { const n=r.step.node; const won=rng.chance(0.8);
      const def=content.battles.find(b=>b.id===n.battle); if (won && def?.rewards) st=applyEffects(st,def.rewards,idx.effectCtx);
      st = normalizeEntry(idx, goTo(st, won?n.onWin:n.onLose)); continue; }
    if (r.step.kind === 'death') { const d=content.deaths.find(x=>x.id===r.step.node.death); if(!d) break; st=applyDeath(st,content,d,idx.effectCtx).state; continue; }
    break;
  }
  peaks.push(localPeak); final = st.log.length;
}
peaks.sort((a,b)=>a-b);
console.log('пик записей ленты: медиана', peaks[15], '| максимум', peak, 'в сцене', peakScene);
console.log('примерный вес сейва на максимуме:', Math.round(peak*0.16), 'КБ (по ~160 байт на запись)');
