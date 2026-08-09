/**
 * Отчёт по итерации B6. Запуск:
 *   pnpm --filter @nameless/sim tsx src/resonance-proof.ts
 * или из корня: `node --import tsx packages/sim/src/resonance-proof.ts`.
 *
 * Печатает оба доказательства: исчерпывающий перебор лестницы резонанса и
 * прогон трёх личностей по 16 смертей.
 */
import { content } from '@nameless/content';
import { scriptedBattles } from './battle-sim.js';
import {
  exhaustiveLadderCheck,
  lifeOfMemory,
  personaRun,
  PERSONAS,
  randomPersonas,
  TURNED_PERSONA,
  type PersonaRun,
} from './resonance.js';

/** Отголоски прошлых жизней: их приводит в отряд закреплённая память. */
const ECHO_UNITS = ['gar', 'vodonos', 'posul', 'svidetel'];

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
const turned = personaRun(content, TURNED_PERSONA, 16);
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

console.log(
  `\nсверх задания — ${turned.persona}: закреплено ${turned.locked.length}/15, ` +
    `жизней ${turned.lives.length}/5, «не отзывается» ${turned.noEcho}, молчаливых ${turned.silent}, ` +
    `швов ${turned.seam}`,
);
console.log(`  ${turned.locked.join(', ')}`);

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

head('Риск итерации: чего стоит отряду недостача отголосков');
// Абсолютные винрейты тут не мерятся: личность-бот не качает отряд и не ходит
// на стену найма, так что её отряд слабее живого. Мерится РАЗНИЦА — тот же
// отряд с недостающими отголосками и без них. Она и есть цена итерации.
for (const r of runs) {
  const party = r.party.map((u) => u.defId);
  const have = party.filter((u) => ECHO_UNITS.includes(u));
  const missing = ECHO_UNITS.filter((u) => !party.includes(u));
  const level = Math.max(1, ...r.party.map((u) => u.level));
  const add = (defIds: string[], tag: string) => [
    ...r.party,
    ...defIds.map((defId, i) => {
      const def = content.units.find((u) => u.id === defId);
      return {
        uid: `${tag}${i}`,
        defId,
        hp: Math.round((def?.stats.hp ?? 20) * (1 + 0.12 * (level - 1))),
        xp: 0,
        level,
        slot: { row: (def?.row ?? 'back') as 'front' | 'back', index: i },
      };
    }),
  ];
  // Наёмники того же числа и тира — чтобы мерить отголоски, а не лишние тела.
  const hires = content.units
    .filter((u) => !ECHO_UNITS.includes(u.id) && !party.includes(u.id) && u.tier <= 2)
    .sort((a2, b2) => b2.tier - a2.tier)
    .slice(0, missing.length)
    .map((u) => u.id);
  console.log(`\n${r.persona}: отголосков ${have.length}/4 (${have.join(', ') || 'нет'})`);
  const a = scriptedBattles(content, () => add(hires, 'hire'), 120);
  const b = scriptedBattles(content, () => add(missing, 'echo'), 120);
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) continue;
    const def = content.battles.find((d) => d.id === x.battle);
    if (def?.tags?.includes('lethal')) continue;
    console.log(
      `  ${x.battle.padEnd(24)} с наёмниками ${(x.winrate * 100).toFixed(0)}%  ` +
        `с отголосками ${(y.winrate * 100).toFixed(0)}%  ` +
        `разница ${((y.winrate - x.winrate) * 100).toFixed(0)} п.`,
    );
  }
}

head('Распределение: 40 случайных личностей по 16 смертей');
const randoms = randomPersonas(40, content).map((p) => personaRun(content, p, 16));
const hist = new Map<number, number>();
for (const r of randoms) hist.set(r.locked.length, (hist.get(r.locked.length) ?? 0) + 1);
const keys = [...hist.keys()].sort((a, b) => a - b);
for (const k of keys) console.log(`  ${String(k).padStart(2)}/15  ${'█'.repeat(hist.get(k) ?? 0)} ${hist.get(k)}`);
const allSizes = randoms.map((r) => r.locked.length).sort((a, b) => a - b);
const distinctRandom = new Set(randoms.map((r) => [...r.locked].sort().join('|'))).size;
console.log(
  `  минимум ${allSizes[0]}, медиана ${allSizes[Math.floor(allSizes.length / 2)]}, ` +
    `максимум ${allSizes[allSizes.length - 1]}; разных наборов ${distinctRandom} из ${randoms.length}`,
);
console.log(`  выкупили архив целиком (15/15): ${randoms.filter((r) => r.locked.length === 15).length}`);
const badRandom = randoms.filter((r) => r.silent > 0 || r.fundedButNoLot > 0 || r.seam > 0);
console.log(
  `  молчаливых смертей ${randoms.reduce((a, r) => a + r.silent, 0)}, ` +
    `досыпано-без-лота ${randoms.reduce((a, r) => a + r.fundedButNoLot, 0)}, ` +
    `швов ${randoms.reduce((a, r) => a + r.seam, 0)}`,
);
if (badRandom.length > 0) failed = true;
if (randoms.some((r) => r.locked.length === 15)) failed = true;

head(failed ? 'ИТОГ: КРАСНЫЙ' : 'ИТОГ: зелёный');
process.exit(failed ? 1 : 0);
