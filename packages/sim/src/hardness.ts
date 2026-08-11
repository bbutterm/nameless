/**
 * Насколько и чем подтянуть каждый бой.
 *
 * Балансовый коридор у нас ИЗМЕРЯЕТСЯ, а не назначается, и это правило уже
 * трижды нарушалось попыткой «подкрутить прибор, потому что не дотянул». Но
 * когда бой действительно надо сделать тяжелее, встаёт другой вопрос — ЧЕМ
 * тяжелее, — и на него до сих пор отвечали на глаз: добавить врага? поднять
 * уровень? поменять состав? Разница между этими ручками не косметическая:
 * лишний враг удлиняет бой и множит решения, лишний уровень только утяжеляет
 * числа, а состав меняет то, кого игрок бьёт первым.
 *
 * Этот прогон отвечает замером. Для каждого боя вне коридора он гоняет
 * несколько ручек по отдельности и печатает, какая из них — и на сколько —
 * заводит бой внутрь. Выбор всё равно за человеком: инструмент не решает,
 * он показывает цену каждого решения.
 *
 * Запуск: cd packages/sim && npx tsx src/hardness.ts [--runs=80] [--target=63:68]
 */
import { content } from '@nameless/content';
import { defaultParty, namedParty, type BattleDef, type PartyUnit } from '@nameless/engine';
import { scriptedBattles, BASE_MAX, BASE_MIN } from './battle-sim.js';

const args = process.argv.slice(2);
const runs = Number(args.find((a) => a.startsWith('--runs='))?.split('=')[1] ?? 80);
const target = args.find((a) => a.startsWith('--target='))?.split('=')[1] ?? '';
const [lo, hi] = target.includes(':')
  ? (target.split(':').map(Number) as [number, number])
  : [BASE_MIN * 100, BASE_MAX * 100];

const chapterOf = new Map<string, number>();
for (const sc of content.scenes) {
  for (const n of sc.nodes) if (n.kind === 'battle' && !chapterOf.has(n.battle)) chapterOf.set(n.battle, sc.chapter);
}

/** Отряд ровно тот же, каким бой меряет основной прогон, — иначе цифры несравнимы. */
function partyFor(id: string): PartyUnit[] {
  const def = content.battles.find((b) => b.id === id);
  const ch = chapterOf.get(id) ?? 1;
  if (def?.expectParty?.length) return namedParty(content.units, def.expectParty, ch);
  return defaultParty(content.units, ch, ch);
}

/**
 * Ручки. Каждая — ОДНА правка данных боя, которую потом руками впишут в JSON;
 * инструмент не должен предлагать того, что нельзя записать.
 */
interface Knob {
  name: string;
  /** `undefined` — ручка к этому бою неприменима (некуда ставить врага). */
  apply: (b: BattleDef) => BattleDef | undefined;
}

const SLOTS = 3;

const knobs: Knob[] = [
  { name: 'как есть', apply: (b) => b },
  {
    name: 'уровень врагов +1',
    apply: (b) => ({ ...b, enemies: b.enemies.map((e) => ({ ...e, level: (e.level ?? 1) + 1 })) }),
  },
  {
    name: 'уровень врагов +2',
    apply: (b) => ({ ...b, enemies: b.enemies.map((e) => ({ ...e, level: (e.level ?? 1) + 2 })) }),
  },
  {
    name: 'ещё один враг',
    apply: (b) => {
      // Копируем того, кого в бою больше всего, — это самый честный «ещё один
      // такой же». Ставим в первый свободный слот; если строй полон, ручка
      // неприменима, и об этом надо сказать, а не подменить другой правкой.
      const taken = new Set(b.enemies.map((e) => `${e.row}:${e.index}`));
      for (const row of ['front', 'back'] as const) {
        for (let i = 0; i < SLOTS; i++) {
          if (taken.has(`${row}:${i}`)) continue;
          const twin = b.enemies.find((e) => e.row === row) ?? b.enemies[0];
          if (!twin) return undefined;
          return { ...b, enemies: [...b.enemies, { ...twin, row, index: i }] };
        }
      }
      return undefined;
    },
  },
];

const story = content.battles.filter(
  (b) => !b.tags?.includes('lethal') && !b.tags?.includes('tutorial'),
);

console.log(`цель ${lo}–${hi}% побед, ${runs} прогонов на замер, боёв ${story.length}\n`);

const rows: { id: string; base: number; fix: string; got: number }[] = [];

for (const def of story) {
  const line: string[] = [];
  let base = 0;
  let best: { name: string; win: number } | undefined;
  for (const knob of knobs) {
    const patched = knob.apply(def);
    if (!patched) {
      line.push(`${knob.name}: строй полон`);
      continue;
    }
    // Меряем ОДИН бой: подменяем корпус, чтобы не гонять остальные девятнадцать.
    const one = { ...content, battles: [patched] };
    const rep = scriptedBattles(one, () => partyFor(def.id), runs)[0];
    const win = (rep?.winrate ?? 0) * 100;
    if (knob.name === 'как есть') base = win;
    else if (win >= lo && win <= hi && (!best || Math.abs(win - (lo + hi) / 2) < Math.abs(best.win - (lo + hi) / 2))) {
      best = { name: knob.name, win };
    }
    line.push(`${knob.name} ${win.toFixed(0)}%`);
  }
  const inside = base >= lo && base <= hi;
  const verdict = inside ? 'в коридоре' : best ? `→ ${best.name} (${best.win.toFixed(0)}%)` : '→ НИ ОДНА РУЧКА НЕ ХВАТАЕТ';
  console.log(`${def.id.padEnd(26)} ${line.join('  ·  ')}   ${verdict}`);
  rows.push({ id: def.id, base, fix: inside ? '' : (best?.name ?? '—'), got: best?.win ?? base });
}

const outside = rows.filter((r) => r.fix !== '');
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : (((s[m - 1] as number) + (s[m] as number)) / 2);
};
console.log(
  `\nвне коридора ${outside.length} из ${rows.length}; медиана сейчас ` +
    `${median(rows.map((r) => r.base)).toFixed(1)}%, после предложенных правок ` +
    `${median(rows.map((r) => (r.fix ? r.got : r.base))).toFixed(1)}%`,
);
console.log(
  'ручку выбирает человек: лишний враг удлиняет бой и множит решения, лишний уровень\n' +
    'только утяжеляет числа, а состав меняет то, кого игрок бьёт первым.',
);
