import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { content, validateBundle } from '@nameless/content';
import { derivePlayerPowers, type PartyUnit, type UnitDef } from '@nameless/engine';
import {
  determinismCheck,
  BASE_MAX,
  BASE_MEDIAN_MAX,
  BASE_MEDIAN_MIN,
  BASE_MIN,
  CORRIDOR_HALF_WIDTH,
  EMPTY_POWER_GAIN_MAX,
  emptyPower,
  median,
  POWER_MAX,
  POWER_MIN,
  powerLadder,
  ROUNDS_MAX,
  ROUNDS_MIN,
  scriptedBattles,
  TIER_GAIN_MAX,
  TIER_GAIN_MIN,
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

const STAND_NEUTRAL = ['beacon_warden', 'cold_reckoner', 'gravedigger_of_things', 'pale_deacon'];
const STAND_KIN = 2;

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
    // Коридор БЕЗ умений — 55–75 (MEMORY_POWERS §D.1). Прежние 60–85 остались
    // за боем при игроке с умениями и проверяются ниже, на лестнице ступеней.
    const storyIds: string[] = [];
    for (const r of rep) {
      const def = content.battles.find((b) => b.id === r.battle);
      // Бой, помеченный `lethal`, игрок по сюжету не переживает — коридор к нему неприменим.
      const lethal = def?.tags?.includes('lethal') ?? false;
      // Бой-знакомство должен почти всегда выигрываться: это обучение, а не проверка.
      const tutorial = def?.tags?.includes('tutorial') ?? false;
      if (!lethal && !tutorial) storyIds.push(r.battle);
      const ok =
        lethal || (tutorial ? r.winrate >= 0.85 : r.winrate >= BASE_MIN && r.winrate <= BASE_MAX);
      console.log(
        `${lethal ? '~~' : ok ? '  ' : '!!'} ${r.battle.padEnd(24)} побед ${(r.winrate * 100).toFixed(0)}%  ` +
          `раундов ${r.avgRounds.toFixed(1)}  выжило ${(r.avgSurvivors * 100).toFixed(0)}%` +
          `${lethal ? '  (сюжетно летальный)' : ''}${tutorial ? '  (знакомство)' : ''}`,
      );
      if (!ok) failed = true;
    }
    const storyWinrates = rep.filter((r) => storyIds.includes(r.battle)).map((r) => r.winrate);
    const storyMedian = median(storyWinrates);
    const medianOk = storyMedian >= BASE_MEDIAN_MIN && storyMedian <= BASE_MEDIAN_MAX;
    console.log(
      `${medianOk ? '  ' : '!!'} медиана по сюжетным боям ${(storyMedian * 100).toFixed(1)}% ` +
        `(коридор ${(BASE_MEDIAN_MIN * 100).toFixed(0)}–${(BASE_MEDIAN_MAX * 100).toFixed(0)}), ` +
        `коридор боя ${(BASE_MIN * 100).toFixed(0)}–${(BASE_MAX * 100).toFixed(0)} без умений`,
    );
    if (!medianOk) failed = true;
    summary['scriptedBattles'] = rep;
    summary['scriptedBattlesMedian'] = storyMedian;

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
    //
    // РАЗДЕЛ КРАСНЫЙ. До этой итерации он печатал цифры и молчал, и зелёные
    // ворота прикрывали сломанный баланс: прибор, который не умеет краснеть,
    // ничего не доказывает. Теперь падают три вещи (MEMORY_POWERS §D.1–D.2):
    // бой при игроке с умением вне 60–85, прибавка ступени над базой вне
    // 3–10 пунктов, средняя длина боя вне 6–14 раундов.
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
        // Прогонов на бой: пятая часть общего числа, а не десятая. При тридцати
        // прогонах биномиальная ошибка на бой — девять пунктов, то есть счётчик
        // «вне 60–85» показывал бы в основном свой же шум, а допуск 3–10 шириной
        // в семь пунктов мерился бы прибором с погрешностью в два.
        Math.max(20, Math.floor(runs / 5)),
      );
      // База считается по ТОМУ ЖЕ набору боёв, что и лестница, иначе строка
      // «без умений» сравнивалась бы с другим множеством и разница врала бы.
      const base = rep.filter((r) => {
        const def = content.battles.find((b) => b.id === r.battle);
        return !def?.tags?.includes('lethal') && !def?.tags?.includes('tutorial');
      });
      const baseWin = base.reduce((a, r) => a + r.winrate, 0) / Math.max(1, base.length);
      const baseRounds = base.reduce((a, r) => a + r.avgRounds, 0) / Math.max(1, base.length);
      const baseOut = base.filter((r) => r.winrate < BASE_MIN || r.winrate > BASE_MAX).length;
      console.log(
        `   без умений: побед ${(baseWin * 100).toFixed(0)}%, раундов ${baseRounds.toFixed(1)}, ` +
          `вне ${(BASE_MIN * 100).toFixed(0)}–${(BASE_MAX * 100).toFixed(0)}: ${baseOut} из ${base.length}`,
      );
      for (const r of ladder) {
        const d = (r.winrate - baseWin) * 100;
        const gainOk = d >= TIER_GAIN_MIN && d <= TIER_GAIN_MAX;
        const roundsOk2 = r.avgRounds >= ROUNDS_MIN && r.avgRounds <= ROUNDS_MAX;
        const ok = gainOk && roundsOk2 && r.outOfCorridor === 0;
        if (!ok) failed = true;
        console.log(
          `${ok ? '  ' : '!!'} ${r.life.padEnd(13)} ст.${r.tier}  побед ${(r.winrate * 100).toFixed(0)}% ` +
            `(${d >= 0 ? '+' : ''}${d.toFixed(0)}, разброс ${(r.minWinrate * 100).toFixed(0)}–${(r.maxWinrate * 100).toFixed(0)}, ` +
            `вне ${(POWER_MIN * 100).toFixed(0)}–${(POWER_MAX * 100).toFixed(0)}: ${r.outOfCorridor})  раундов ${r.avgRounds.toFixed(1)}  ` +
            `${r.passiveOnly ? 'пассив, заряда нет      ' : `заряд потрачен в ${(r.usedShare * 100).toFixed(0)}% боёв`}  ` +
            `откликов ${r.responsesPerBattle.toFixed(1)}/бой`,
        );
        if (!gainOk) {
          console.log(
            `   ↳ прибавка ступени ${d >= 0 ? '+' : ''}${d.toFixed(1)} вне допуска ` +
              `${TIER_GAIN_MIN}–${TIER_GAIN_MAX} (§D.1)`,
          );
        }
        if (!roundsOk2) console.log(`   ↳ длина боя ${r.avgRounds.toFixed(1)} вне ${ROUNDS_MIN}–${ROUNDS_MAX} (§D.2)`);
        for (const pb of r.perBattle) {
          if (pb.winrate >= POWER_MIN && pb.winrate <= POWER_MAX) continue;
          console.log(`   ↳ ${pb.battle.padEnd(24)} ${(pb.winrate * 100).toFixed(0)}% вне ${(POWER_MIN * 100).toFixed(0)}–${(POWER_MAX * 100).toFixed(0)}`);
        }
      }
      summary['powerLadder'] = ladder;
      summary['powerLadderBaseline'] = { winrate: baseWin, avgRounds: baseRounds };

      /*
       * Контроль отклика (§D.1). Прибавка ступени — это сумма двух слагаемых,
       * умения и отклика сродственных, и по общей цифре их не различить.
       * Однажды на этом уже обожглись: пустышка давала +11.3, то есть почти всю
       * прибавку платил отклик, — а резали числа умений, то есть не то.
       *
       * Пустышка ничего не делает, но тратит ход и несёт живую жизнь. Всё, что
       * она набрала, — цена отклика и ничего больше.
       *
       * ОТРЯД ДЛЯ КОНТРОЛЯ СОБИРАЕТСЯ ОСОБО, и без этого прибор врал. Сначала
       * он мерил каждую жизнь ТИПОВЫМ отрядом — а в типовом отряде у одной
       * жизни оказывался один сродственный, у другой двое, у третьей ни
       * одного, и это выходило случайно, по тирам и рядам. Пять чисел, которые
       * канон сравнивает между собой требованием «разброс ≤4», были получены в
       * разных условиях и сравнению не подлежали: у Смолокура отклик вообще
       * жил в одном бою из четырнадцати, и три ручки подряд (отложенный урон,
       * номинал 5→3, снятие сродства у Багорщика) сдвинули его ровно на ноль,
       * потому что двигали то, чего в замере почти не было.
       *
       * Теперь в отряд принудительно ставится РОВНО ДВА сродственных нужной
       * жизни — столько же для всех пятерых. Это единственный способ, при
       * котором «разброс между жизнями» означает разницу ролей, а не разницу
       * ростера. Замена идёт по тиру, чтобы не подменять заодно и силу отряда.
       */
      head('Контроль отклика: умение, которое ничего не делает');
      /*
       * Эталонный набор боёв — только те, что рассчитаны на второй тир, то
       * есть бои второй главы. Стенд собран из шестёрки второго тира, и
       * гонять его по всему корпусу значило бы мерить не отклик, а то, как
       * шестёрка второго тира держится против третьей главы: первые прогоны
       * так и дали 36–48% побед и почти нулевую частоту отклика — бот просто
       * не доживал до применения.
       */
      const standBattles = content.battles.filter(
        (b) =>
          (battleChapter.get(b.id) ?? 1) === 2 &&
          !b.tags?.includes('lethal') &&
          !b.tags?.includes('tutorial'),
      );
      const standContent = { ...content, battles: standBattles };
      console.log(`   эталонный набор: ${standBattles.length} боёв второй главы`);

      const emptyGains: Record<string, number> = {};
      for (const life of ladderLives) {
        const rowRep = powerLadder(
          standContent,
          // Стенд один и тот же во всех боях набора: контроль сравнивает жизни,
          // а не главы, и подстраиваться под бой ему нечем и незачем.
          () => standParty(content.units, life),
          () => [emptyPower(life)],
          [life],
          Math.max(20, Math.floor(runs / 5)),
        )[0];
        /*
         * База для контроля меряется ТЕМ ЖЕ отрядом, но без умения. Иначе в
         * разницу попала бы сама подстановка сродственных: они меняют силу
         * отряда, и прибор списал бы это на отклик.
         */
        const rowBase = powerLadder(
          standContent,
          // Стенд один и тот же во всех боях набора: контроль сравнивает жизни,
          // а не главы, и подстраиваться под бой ему нечем и незачем.
          () => standParty(content.units, life),
          () => [],
          [life],
          Math.max(20, Math.floor(runs / 5)),
        )[0];
        if (!rowRep || !rowBase) continue;
        // Строка без нормы сродственных сравнению не подлежит и обязана
        // сказать это вслух: «не смог измерить» — не «всё в порядке».
        const kinMin = standKinCount(content.units, life);
        const comparable = kinMin >= STAND_KIN;
        const d = (rowRep.winrate - rowBase.winrate) * 100;
        emptyGains[life] = d;
        // Несравнимую строку прибор роняет так же, как вышедшую за предел:
        // «не смог измерить» — это не «всё в порядке».
        const ok = comparable && d <= EMPTY_POWER_GAIN_MAX;
        if (!ok) failed = true;
        console.log(
          `${ok ? '  ' : '!!'} ${life.padEnd(13)} побед ${(rowRep.winrate * 100).toFixed(0)}% ` +
            `(${d >= 0 ? '+' : ''}${d.toFixed(1)} над базой, предел +${EMPTY_POWER_GAIN_MAX})  ` +
            `откликов ${rowRep.responsesPerBattle.toFixed(2)}/бой, ` +
            `сродственных в стенде ${kinMin}/${STAND_KIN}`,
        );
        if (!comparable) {
          console.log(
            `   ↳ в стенд встало лишь ${kinMin} сродственных из ${STAND_KIN}: строка НЕСРАВНИМА ` +
              `с прочими, менять по ней нечего`,
          );
        } else if (d > EMPTY_POWER_GAIN_MAX) {
          console.log(
            `   ↳ отклик платит больше, чем весь допуск ступени: резать числа умений бессмысленно`,
          );
        }
      }
      summary['emptyPowerGain'] = emptyGains;

      // ── Сродство: маржинальный критерий (MEMORY_POWERS §D.3, новая редакция)
      //
      // Первый критерий («отряд под умение обыгрывает отряд по силе на ≥4»)
      // отозван автором канона: он мерил доминирование состава, а не сродство —
      // отряд из трёх лекарей Ключаря проигрывал −13 из-за трёх лекарей.
      // Новая мерка — маржинальная: в ТИПОВОМ отряде один несродственный юнит
      // меняется на сродственного РАВНОГО ТИРА, и меряется, что это дало.
      // Канон ждёт +2..+6 пункта в боях с умением и не хуже −1 без умения.
      head('Сродство: замена одного юнита на сродственного равного тира');
      for (const life of ladderLives) {
        const swap = affinitySwap(content.units, life, 2, 2);
        if (!swap) {
          console.log(`   ${life.padEnd(13)} менять некого: сродственных равного тира вне отряда нет`);
          continue;
        }
        const powers = derivePlayerPowers(memoriesOf(life).slice(0, 2), content).abilities;
        const ladderRuns = Math.max(20, Math.floor(runs / 5));
        const withSkill = (p: PartyUnit[]) => powerLadder(content, () => p, () => powers, [life], ladderRuns)[0];
        const noSkill = (p: PartyUnit[]) => powerLadder(content, () => p, () => [], [life], ladderRuns)[0];
        const a = withSkill(swap.before);
        const b = withSkill(swap.after);
        const a0 = noSkill(swap.before);
        const b0 = noSkill(swap.after);
        if (!a || !b || !a0 || !b0) continue;
        const dSkill = (b.winrate - a.winrate) * 100;
        const dPlain = (b0.winrate - a0.winrate) * 100;
        // Раздел справочный: сродство — свойство ростера и таблицы §C.4, а её
        // правка запрещена. Красная строка здесь требовала бы менять то, что
        // менять нельзя, поэтому цифры печатаются, а вердикт остаётся автору.
        console.log(
          `   ${life.padEnd(13)} ${swap.out} → ${swap.in} (тир ${swap.tier})  ` +
            `с умением ${dSkill >= 0 ? '+' : ''}${dSkill.toFixed(1)} (ждём +2..+6), ` +
            `без умения ${dPlain >= 0 ? '+' : ''}${dPlain.toFixed(1)} (ждём ≥ −1), ` +
            `откликов ${a.responsesPerBattle.toFixed(1)} → ${b.responsesPerBattle.toFixed(1)}`,
        );
        summary[`affinity:${life}`] = { swap, dSkill, dPlain, responses: b.responsesPerBattle };
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
/**
 * Стенд для контроля отклика (§D.1).
 *
 * Шесть юнитов второго тира: ровно два сродственных замеряемой жизни и одна и
 * та же нейтральная четвёрка на все пять стендов. Состав НАЗНАЧЕН, а не
 * унаследован у типового отряда, и в этом всё дело: пока контроль мерил каждую
 * жизнь типовым отрядом, сродственных в нём оказывалось сколько придётся — у
 * одной жизни один, у другой двое, у третьей один и только в боях второй
 * главы. Пять чисел, которые канон сравнивает требованием «разброс ≤4», были
 * получены в разных условиях, и три ручки подряд двигали строку Смолокура
 * ровно на ноль, потому что двигали то, чего в замере почти не было.
 *
 * Тир один на всех, чтобы вместе со сродством в стенд не въезжала сила.
 */

function standParty(units: UnitDef[], life: string): PartyUnit[] {
  const kin = units
    .filter((u) => u.tier === 2 && (u.traits ?? []).includes(`life_${life}`))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .slice(0, STAND_KIN);
  const neutral = STAND_NEUTRAL.map((id) => units.find((u) => u.id === id)).filter(
    (u): u is UnitDef => !!u,
  );
  /*
   * Раскладка своя, а не `namedParty`: тот молча отбрасывает всё, что не влезло
   * в три клетки ряда, и три стенда из пяти выходили пятёрками против шестёрок
   * — прибор снова сравнивал бы разное. Переполнение ряда уходит в соседний,
   * как в бою и бывает.
   *
   * Уровень 2, а не 1: эталонный набор — бои второй главы, и они рассчитаны на
   * прокачанный отряд. Стенд первого уровня проигрывал их в ноль, и отклик в
   * нём не срабатывал вовсе — мерить было нечего.
   */
  const front: UnitDef[] = [];
  const back: UnitDef[] = [];
  for (const u of [...kin, ...neutral]) {
    const prefer = u.row === 'front' ? front : back;
    const other = u.row === 'front' ? back : front;
    if (prefer.length < 3) prefer.push(u);
    else if (other.length < 3) other.push(u);
  }
  const out: PartyUnit[] = [];
  front.forEach((u, i) =>
    out.push({ uid: `s${out.length}:${u.id}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 2, slot: { row: 'front', index: i } }),
  );
  back.forEach((u, i) =>
    out.push({ uid: `s${out.length}:${u.id}`, defId: u.id, hp: u.stats.hp, xp: 0, level: 2, slot: { row: 'back', index: i } }),
  );
  return out;
}

/** Сколько сродственных реально встало в стенд — строка без нормы несравнима. */
function standKinCount(units: UnitDef[], life: string): number {
  const byId = new Map(units.map((u) => [u.id, u]));
  return standParty(units, life).filter((p) =>
    (byId.get(p.defId)?.traits ?? []).includes(`life_${life}`),
  ).length;
}

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
 * Замена одного юнита на сродственного РАВНОГО ТИРА — маржинальная мерка
 * сродства (MEMORY_POWERS §D.3, новая редакция).
 *
 * Берётся типовой отряд главы, из него уходит один несродственный юнит и
 * приходит сродственный того же тира и того же ряда. Всё остальное в отряде
 * не двигается — иначе меряется состав, а не сродство, на чём и погорел
 * прежний критерий («собери отряд под умение»): три лекаря Ключаря
 * проигрывали −13 пунктов из-за трёх лекарей, а не из-за отклика.
 *
 * Выбор пары детерминирован: самый сильный подходящий пришелец, самый слабый
 * подходящий уходящий, ничьи — обычным строковым сравнением id.
 */
function affinitySwap(
  units: UnitDef[],
  life: string,
  maxTier: number,
  level: number,
): { before: PartyUnit[]; after: PartyUnit[]; in: string; out: string; tier: number } | undefined {
  const trait = `life_${life}`;
  const before = defaultParty(units, maxTier, level);
  const byId = new Map(units.map((u) => [u.id, u]));
  const inParty = new Set(before.map((p) => p.defId));
  const byIdAsc = (a: UnitDef, b: UnitDef): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const newcomers = units
    .filter((u) => u.tier <= maxTier && !inParty.has(u.id) && (u.traits ?? []).includes(trait))
    .sort((a, b) => b.tier - a.tier || byIdAsc(a, b));
  for (const arrival of newcomers) {
    const victim = before
      .filter((p) => {
        const d = byId.get(p.defId);
        return !!d && d.tier === arrival.tier && d.row === arrival.row && !(d.traits ?? []).includes(trait);
      })
      .sort((x, y) => (x.defId < y.defId ? -1 : x.defId > y.defId ? 1 : 0))[0];
    if (!victim) continue;
    const after = before.map((p) =>
      p.uid === victim.uid
        ? { ...p, defId: arrival.id, hp: Math.round(arrival.stats.hp * (1 + 0.12 * (level - 1))) }
        : p,
    );
    return { before, after, in: arrival.id, out: victim.defId, tier: arrival.tier };
  }
  return undefined;
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
