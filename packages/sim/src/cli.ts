import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { content, validateBundle } from '@nameless/content';
import type { PartyUnit, UnitDef } from '@nameless/engine';
import {
  determinismCheck,
  CORRIDOR_HALF_WIDTH,
  ROUNDS_MAX,
  ROUNDS_MIN,
  scriptedBattles,
  unitWinrates,
} from './battle-sim.js';
import { fuzzDialogue } from './dialogue-fuzz.js';
import { BUBBLES_TO_BATTLE_MAX, timeToFirstBattle } from './pacing.js';

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

    const det = determinismCheck(content, party);
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
