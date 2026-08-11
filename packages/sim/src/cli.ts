import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content, validateBundle } from '@nameless/content';
// `defaultParty`/`namedParty` уехали в движок: с появлением полигона боёв
// правило отряда читают двое — симулятор и клиент, — и их числа сравнивают
// друг с другом. Копия правила рассинхронизировалась бы молча (roster.ts).
import {
  defaultParty,
  derivePlayerPowers,
  namedParty,
  type PartyUnit,
  type UnitDef,
} from '@nameless/engine';
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
import {
  loadBaseline,
  verdict,
  writeBaseline,
  type Finding,
  type FindingKind,
} from './baseline.js';
import {
  brief as plainwordsBrief,
  checkPlainwords,
  findings as plainwordsFindings,
} from '../../../tools/plainwords.mjs';
import {
  DECISION_EPS,
  DECISION_ROLLOUTS,
  DECISION_RUNS,
  decisionDensity,
  NO_DECISION_MAX,
} from './decisions.js';
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
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const reportDir = join(root, 'sim-reports');
const baselinePath = join(root, 'sim-baseline.json');
// Снять базу заново по текущему прогону. Ручка НЕ для «сделать зелёным»:
// каждая запись потом дописывается причиной, иначе база превращается в список
// цифр, по которому нельзя ни починить, ни решить, что чинить не надо.
const updateBaseline = args.includes('--update-baseline');

const STAND_NEUTRAL = ['beacon_warden', 'cold_reckoner', 'gravedigger_of_things', 'pale_deacon'];
const STAND_KIN = 2;

/**
 * Красные строки прогона. Раньше здесь стоял один флаг `failed`, и прогон умел
 * сказать только «красный» — а он красный третий месяц подряд, и под этим
 * ответом спокойно жили новые дефекты. Теперь каждая красная строка называет
 * себя парой `kind:id` и сверяется с `sim-baseline.json`.
 */
const findings: Finding[] = [];
function red(kind: FindingKind, id: string, note: string, value?: number): void {
  findings.push({ kind, id, note, ...(value === undefined ? {} : { value }) });
}
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
for (const i of errors) red('content', i.where, i.message);
summary['contentErrors'] = errors.length;
summary['contentWarnings'] = issues.length - errors.length;

// ── Простые слова: канцелярский словарь ──────────────────────────────────────
// Счёт живёт в `tools/plainwords.mjs` (запускается и в одиночку), а сюда
// приходит потому, что база известного красного одна на всю игру и лежит
// здесь: корпус сейчас красный по праву — тексты ещё не переехали в мир Б.
if (!only || only === 'words') {
  head('Простые слова (docs/ПЕРЕХОД.md §6)');
  const words = checkPlainwords(root);
  for (const line of plainwordsBrief(words)) console.log(line);
  for (const f of plainwordsFindings(words)) red('plainwords', f.id, f.note, f.value);
  summary['plainwords'] = {
    tierAHits: words.tierAHits,
    tierAScenes: words.tierAScenes.map((s) => s.id),
    tierBScenes: words.tierBScenes.map((s) => ({ id: s.id, hits: s.tierB, limit: s.limit })),
    perLineHits: words.perLineHits,
    names: words.names.map((n) => ({ power: n.power, share: n.share })),
  };
}

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
    if (!roundsOk) {
      red(
        'tournamentRounds',
        'all',
        `средняя длина боя ${avgRounds.toFixed(1)} вне коридора ${ROUNDS_MIN}–${ROUNDS_MAX}`,
        Number(avgRounds.toFixed(2)),
      );
    }
    summary['unitsOutOfCorridor'] = out.map((w) => ({ unit: w.unit, winrate: w.winrate }));
    for (const w of out) {
      red(
        'unitWinrate',
        w.unit,
        `винрейт ${(w.winrate * 100).toFixed(1)}% вне ±${(CORRIDOR_HALF_WIDTH * 100).toFixed(0)} ` +
          `пунктов от нормы тира ${(w.neutral * 100).toFixed(0)}%`,
        Number((w.winrate * 100).toFixed(1)),
      );
    }

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
      if (!ok) {
        red(
          'storyBattle',
          r.battle,
          tutorial
            ? `бой-знакомство выигрывается лишь в ${(r.winrate * 100).toFixed(0)}% (нужно ≥85%)`
            : `побед ${(r.winrate * 100).toFixed(0)}% вне коридора ` +
              `${(BASE_MIN * 100).toFixed(0)}–${(BASE_MAX * 100).toFixed(0)} без умений`,
          Number((r.winrate * 100).toFixed(1)),
        );
      }
    }
    const storyWinrates = rep.filter((r) => storyIds.includes(r.battle)).map((r) => r.winrate);
    const storyMedian = median(storyWinrates);
    const medianOk = storyMedian >= BASE_MEDIAN_MIN && storyMedian <= BASE_MEDIAN_MAX;
    console.log(
      `${medianOk ? '  ' : '!!'} медиана по сюжетным боям ${(storyMedian * 100).toFixed(1)}% ` +
        `(коридор ${(BASE_MEDIAN_MIN * 100).toFixed(0)}–${(BASE_MEDIAN_MAX * 100).toFixed(0)}), ` +
        `коридор боя ${(BASE_MIN * 100).toFixed(0)}–${(BASE_MAX * 100).toFixed(0)} без умений`,
    );
    if (!medianOk) {
      red(
        'storyMedian',
        'all',
        `медиана по сюжетным боям ${(storyMedian * 100).toFixed(1)}% вне коридора ` +
          `${(BASE_MEDIAN_MIN * 100).toFixed(0)}–${(BASE_MEDIAN_MAX * 100).toFixed(0)}`,
        Number((storyMedian * 100).toFixed(1)),
      );
    }
    summary['scriptedBattles'] = rep;
    summary['scriptedBattlesMedian'] = storyMedian;

    // ── Заслон: умеет ли бот играть механикой (DIRECTION_COMBAT §B.C1, §E.6) ──
    //
    // Правило §E.6 короткое: механику, в которую бот не умеет играть, нельзя
    // замерить — отчёт выйдет зелёным при любой её силе, и первым перекос
    // заметит игрок. Поэтому заслон отчитывается отдельной строкой: сколько раз
    // за бой к нему прибегает каждая сторона и сколько раз поручительство
    // действительно приняло удар. Ноль у стороны игрока — красное: значит, все
    // цифры выше сняты с боя БЕЗ заслона.
    head('Заслон: пользуется ли им бот');
    const storyReps = rep.filter((r) => storyIds.includes(r.battle));
    const coverMine = storyReps.reduce((a, r) => a + r.coversPlayer, 0) / Math.max(1, storyReps.length);
    const coverTheirs = storyReps.reduce((a, r) => a + r.coversEnemy, 0) / Math.max(1, storyReps.length);
    const coverFired = storyReps.reduce((a, r) => a + r.coversFired, 0) / Math.max(1, storyReps.length);
    for (const r of storyReps) {
      if (r.coversPlayer + r.coversEnemy === 0) continue;
      console.log(
        `   ${r.battle.padEnd(24)} игрок ${r.coversPlayer.toFixed(2)}/бой  ` +
          `враг ${r.coversEnemy.toFixed(2)}/бой  принято ударов ${r.coversFired.toFixed(2)}/бой`,
      );
    }
    const coverOk = coverMine > 0;
    console.log(
      `${coverOk ? '  ' : '!!'} по сюжетным боям: игрок ${coverMine.toFixed(2)}/бой, ` +
        `враг ${coverTheirs.toFixed(2)}/бой, принято ударов ${coverFired.toFixed(2)}/бой`,
    );
    summary['cover'] = { player: coverMine, enemy: coverTheirs, fired: coverFired };
    if (!coverOk) {
      red(
        'coverUnused',
        'all',
        'бот-игрок ни разу не заслонил: механика в замер не вошла, и коридоры выше ' +
          'сняты с боя без неё (DIRECTION_COMBAT §E.6)',
        0,
      );
    }

    // ── Наддача: есть ли у заёма цена и есть ли решение (§B.C2, §E.6) ────────
    //
    // Две разные проверки, и путать их нельзя.
    //
    // ПЕРВАЯ — пользуется ли механикой бот. Ноль наддач у стороны игрока
    // значит, что все коридоры выше сняты с боя БЕЗ наддачи, какой бы сильной
    // она ни была: то же правило §E.6, что и у заслона.
    //
    // ВТОРАЯ — три политики против одной доски. Наддача заявлена как ЗАЁМ под
    // процент, и это проверяемое утверждение: «всегда наддаю» обязано
    // проигрывать «никогда» — иначе процента нет и заём бесплатный, — а «наддаю
    // на добивание» обязано обыгрывать обе крайности, иначе решать нечего и
    // кнопка лишняя. Меняется политика ТОЛЬКО у игрока: враг во всех трёх
    // прогонах играет одинаково, иначе сравнивались бы два разных мира.
    head('Наддача: есть ли цена и есть ли решение');
    const surgeMine = storyReps.reduce((a, r) => a + r.surgesPlayer, 0) / Math.max(1, storyReps.length);
    const surgeTheirs = storyReps.reduce((a, r) => a + r.surgesEnemy, 0) / Math.max(1, storyReps.length);
    for (const r of storyReps) {
      if (r.surgesPlayer + r.surgesEnemy === 0) continue;
      console.log(
        `   ${r.battle.padEnd(24)} игрок ${r.surgesPlayer.toFixed(2)}/бой  враг ${r.surgesEnemy.toFixed(2)}/бой`,
      );
    }
    console.log(
      `${surgeMine > 0 ? '  ' : '!!'} по сюжетным боям: игрок ${surgeMine.toFixed(2)}/бой, ` +
        `враг ${surgeTheirs.toFixed(2)}/бой (канон просит 1–3 у персоны)`,
    );
    if (surgeMine === 0) {
      red(
        'surgeUnused',
        'all',
        'бот-игрок ни разу не наддал: механика в замер не вошла, и коридоры выше ' +
          'сняты с боя без неё (DIRECTION_COMBAT §E.6)',
        0,
      );
    }

    /*
     * Контроль сравнивает три политики, и его точность нужна НА РАЗНИЦЕ.
     *
     * Первая редакция брала медиану по четырнадцати боям — то есть выбрасывала
     * все прогоны, кроме одного среднего боя, и разницу в пункт отличить не
     * могла: замер дал «−0.7» там, где честный ответ был «меньше шума».
     * Считаем долю побед по ВСЕМ прогонам всех сюжетных боёв разом: те же
     * данные, но целиком, и разница перестаёт тонуть.
     */
    const surgeRuns = Math.max(24, Math.floor(runs / 3));
    const policyWinrate = (player: 'never' | 'always' | 'finish'): number => {
      const r = scriptedBattles(
        content,
        (id) => {
          const def = content.battles.find((b) => b.id === id);
          if (def?.expectParty?.length) return namedParty(content.units, def.expectParty);
          const ch = battleChapter.get(id) ?? 1;
          return defaultParty(content.units, ch === 1 ? 1 : ch === 2 ? 2 : 3, ch);
        },
        surgeRuns,
        undefined,
        { player, enemy: 'finish' },
      );
      const rows = r.filter((x) => storyIds.includes(x.battle));
      const wins = rows.reduce((a, x) => a + x.winrate * x.runs, 0);
      const total = rows.reduce((a, x) => a + x.runs, 0);
      return total > 0 ? wins / total : 0;
    };
    const pNever = policyWinrate('never');
    const pAlways = policyWinrate('always');
    const pFinish = policyWinrate('finish');
    const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
    console.log(
      `   доля побед по всем сюжетным боям, ${surgeRuns} прогонов на бой: никогда ${pct(pNever)}, ` +
        `всегда ${pct(pAlways)}, на добивание ${pct(pFinish)}`,
    );
    summary['surge'] = {
      player: surgeMine,
      enemy: surgeTheirs,
      never: pNever,
      always: pAlways,
      finish: pFinish,
    };
    // Цена заёма: «всегда» обязано быть ХУЖЕ «никогда». Порог в один пункт —
    // это не запас прочности, а признание погрешности: при таком числе
    // прогонов разница меньше пункта неотличима от шума.
    const priceGap = (pNever - pAlways) * 100;
    console.log(
      `${priceGap >= 1 ? '  ' : '!!'} цена заёма: «всегда» хуже «никогда» на ${priceGap.toFixed(1)} пункта`,
    );
    if (priceGap < 1) {
      red(
        'surgePrice',
        'all',
        `«всегда наддаю» не проигрывает «никогда» (разница ${priceGap.toFixed(1)} пункта): ` +
          'заём выходит бесплатным, и наддача — не решение, а всегда верный ход',
        Number(priceGap.toFixed(1)),
      );
    }
    // Решение: «на добивание» обязано обыгрывать обе крайности. Канон просит
    // ≥4 пунктов над обеими (DIRECTION_COMBAT §B.C2, «Успех»).
    const decisionGap = (pFinish - Math.max(pNever, pAlways)) * 100;
    console.log(
      `${decisionGap >= 4 ? '  ' : '!!'} решение: «на добивание» лучше обеих крайностей на ` +
        `${decisionGap.toFixed(1)} пункта (канон просит ≥4)`,
    );
    if (decisionGap < 4) {
      red(
        'surgeDecision',
        'all',
        `«наддаю на добивание» обыгрывает крайности лишь на ${decisionGap.toFixed(1)} пункта ` +
          'при требуемых 4 (§B.C2): решения в наддаче меньше, чем обещано каноном',
        Number(decisionGap.toFixed(1)),
      );
    }

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
        // Три разных дефекта — три разные записи: строка бывает красной по
        // прибавке, по длине боя и по числу боёв вне коридора порознь, и
        // общий ключ «строка красная» прятал бы появление нового дефекта под
        // уже известным.
        const step = `${r.life}:${r.tier}`;
        if (!gainOk) {
          red(
            'ladderGain',
            step,
            `прибавка ступени ${d >= 0 ? '+' : ''}${d.toFixed(1)} вне допуска ` +
              `${TIER_GAIN_MIN}–${TIER_GAIN_MAX} (§D.1)`,
            Number(d.toFixed(1)),
          );
        }
        if (!roundsOk2) {
          red(
            'ladderRounds',
            step,
            `длина боя ${r.avgRounds.toFixed(1)} вне ${ROUNDS_MIN}–${ROUNDS_MAX} (§D.2)`,
            Number(r.avgRounds.toFixed(2)),
          );
        }
        if (r.outOfCorridor > 0) {
          red(
            'ladderCorridor',
            step,
            `${r.outOfCorridor} боёв вне ${(POWER_MIN * 100).toFixed(0)}–` +
              `${(POWER_MAX * 100).toFixed(0)} при игроке с умением (§D.1)`,
            r.outOfCorridor,
          );
        }
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
        if (!comparable) {
          red(
            'emptyPowerStand',
            life,
            `в стенд встало лишь ${kinMin} сродственных из ${STAND_KIN}: строка несравнима`,
            kinMin,
          );
        } else if (d > EMPTY_POWER_GAIN_MAX) {
          red(
            'emptyPower',
            life,
            `пустышка даёт +${d.toFixed(1)} над базой при пределе +${EMPTY_POWER_GAIN_MAX}: ` +
              `прибавку платит отклик сродственных, а не умение`,
            Number(d.toFixed(1)),
          );
        }
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

    // ── Ходы без решения (docs/БОЙ_ЗАМЕРЫ.md, метрика А) ─────────────────────
    //
    // Жалоба владельца «бой не динамичный и скучный» разобрана в
    // DIRECTION_COMBAT §A.1 одной фразой: «лучший ход вычисляется, а не
    // выбирается». Здесь эта фраза становится числом. На каждом ходу стороны
    // игрока перечисляются все законные действия, лучшее из них отбирается на
    // одной жеребьёвке и ПРОВЕРЯЕТСЯ на другой (иначе максимум шумных оценок
    // сам себя завышает), и если доказанного превосходства над жадным ходом
    // нет — ход записан как ход без решения.
    head('Ходы без решения: жадный бот против перебора');
    const dec = decisionDensity(
      content,
      (id) => {
        const def = content.battles.find((b) => b.id === id);
        if (def?.expectParty?.length) return namedParty(content.units, def.expectParty);
        const ch = battleChapter.get(id) ?? 1;
        return defaultParty(content.units, ch === 1 ? 1 : ch === 2 ? 2 : 3, ch);
      },
      { rollouts: DECISION_ROLLOUTS, runs: DECISION_RUNS },
    );
    const decOk = dec.noDecisionShare <= NO_DECISION_MAX;
    for (const r of dec.perBattle) {
      const share = r.turns > 0 ? r.noDecision / r.turns : 0;
      console.log(
        `   ${r.battle.padEnd(26)} ходов ${String(r.turns).padStart(3)}  без решения ` +
          `${(share * 100).toFixed(0)}%  (вынужденных ${((r.forced / Math.max(1, r.turns)) * 100).toFixed(0)}%)  ` +
          `выбор из ${r.branching.toFixed(1)}  потеря жадного ${r.regret.toFixed(3)}`,
      );
    }
    console.log(
      `${decOk ? '  ' : '!!'} доля ходов без решения ${(dec.noDecisionShare * 100).toFixed(1)}% ` +
        `по ${dec.turns} ходам (предел ${(NO_DECISION_MAX * 100).toFixed(0)}%), ` +
        `из них вынужденных ${(dec.forcedShare * 100).toFixed(1)}%`,
    );
    console.log(
      `   ширина выбора ${dec.branching.toFixed(1)} действия на ход; средняя потеря жадного ` +
        `${dec.regret.toFixed(3)} полосы отряда; прокатов на вариант ${DECISION_ROLLOUTS}`,
    );
    // Прибор обязан уметь сказать «я этого не различаю»: если шум разницы
    // подобрался к порогу заметности, цифра выше — про жеребьёвку, а не про бой.
    const decNoisy = dec.noise >= DECISION_EPS;
    console.log(
      `${decNoisy ? '!!' : '  '} шум разницы ${dec.noise.toFixed(3)} (худший бой ${dec.noiseMax.toFixed(3)}) ` +
        `против порога заметности ${DECISION_EPS}` +
        `${decNoisy ? ' — прибор различает хуже, чем судит: подними прокаты' : ''}`,
    );
    summary['decisions'] = dec;
    if (!decOk) {
      red(
        'noDecision',
        'all',
        `${(dec.noDecisionShare * 100).toFixed(1)}% ходов игрока не содержат решения при пределе ` +
          `${(NO_DECISION_MAX * 100).toFixed(0)}%: жадная эвристика совпадает с перебором, ` +
          `и лучший ход вычисляется, а не выбирается (DIRECTION_COMBAT §A.1)`,
        Number((dec.noDecisionShare * 100).toFixed(1)),
      );
    }

    // Воспроизводимость проверяется И с умениями: они такой же участник боя.
    const det = determinismCheck(content, party, allPowers);
    console.log(det.ok ? 'Детерминизм: OK' : `Детерминизм НАРУШЕН в бою ${det.battle}`);
    if (!det.ok) {
      red('determinism', det.battle ?? 'unknown', 'один сид дал два разных боя');
    }
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
    if (p.median > BUBBLES_TO_BATTLE_MAX) {
      red(
        'pacing',
        'timeToFirstBattle',
        `до первого боя ${p.median} реплик при пределе ${BUBBLES_TO_BATTLE_MAX}`,
        p.median,
      );
    }
    if (p.reachedBattle < p.runs * 0.9) {
      red(
        'pacing',
        'reachedFirstBattle',
        `до боя дошли ${p.reachedBattle} прогонов из ${p.runs} (нужно ≥90%)`,
        p.reachedBattle,
      );
    }

    const rh = battleRhythm(content, 60);
    console.log(
      `${rh.ok ? '  ' : '!!'} между боями: медиана ${rh.median}, девять из десяти ` +
        `в пределах ${rh.p90} (коридор ≤${BUBBLES_BETWEEN_BATTLES_P90}), ` +
        `максимум ${rh.max} (предел ${BUBBLES_BETWEEN_BATTLES_MAX})`,
    );
    console.log(`   боёв за прохождение: ${rh.battlesPerRun}; длинных промежутков: ${rh.overP90}`);
    summary['rhythm'] = rh;
    if (rh.p90 > BUBBLES_BETWEEN_BATTLES_P90) {
      red(
        'rhythm',
        'p90',
        `девять из десяти промежутков в ${rh.p90} реплик при коридоре ` +
          `${BUBBLES_BETWEEN_BATTLES_P90}`,
        rh.p90,
      );
    }
    if (rh.max > BUBBLES_BETWEEN_BATTLES_MAX) {
      red(
        'rhythm',
        'max',
        `самый длинный промежуток между боями ${rh.max} реплик при пределе ` +
          `${BUBBLES_BETWEEN_BATTLES_MAX}`,
        rh.max,
      );
    }
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
    for (const o of r.neverVisibleOptions) {
      red(
        'invisibleOption',
        `${o.scene}#${o.node}/${o.option}`,
        'вариант проходит по условиям, но обрезка по приоритету не пускает его на экран ' +
          'ни одной личности: мёртвый текст и всё, что за ним',
      );
    }
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
    for (const key of dedupe(r.deadEnds.map((d) => `${d.scene}#${d.node}`))) {
      const worst = Math.min(...r.deadEnds.filter((d) => `${d.scene}#${d.node}` === key).map((d) => d.passing));
      red('deadEnd', key, `у части личностей в узле остаётся ${worst} вариант(ов) без страховки`, worst);
    }
    for (const key of dedupe(r.errors.map((e) => `${e.scene}#${e.node}`))) {
      const message = r.errors.find((e) => `${e.scene}#${e.node}` === key)?.message ?? '';
      red('walkError', key, `проход обрывается ошибкой: ${message}`);
    }
    if (r.lineCoverage < 0.9) {
      console.log('!! охват реплик ниже 90%');
      red(
        'lineCoverage',
        'all',
        `охват реплик ${(r.lineCoverage * 100).toFixed(1)}% ниже 90%`,
        Number((r.lineCoverage * 100).toFixed(1)),
      );
    }
  }
}

// ── Сверка с базой известного красного ───────────────────────────────────────
head('Сверка с базой известного красного');
if (updateBaseline && only) {
  // Иначе база сохранила бы половину списка, а вторая половина при следующем
  // полном прогоне приехала бы как «новое красное».
  console.log('!! --update-baseline вместе с --only запрещён: база снимается только полным прогоном');
  process.exit(2);
}
if (updateBaseline) {
  writeBaseline(
    baselinePath,
    findings,
    'Известное красное симулятора. Прогон сверяется с этим списком: запись отсюда ' +
      'печатается как известная и НЕ роняет прогон, всё остальное красное — падение. ' +
      'Причина у каждой записи обязательна: список без причин нельзя ни починить, ни ' +
      'осознанно оставить.',
  );
  console.log(`база снята заново: ${findings.length} записей в ${baselinePath}`);
  console.log('   ПРОВЕРЬ причины у каждой записи руками — снимок пишет их машинными словами');
}
const { baseline, error: baselineError } = loadBaseline(baselinePath);
// Частичный прогон (`--only=...`) сверяется с базой наравне с полным: известное
// красное остаётся известным. Не судит он только об устаревших записях — разделы,
// которых он не считал, выглядели бы починенными.
const v = verdict(findings, baseline, updateBaseline ? undefined : baselineError, only);
for (const line of v.lines) console.log(line);
summary['findings'] = findings;
summary['baseline'] = {
  entries: baseline.known.length,
  fresh: v.comparison.fresh,
  // При частичном прогоне «устаревших» записей не бывает — есть несчитанные.
  stale: only ? [] : v.comparison.stale,
  ...(only ? { partial: only } : {}),
};

try {
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, 'latest.json'), JSON.stringify(summary, null, 2), 'utf8');
} catch {
  // отчёт — приятный бонус, не повод падать
}

// Прогон падает ТОЛЬКО на новом красном. Известное красное — не падение:
// иначе прибор третий месяц отвечает «красный» и перестаёт что-либо сообщать.
// Область прогона печатается в самом итоге: частичный зелёный — это зелёный
// одного раздела, и путать его с полным нельзя.
const scope = only ? ` — только раздел ${only}` : '';
head(v.exitCode === 0 ? `ИТОГ: зелёный${scope}` : `ИТОГ: КРАСНЫЙ (новое красное)${scope}`);
process.exit(v.exitCode);

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

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

