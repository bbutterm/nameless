import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { content, validateBundle } from '@nameless/content';
import { derivePlayerPowers, type PartyUnit, type UnitDef } from '@nameless/engine';
import {
  determinismCheck,
  CORRIDOR_HALF_WIDTH,
  powerLadder,
  ROUNDS_MAX,
  ROUNDS_MIN,
  scriptedBattles,
  unitWinrates,
} from './battle-sim.js';
import { fuzzDialogue } from './dialogue-fuzz.js';
import {
  battleRhythm,
  BUBBLES_BETWEEN_BATTLES_MAX,
  BUBBLES_BETWEEN_BATTLES_P90,
  BUBBLES_TO_BATTLE_MAX,
  timeToFirstBattle,
} from './pacing.js';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const personas = Number(args.find((a) => a.startsWith('--personas='))?.split('=')[1] ?? 300);
// 300, не 60: биномиальная стандартная ошибка при p≈0.5 и n=60 — около 6.5 пункта
// при коридоре ±8, то есть турнир на 60 прогонах мерит в основном свой же шум.
// Сид прогона детерминирован (`wr:${unit.id}:${i}`), поэтому шум СТАБИЛЕН между
// запусками — вне коридора при 60 прогонах оказывались 10 юнитов из 34, при 300 — 4,
// при 900 — 1. Если когда-нибудь захочется вернуть 60 «ради скорости» — не надо:
// это не ускорение симулятора, а понижение его разрешающей способности до уровня
// шума, замаскированное тем, что шум воспроизводимый и выглядит как сигнал.
const runs = Number(args.find((a) => a.startsWith('--runs='))?.split('=')[1] ?? 300);
const reportDir = join(process.cwd(), '..', '..', 'sim-reports');

let failed = false;
const summary: Record<string, unknown> = {};

function head(title: string): void {
  console.log(`\n─── ${title} ${'─'.repeat(Math.max(0, 56 - title.length))}`);
}

// ── Целостность контента ─────────────────────────────────────────────────────
head('Целостность контента');
const issues = validateBundle(content);
const errors = issues.filter((i) => i.level === 'error');
console.log(`ошибок ${errors.length}, предупреждений ${issues.length - errors.length}`);
for (const i of errors.slice(0, 20)) console.log(`  ОШИБКА ${i.where}: ${i.message}`);
// Предупреждения считались, но не печатались: строка «предупреждений 1» без
// текста бесполезна — по ней нельзя ни починить, ни решить, что чинить не надо.
for (const i of issues.filter((x) => x.level !== 'error').slice(0, 20)) {
  console.log(`  ПРЕДУПРЕЖДЕНИЕ ${i.where}: ${i.message}`);
}
if (errors.length > 0) failed = true;
summary['contentErrors'] = errors.length;
summary['contentWarnings'] = issues.length - errors.length;

// ── Бои ──────────────────────────────────────────────────────────────────────
if (!only || only === 'battles') {
  head('Винрейты юнитов (зеркальный турнир)');
  if (content.units.length === 0) {
    console.log('юнитов нет — пропуск');
  } else {
    const wr = unitWinrates(content, runs);
    const out = wr.filter((w) => !w.inCorridor);
    for (const w of wr) {
      const mark = w.thinSample ? '~~' : w.inCorridor ? '  ' : '!!';
      console.log(
        `${mark} ${w.unit.padEnd(24)} t${w.tier}  ${(w.winrate * 100).toFixed(1)}%  ` +
          `(норма ${(w.neutral * 100).toFixed(0)}%)  раундов ${w.avgRounds.toFixed(1)}` +
          `${w.thinSample ? '  тонкая выборка тира' : ''}`,
      );
    }
    console.log(
      `Вне коридора ±${(CORRIDOR_HALF_WIDTH * 100).toFixed(0)} пунктов от измеренной нормы: ` +
        `${out.length} из ${wr.length}`,
    );
    const avgRounds = wr.reduce((a, w) => a + w.avgRounds, 0) / Math.max(1, wr.length);
    const roundsOk = avgRounds >= ROUNDS_MIN && avgRounds <= ROUNDS_MAX;
    console.log(
      `${roundsOk ? '  ' : '!!'} средняя длина боя ${avgRounds.toFixed(1)} раундов ` +
        `(коридор ${ROUNDS_MIN}–${ROUNDS_MAX})`,
    );
    summary['avgRounds'] = avgRounds;
    if (!roundsOk) failed = true;
    summary['unitsOutOfCorridor'] = out.map((w) => ({ unit: w.unit, winrate: w.winrate }));
    if (out.length > 0) failed = true;

    head('Сюжетные бои');
    // Отряд подбирается под главу боя: к главе 2 игрок приходит с прокачанными
    // спутниками, и мерить её бои отрядом первого уровня — мерить не то.
    const battleChapter = new Map<string, number>();
    for (const sc of content.scenes) {
      for (const n of sc.nodes) {
        if (n.kind === 'battle') battleChapter.set(n.battle, sc.chapter);
      }
    }
    const party = defaultParty(content.units, 1, 1);
    const rep = scriptedBattles(
      content,
      (id) => {
        // Если бой объявил свой отряд — меряем ровно им: в начале главы у игрока
        // двое, и шесть сильнейших юнитов дают ложные 100%.
        const def = content.battles.find((b) => b.id === id);
        if (def?.expectParty?.length) return namedParty(content.units, def.expectParty);
        // Иначе: к главе 2 игрок успевает набрать наёмников второго тира на стене
        // найма, к главе 3 — ещё и отголоски закреплённых жизней.
        const ch = battleChapter.get(id) ?? 1;
        return defaultParty(content.units, ch === 1 ? 1 : ch === 2 ? 2 : 3, ch);
      },
      Math.max(20, Math.floor(runs / 2)),
    );
    for (const r of rep) {
      const def = content.battles.find((b) => b.id === r.battle);
      // Бой, помеченный `lethal`, игрок по сюжету не переживает — коридор к нему неприменим.
      const lethal = def?.tags?.includes('lethal') ?? false;
      // Бой-знакомство должен почти всегда выигрываться: это обучение, а не проверка.
      const tutorial = def?.tags?.includes('tutorial') ?? false;
      const ok = lethal || (tutorial ? r.winrate >= 0.85 : r.winrate >= 0.6 && r.winrate <= 0.85);
      console.log(
        `${lethal ? '~~' : ok ? '  ' : '!!'} ${r.battle.padEnd(24)} побед ${(r.winrate * 100).toFixed(0)}%  ` +
          `раундов ${r.avgRounds.toFixed(1)}  выжило ${(r.avgSurvivors * 100).toFixed(0)}%` +
          `${lethal ? '  (сюжетно летальный)' : ''}${tutorial ? '  (знакомство)' : ''}`,
      );
      if (!ok) failed = true;
    }
    summary['scriptedBattles'] = rep;

    // ── Умения игрока ────────────────────────────────────────────────────────
    // Потолок: игрок, вспомнивший ВСЁ. Раздел справочный и не краснит прогон.
    //
    // Почему не краснит. Коридор сюжетных боёв (60–85%) описывает встречу боя с
    // тем игроком, который до него доходит; игрок с полной памятью — это конец
    // прохождения, и то, что он проходит бой первой главы насквозь, не дефект
    // баланса, а обещание игры. Красная строка здесь заставляла бы автора
    // канона резать умения до незаметности. Раздел печатает разницу — по ней
    // видно, какие бои умения переворачивают, — а решение остаётся за автором.
    const allPowers = derivePlayerPowers(
      content.memories.map((m) => m.id),
      content,
    ).abilities;
    if (allPowers.length > 0) {
      head('Умения игрока (потолок: вспомнил всё)');
      console.log(`умений ${allPowers.length}: ${allPowers.map((p) => p.id).join(', ')}`);
      const withPowers = scriptedBattles(
        content,
        (id) => {
          const def = content.battles.find((b) => b.id === id);
          if (def?.expectParty?.length) return namedParty(content.units, def.expectParty);
          const ch = battleChapter.get(id) ?? 1;
          return defaultParty(content.units, ch === 1 ? 1 : ch === 2 ? 2 : 3, ch);
        },
        Math.max(20, Math.floor(runs / 2)),
        () => allPowers,
      );
      const before = new Map(rep.map((r) => [r.battle, r.winrate]));
      for (const r of withPowers) {
        const was = before.get(r.battle) ?? 0;
        const delta = (r.winrate - was) * 100;
        console.log(
          `   ${r.battle.padEnd(24)} побед ${(r.winrate * 100).toFixed(0)}%  ` +
            `(без умений ${(was * 100).toFixed(0)}%, ${delta >= 0 ? '+' : ''}${delta.toFixed(0)} пунктов)`,
        );
      }
      summary['scriptedBattlesWithPowers'] = withPowers;
    }

    // ── Лестница ступеней: каждое умение по трём ступеням ────────────────────
    // Раздел справочный по тем же причинам, что и потолок выше: коридор 60–85
    // описывает встречу боя с игроком, который до него доходит, а «умение
    // третьей ступени» — конец прохождения. Красная строка здесь заставляла бы
    // резать умения до незаметности. Зато три числа печатаются всегда:
    // применяемость (иначе цифры выше — цифры боя БЕЗ умения), длина боя и
    // отклики (иначе сродство мертво и об этом никто не узнает).
    const ladderLives = [...new Set(content.memories.map((m) => m.life))].sort();
    if (ladderLives.length > 0) {
      head('Умения памяти: три ступени каждой жизни');
      // Порядок ступеней — по цене (2 → 3 → 4), как объявлено в MEMORY_POWERS
      // §A.1, а НЕ по алфавиту id. Алфавит здесь не безобиден: у трёх жизней
      // из пяти первым по алфавиту идёт усиливающее воспоминание, и «ступень I»
      // получалась усилением без дающего, то есть пустым набором. Отчёт при
      // этом выглядел правдоподобно — просто мерил бой без умения.
      const memoriesOf = (life: string): string[] =>
        content.memories
          .filter((m) => m.life === life)
          .slice()
          .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .map((m) => m.id);
      const ladder = powerLadder(
        content,
        (id) => {
          const def = content.battles.find((b) => b.id === id);
          if (def?.expectParty?.length) return namedParty(content.units, def.expectParty);
          const ch = battleChapter.get(id) ?? 1;
          return defaultParty(content.units, ch === 1 ? 1 : ch === 2 ? 2 : 3, ch);
        },
        (life, tier) =>
          derivePlayerPowers(memoriesOf(life).slice(0, tier), content).abilities,
        ladderLives,
        Math.max(10, Math.floor(runs / 10)),
      );
      // База считается по ТОМУ ЖЕ набору боёв, что и лестница, иначе строка
      // «без умений» сравнивалась бы с другим множеством и разница врала бы.
      const base = rep.filter((r) => {
        const def = content.battles.find((b) => b.id === r.battle);
        return !def?.tags?.includes('lethal') && !def?.tags?.includes('tutorial');
      });
      const baseWin = base.reduce((a, r) => a + r.winrate, 0) / Math.max(1, base.length);
      const baseRounds = base.reduce((a, r) => a + r.avgRounds, 0) / Math.max(1, base.length);
      const baseOut = base.filter((r) => r.winrate < 0.6 || r.winrate > 0.85).length;
      console.log(
        `   без умений: побед ${(baseWin * 100).toFixed(0)}%, раундов ${baseRounds.toFixed(1)}, ` +
          `вне 60–85: ${baseOut} из ${base.length}`,
      );
      for (const r of ladder) {
        const d = (r.winrate - baseWin) * 100;
        console.log(
          `   ${r.life.padEnd(13)} ст.${r.tier}  побед ${(r.winrate * 100).toFixed(0)}% ` +
            `(${d >= 0 ? '+' : ''}${d.toFixed(0)}, разброс ${(r.minWinrate * 100).toFixed(0)}–${(r.maxWinrate * 100).toFixed(0)}, ` +
            `вне 60–85: ${r.outOfCorridor})  раундов ${r.avgRounds.toFixed(1)}  ` +
            `${r.passiveOnly ? 'пассив, заряда нет      ' : `заряд потрачен в ${(r.usedShare * 100).toFixed(0)}% боёв`}  ` +
            `откликов ${r.responsesPerBattle.toFixed(1)}/бой`,
        );
      }
      summary['powerLadder'] = ladder;
      summary['powerLadderBaseline'] = { winrate: baseWin, avgRounds: baseRounds };

      // ── Сродство: влияет ли оно на выбор отряда (MEMORY_POWERS §D.3) ───────
      // Две политики сборки отряда встречаются на одних и тех же боях с одним
      // и тем же умением второй ступени: «набери сродственных» против «набери
      // сильнейших». Если первая не отличается от второй ни винрейтом, ни
      // числом откликов — сродство мертво, сколько бы трейтов ни стояло в данных.
      head('Сродство: отряд под умение против отряда по силе');
      for (const life of ladderLives) {
        const powers = derivePlayerPowers(memoriesOf(life).slice(0, 2), content).abilities;
        const byStrength = powerLadder(
          content,
          // Второй тир, второй уровень: на шести сильнейших юнитах третьего
          // тира обе политики упираются в 96–99% и сравнивать нечего.
          () => defaultParty(content.units, 2, 2),
          () => powers,
          [life],
          Math.max(10, Math.floor(runs / 10)),
        )[0];
        const byAffinity = powerLadder(
          content,
          () => affinityParty(content.units, life, 2, 2),
          () => powers,
          [life],
          Math.max(10, Math.floor(runs / 10)),
        )[0];
        if (!byStrength || !byAffinity) continue;
        const d = (byAffinity.winrate - byStrength.winrate) * 100;
        console.log(
          `   ${life.padEnd(13)} по силе: побед ${(byStrength.winrate * 100).toFixed(0)}%, ` +
            `откликов ${byStrength.responsesPerBattle.toFixed(1)}  →  ` +
            `под умение: побед ${(byAffinity.winrate * 100).toFixed(0)}%, ` +
            `откликов ${byAffinity.responsesPerBattle.toFixed(1)}  ` +
            `(${d >= 0 ? '+' : ''}${d.toFixed(0)} пунктов)`,
        );
        summary[`affinity:${life}`] = { byStrength, byAffinity };
      }
    }

    // Воспроизводимость проверяется И с умениями: они такой же участник боя.
    const det = determinismCheck(content, party, allPowers);
    console.log(det.ok ? 'Детерминизм: OK' : `Детерминизм НАРУШЕН в бою ${det.battle}`);
    if (!det.ok) failed = true;
  }
}

// ── Темп начала ──────────────────────────────────────────────────────────────
if (!only || only === 'dialogue' || only === 'pacing') {
  head('Темп: сколько реплик до первого боя');
  if (content.scenes.length === 0) {
    console.log('сцен нет — пропуск');
  } else {
    const p = timeToFirstBattle(content, 200);
    console.log(
      `${p.ok ? '  ' : '!!'} медиана ${p.median} реплик (~${Math.floor(p.medianSeconds / 60)} мин ` +
        `${p.medianSeconds % 60} с), минимум ${p.min}, максимум ${p.max}; ` +
        `коридор: медиана ≤${BUBBLES_TO_BATTLE_MAX}`,
    );
    console.log(
      `${p.reachedBattle >= p.runs * 0.9 ? '  ' : '!!'} прогонов, дошедших до боя: ` +
        `${p.reachedBattle} из ${p.runs}`,
    );
    summary['pacing'] = p;
    if (!p.ok) failed = true;

    const rh = battleRhythm(content, 60);
    console.log(
      `${rh.ok ? '  ' : '!!'} между боями: медиана ${rh.median}, девять из десяти ` +
        `в пределах ${rh.p90} (коридор ≤${BUBBLES_BETWEEN_BATTLES_P90}), ` +
        `максимум ${rh.max} (предел ${BUBBLES_BETWEEN_BATTLES_MAX})`,
    );
    console.log(`   боёв за прохождение: ${rh.battlesPerRun}; длинных промежутков: ${rh.overP90}`);
    summary['rhythm'] = rh;
    if (!rh.ok) failed = true;
  }
}

// ── Диалоги ──────────────────────────────────────────────────────────────────
if (!only || only === 'dialogue') {
  head('Фаззер диалогов');
  if (content.scenes.length === 0) {
    console.log('сцен нет — пропуск');
  } else {
    const r = fuzzDialogue(content, personas);
    console.log(`личностей ${r.personalities}, узлов выбора ${r.choiceNodes}`);
    console.log(`тупиков (<2 вариантов): ${r.deadEnds.length}`);
    for (const d of dedupe(r.deadEnds.map((d) => `${d.scene}#${d.node} (осталось ${d.passing})`)).slice(0, 15)) {
      console.log(`  ТУПИК ${d}`);
    }
    console.log(`варианты, не показанные никому: ${r.neverShownOptions.length}`);
    for (const o of r.neverShownOptions.slice(0, 15)) console.log(`  МЁРТВЫЙ ${o.scene}#${o.node}/${o.option}`);
    // Проходит по условиям, но на экран не попадает: узел объявил больше
    // вариантов, чем помещается кнопок, и обрезка выкинула его у всех.
    console.log(`варианты, не попадающие на экран никогда: ${r.neverVisibleOptions.length}`);
    for (const o of r.neverVisibleOptions.slice(0, 15)) {
      console.log(`  НЕ ВИДЕН ${o.scene}#${o.node}/${o.option}`);
    }
    if (r.neverVisibleOptions.length > 0) failed = true;
    console.log(`условия, срабатывающие всегда: ${r.alwaysShownConditional.length}`);
    console.log(`недостижимые узлы: ${r.unreachableNodes.length}`);
    for (const n of r.unreachableNodes.slice(0, 15)) console.log(`  НЕДОСТИЖИМ ${n.scene}#${n.node}`);
    console.log(`ошибки прохода: ${r.errors.length}`);
    for (const e of dedupe(r.errors.map((e) => `${e.scene}#${e.node}: ${e.message}`)).slice(0, 10)) {
      console.log(`  ОШИБКА ${e}`);
    }
    console.log(
      `охват реплик: ${(r.lineCoverage * 100).toFixed(1)}% (${r.reachedLines}/${r.totalLines})`,
    );
    console.log(
      `охват честным прохождением с нуля: ${(r.cleanCoverage * 100).toFixed(1)}% ` +
        `(${r.cleanRuns} прогонов)`,
    );
    if (r.cleanOnlyUnreachable.length > 0) {
      console.log(
        `реплик, до которых честный игрок не доходит: ${r.cleanOnlyUnreachable.length}`,
      );
      for (const k of r.cleanOnlyUnreachable.slice(0, 10)) console.log(`  ТОЛЬКО ПОДСТАВНОЙ ${k}`);
    }
    summary['dialogue'] = {
      deadEnds: r.deadEnds.length,
      neverShown: r.neverShownOptions.length,
      unreachable: r.unreachableNodes.length,
      errors: r.errors.length,
      lineCoverage: r.lineCoverage,
      cleanCoverage: r.cleanCoverage,
      cleanOnlyUnreachable: r.cleanOnlyUnreachable.length,
    };
    if (r.deadEnds.length > 0 || r.errors.length > 0) failed = true;
    if (r.lineCoverage < 0.9) {
      console.log('!! охват реплик ниже 90%');
      failed = true;
    }
  }
}

try {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, 'latest.json'), JSON.stringify(summary, null, 2), 'utf8');
} catch {
  // отчёт — приятный бонус, не повод падать
}

head(failed ? 'ИТОГ: КРАСНЫЙ' : 'ИТОГ: зелёный');
process.exit(failed ? 1 : 0);

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

/**
 * Отряд по именам: ровно тот, что есть у игрока в этой точке сюжета.
 * Нужен для боёв, объявивших `expectParty`: бой-знакомство в начале главы
 * проходится вдвоём, и мерить его шестью сильнейшими юнитами тира — мерить
 * не тот вход, там любой состав даёт 100%.
 */
function namedParty(units: UnitDef[], ids: string[]): PartyUnit[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const out: PartyUnit[] = [];
  let front = 0;
  let back = 0;
  for (const id of ids) {
    const u = byId.get(id);
    if (!u) continue;
    const row = u.row;
    const index = row === 'front' ? front++ : back++;
    if (index > 2) continue;
    out.push({ uid: `n${out.length}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row, index } });
  }
  return out;
}

/**
 * Отряд, собранный ПОД УМЕНИЕ: сначала сродственные этой жизни, потом добор
 * сильнейшими. Ровно та политика бота, которую требует MEMORY_POWERS §D.3 —
 * «максимум сродственных при равном тире».
 */
function affinityParty(units: UnitDef[], life: string, maxTier: number, level: number): PartyUnit[] {
  const trait = `life_${life}`;
  const pool = units.filter((u) => u.tier <= maxTier);
  const rank = (a: UnitDef, b: UnitDef): number => {
    const ka = (a.traits ?? []).includes(trait) ? 1 : 0;
    const kb = (b.traits ?? []).includes(trait) ? 1 : 0;
    // Сродство важнее тира — иначе политика вырождается в «по силе».
    // Ничьи разводятся строковым сравнением id, не localeCompare.
    return kb - ka || b.tier - a.tier || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  };
  const front = pool.filter((u) => u.row === 'front').sort(rank).slice(0, 3);
  const back = pool.filter((u) => u.row === 'back').sort(rank).slice(0, 3);
  const out: PartyUnit[] = [];
  const push = (u: UnitDef, row: 'front' | 'back', i: number): void => {
    out.push({
      uid: `a${out.length}`,
      defId: u.id,
      hp: Math.round(u.stats.hp * (1 + 0.12 * (level - 1))),
      xp: 0,
      level,
      slot: { row, index: i },
    });
  };
  front.forEach((u, i) => push(u, 'front', i));
  back.forEach((u, i) => push(u, 'back', i));
  return out;
}

/** Отряд «среднего игрока» заданной главы: потолок тира и уровень. */
function defaultParty(units: UnitDef[], maxTier: number, level: number): PartyUnit[] {
  const pool = units.filter((u) => u.tier <= maxTier);
  // Берём сильнейших доступных: игрок к этой главе уже выбирал, кого держать.
  const byTier = (a: UnitDef, b: UnitDef) => b.tier - a.tier;
  const front = pool.filter((u) => u.row === 'front').sort(byTier).slice(0, 3);
  const back = pool.filter((u) => u.row === 'back').sort(byTier).slice(0, 3);
  const out: PartyUnit[] = [];
  const push = (u: UnitDef, row: 'front' | 'back', i: number) =>
    out.push({
      uid: `d${out.length}`,
      defId: u.id,
      hp: Math.round(u.stats.hp * (1 + 0.12 * (level - 1))),
      xp: 0,
      level,
      slot: { row, index: i },
    });
  front.forEach((u, i) => push(u, 'front', i));
  back.forEach((u, i) => push(u, 'back', i));
  return out;
}
