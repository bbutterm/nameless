import { content } from '@nameless/content';
import { fuzzDialogue } from './src/dialogue-fuzz.js';
const r = fuzzDialogue(content as any, 300);
console.log('unreachable:');
for (const u of r.unreachableNodes) console.log(' ', u.scene + '#' + u.node);
console.log('neverShown:', r.neverShownOptions.length, JSON.stringify(r.neverShownOptions));
console.log('alwaysShown:', r.alwaysShownConditional.length, JSON.stringify(r.alwaysShownConditional));
console.log('deadEnds:', r.deadEnds.length);
const errs = new Map<string,number>();
for (const e of r.errors) { const k=e.scene+'#'+e.node+': '+e.message; errs.set(k,(errs.get(k)??0)+1); }
console.log('errors kinds:'); for (const [k,v] of errs) console.log('  ', k, v);
