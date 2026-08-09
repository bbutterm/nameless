/**
 * Отчёт по итерации B6. Запуск:
 *   pnpm --filter @nameless/sim tsx src/resonance-proof.ts
 * или из корня: `node --import tsx packages/sim/src/resonance-proof.ts`.
 *
 * Печатает оба доказательства: исчерпывающий перебор лестницы резонанса и
 * прогон трёх личностей по 16 смертей.
 */
import { content } from '@nameless/content';
import {
  exhaustiveLadderCheck,
  lifeOfMemory,
  personaRun,
  PERSONAS,
  type PersonaRun,
} from './resonance.js';

const SECTION: Record<string, string> = {
  smolokur: 'I Смолокур',
  klyuchar: 'II Ключарь',
  posulshchik: 'III Посульщик',
  chistopisets: 'IV Чистописец',
  perechen: 'V Перечень',
};

function head(title: string): void {
  console.log(`\n─── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

let failed = false;

head('Инвариант 1: лестница резонанса, исчерпывающий перебор');
const t0 = Date.now();
const ex = exhaustiveLadderCheck(content);
console.log(
  `конфигураций осей ${ex.axisClasses} (классы эквивалентности — покрывают все значения), ` +
    `наборов закреплённого ${ex.lockedSets}`,
);
console.log(`комбинаций ${ex.combos.toLocaleString('ru-RU')} за ${((Date.now() - t0) / 1000).toFixed(1)} с`);
console.log(`  лотов выдано:                     ${ex.lots.toLocaleString('ru-RU')}`);
console.log(`  «раздел не отзывается»:           ${ex.noEcho.toLocaleString('ru-RU')}`);
console.log(`  архив пуст (дверь в финал):       ${ex.archiveEmpty.toLocaleString('ru-RU')}`);
console.log(`!! смертей без лота и без реплики:  ${ex.silent}`);
console.log(`!! досыпано, а лот не закрепился:   ${ex.fundedButNoLot}`);
console.log(`!! финал при неполном архиве:       ${ex.archiveEmptyEarly}`);
console.log(`~~ шов «не отзывается, но раздел узнаваем»: ${ex.noEchoSeam}`);
for (const s of ex.samples) console.log(`   пример: ${s}`);
if (ex.silent > 0 || ex.fundedButNoLot > 0 || ex.archiveEmptyEarly > 0) failed = true;

head('Инвариант 2: три личности — три набора');
const runs: PersonaRun[] = PERSONAS.map((p) => personaRun(content, p, 16));
for (const r of runs) {
  const byLife = new Map<string, string[]>();
  for (const m of r.locked) {
    const life = lifeOfMemory(content, m);
    byLife.set(life, [...(byLife.get(life) ?? []), m]);
  }
  console.log(
    `\n${r.persona}: смертей ${r.deaths}, закреплено ${r.locked.length}/15, ` +
      `жизней ${r.lives.length}/5`,
  );
  console.log(
    `  лотов ${r.lots}, «не отзывается» ${r.noEcho}, молчаливых ${r.silent}, ` +
      `досыпано-без-лота ${r.fundedButNoLot}, швов ${r.seam}`,
  );
  console.log(
    `  оси: ${Object.entries(r.axes)
      .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`)
      .join(', ')}`,
  );
  for (const life of Object.keys(SECTION)) {
    const got = byLife.get(life) ?? [];
    console.log(`  ${SECTION[life]?.padEnd(16)} ${got.length}/3  ${got.join(', ')}`);
  }
  const deeds = Object.entries(r.deedShards)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  if (deeds) console.log(`  осколки поступками: ${deeds}`);
  if (r.silent > 0 || r.fundedButNoLot > 0) failed = true;
}

const sets = runs.map((r) => [...r.locked].sort().join('|'));
const distinct = new Set(sets).size;
console.log(`\nразных наборов: ${distinct} из ${runs.length}`);
for (let i = 0; i < runs.length; i++) {
  for (let j = i + 1; j < runs.length; j++) {
    const a = new Set(runs[i]?.locked ?? []);
    const b = new Set(runs[j]?.locked ?? []);
    const common = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    console.log(
      `  ${runs[i]?.persona} × ${runs[j]?.persona}: общих ${common}, ` +
        `совпадение ${((common / Math.max(1, union)) * 100).toFixed(0)}%`,
    );
  }
}
const sizes = runs.map((r) => r.locked.length);
const inCorridor = sizes.every((s) => s >= 8 && s <= 12);
console.log(`наборы ${sizes.join(' / ')} — коридор 8–12: ${inCorridor ? 'да' : 'НЕТ'}`);
if (distinct !== runs.length) failed = true;

head(failed ? 'ИТОГ: КРАСНЫЙ' : 'ИТОГ: зелёный');
process.exit(failed ? 1 : 0);
