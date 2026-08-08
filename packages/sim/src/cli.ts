import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { content, validateBundle } from '@nameless/content';
import type { PartyUnit, UnitDef } from '@nameless/engine';
import {
  determinismCheck,
  ROUNDS_MAX,
  ROUNDS_MIN,
  scriptedBattles,
  unitWinrates,
  WINRATE_MAX,
  WINRATE_MIN,
} from './battle-sim.js';
import { fuzzDialogue } from './dialogue-fuzz.js';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const personas = Number(args.find((a) => a.startsWith('--personas='))?.split('=')[1] ?? 300);
const runs = Number(args.find((a) => a.startsWith('--runs='))?.split('=')[1] ?? 60);
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
          `раундов ${w.avgRounds.toFixed(1)}${w.thinSample ? '  (тонкая выборка тира)' : ''}`,
      );
    }
    console.log(
      `Вне коридора ${(WINRATE_MIN * 100).toFixed(0)}–${(WINRATE_MAX * 100).toFixed(0)}%: ${out.length} из ${wr.length}`,
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
    const party = defaultParty(content.units);
    const rep = scriptedBattles(content, party, Math.max(20, Math.floor(runs / 2)));
    for (const r of rep) {
      const def = content.battles.find((b) => b.id === r.battle);
      // Бой, помеченный `lethal`, игрок по сюжету не переживает — коридор к нему неприменим.
      const lethal = def?.tags?.includes('lethal') ?? false;
      const ok = lethal || (r.winrate >= 0.6 && r.winrate <= 0.85);
      console.log(
        `${lethal ? '~~' : ok ? '  ' : '!!'} ${r.battle.padEnd(24)} побед ${(r.winrate * 100).toFixed(0)}%  ` +
          `раундов ${r.avgRounds.toFixed(1)}  выжило ${(r.avgSurvivors * 100).toFixed(0)}%` +
          `${lethal ? '  (сюжетно летальный)' : ''}`,
      );
      if (!ok) failed = true;
    }
    summary['scriptedBattles'] = rep;

    const det = determinismCheck(content, party);
    console.log(det.ok ? 'Детерминизм: OK' : `Детерминизм НАРУШЕН в бою ${det.battle}`);
    if (!det.ok) failed = true;
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

/** Отряд «среднего игрока» для проверки сюжетных боёв: тир 1, три спереди, три сзади. */
function defaultParty(units: UnitDef[]): PartyUnit[] {
  const t1 = units.filter((u) => u.tier === 1);
  const front = t1.filter((u) => u.row === 'front').slice(0, 3);
  const back = t1.filter((u) => u.row === 'back').slice(0, 3);
  const out: PartyUnit[] = [];
  front.forEach((u, i) =>
    out.push({ uid: `d${out.length}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row: 'front', index: i } }),
  );
  back.forEach((u, i) =>
    out.push({ uid: `d${out.length}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 1, slot: { row: 'back', index: i } }),
  );
  return out;
}
