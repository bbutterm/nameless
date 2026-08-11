/**
 * База известного красного (`sim-baseline.json`).
 *
 * Идея из `docs/PLAN.md` §7: прибор, который краснеет всегда, не сообщает
 * ничего. Пока симулятор падал на четырнадцати строках лестницы ступеней и на
 * промежутке между боями в закладском корпусе, красный итог был фоном — и под
 * этим фоном спокойно жили ещё три настоящих дефекта, потому что «и так
 * красный». База разделяет два разных сообщения:
 *
 *   • известное красное — записано, названо словами, кем-то взято в работу;
 *     прогон его печатает и НЕ падает;
 *   • новое красное — то, чего в базе нет; прогон падает с ненулевым кодом;
 *   • красное, которого больше нет, — база устарела; прогон говорит об этом
 *     вслух и остаётся зелёным (чинить починенное не надо, но и врать базе
 *     нельзя: вычеркнуть запись — отдельное решение человека).
 *
 * Запись опознаётся ПАРОЙ `kind:id`, а не числом. Числа тут шумят: винрейт
 * ступени гуляет на пункт-другой от любой правки контента, и база, сверяющая
 * значения, устаревала бы каждую итерацию. Значение хранится справочно — чтобы
 * в отчёте было видно, куда поехало.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Классы замеров, которые умеют краснеть. Список закрытый нарочно: он же
 * проверяет базу на опечатки — запись `ladderGaen:smolokur:3` иначе молча
 * никогда бы ни с чем не совпала и вечно печаталась бы как «база устарела».
 */
export const FINDING_KINDS = [
  'content', // ошибка целостности контента
  'unitWinrate', // юнит вне коридора зеркального турнира
  'tournamentRounds', // средняя длина боя турнира вне коридора
  'storyBattle', // сюжетный бой вне коридора
  'storyMedian', // медиана по сюжетным боям вне коридора
  'ladderGain', // прибавка ступени умения вне допуска
  'ladderRounds', // длина боя на ступени вне коридора
  'ladderCorridor', // бои вне коридора при игроке с умением
  'emptyPower', // отклик сродственных платит больше допуска
  'emptyPowerStand', // стенд контроля не набрал сродственных: строка несравнима
  'noDecision', // доля ходов игрока без решения выше предела (docs/БОЙ_ЗАМЕРЫ.md, А)
  'determinism', // один сид дал два разных боя
  'pacing', // темп до первого боя
  'rhythm', // промежутки между боями
  'invisibleOption', // вариант диалога не попадает на экран никогда
  'deadEnd', // в узле выбора остаётся меньше двух вариантов
  'walkError', // проход по игре обрывается ошибкой
  'lineCoverage', // охват реплик ниже порога
  'plainwords', // канцелярский словарь сверх нормы (docs/ПЕРЕХОД.md §6)
] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

/** Одна красная строка прогона. */
export interface Finding {
  /** Класс замера: `ladderGain`, `rhythm`, `invisibleOption`, … */
  readonly kind: string;
  /** Что именно красное: id юнита, боя, жизни со ступенью, вариант диалога. */
  readonly id: string;
  /** Измеренное значение — справочно, в сверке не участвует. */
  readonly value?: number;
  /** Причина по-человечески: что не так и чем это грозит. */
  readonly note: string;
}

export interface Baseline {
  /** Пояснение к файлу целиком — для того, кто откроет его через полгода. */
  readonly note?: string;
  /** Когда снят слепок. */
  readonly measured?: string;
  readonly known: readonly Finding[];
}

export const EMPTY_BASELINE: Baseline = { known: [] };

export function findingKey(f: { kind: string; id: string }): string {
  return `${f.kind}:${f.id}`;
}

/**
 * Разбирает базу. Битый или отсутствующий файл — НЕ повод молча продолжить с
 * пустой базой: тогда любое известное красное станет «новым» и прогон упадёт,
 * а человек увидит причину. Поэтому ошибка возвращается, а не глотается.
 */
export function parseBaseline(text: string): { baseline: Baseline; error?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { baseline: EMPTY_BASELINE, error: `не разбирается как JSON: ${(e as Error).message}` };
  }
  if (!data || typeof data !== 'object') return { baseline: EMPTY_BASELINE, error: 'ожидался объект' };
  const raw = (data as { known?: unknown }).known;
  if (!Array.isArray(raw)) return { baseline: EMPTY_BASELINE, error: 'нет массива `known`' };
  const known: Finding[] = [];
  for (const [i, item] of raw.entries()) {
    const o = item as Partial<Finding>;
    if (!o || typeof o.kind !== 'string' || typeof o.id !== 'string' || typeof o.note !== 'string') {
      return { baseline: EMPTY_BASELINE, error: `запись ${i}: нужны строковые kind, id и note` };
    }
    if (o.note.trim() === '') {
      return { baseline: EMPTY_BASELINE, error: `запись ${i} (${o.kind}:${o.id}): пустая причина` };
    }
    if (!(FINDING_KINDS as readonly string[]).includes(o.kind)) {
      return {
        baseline: EMPTY_BASELINE,
        error: `запись ${i} (${o.kind}:${o.id}): неизвестный класс замера`,
      };
    }
    known.push({
      kind: o.kind,
      id: o.id,
      note: o.note,
      ...(typeof o.value === 'number' ? { value: o.value } : {}),
    });
  }
  const seen = new Set<string>();
  for (const k of known) {
    const key = findingKey(k);
    if (seen.has(key)) return { baseline: EMPTY_BASELINE, error: `запись ${key} объявлена дважды` };
    seen.add(key);
  }
  const note = (data as { note?: unknown }).note;
  const measured = (data as { measured?: unknown }).measured;
  return {
    baseline: {
      known,
      ...(typeof note === 'string' ? { note } : {}),
      ...(typeof measured === 'string' ? { measured } : {}),
    },
  };
}

export function loadBaseline(path: string): { baseline: Baseline; error?: string } {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { baseline: EMPTY_BASELINE, error: `файл ${path} не читается` };
  }
  return parseBaseline(text);
}

export interface Comparison {
  /** Красное, которого нет в базе. Из-за него прогон падает. */
  readonly fresh: Finding[];
  /** Красное, записанное в базу: печатается, но не роняет. */
  readonly known: { finding: Finding; entry: Finding }[];
  /** Записи базы, которые больше не краснеют: база устарела. */
  readonly stale: Finding[];
}

export function compareToBaseline(findings: readonly Finding[], baseline: Baseline): Comparison {
  const byKey = new Map(baseline.known.map((k) => [findingKey(k), k]));
  const fresh: Finding[] = [];
  const known: { finding: Finding; entry: Finding }[] = [];
  const hit = new Set<string>();
  for (const f of findings) {
    const key = findingKey(f);
    const entry = byKey.get(key);
    if (entry) {
      hit.add(key);
      known.push({ finding: f, entry });
    } else {
      fresh.push(f);
    }
  }
  const stale = baseline.known.filter((k) => !hit.has(findingKey(k)));
  return { fresh, known, stale };
}

function delta(entry: Finding, finding: Finding): string {
  if (typeof entry.value !== 'number' || typeof finding.value !== 'number') return '';
  if (entry.value === finding.value) return ` (${fmt(finding.value)}, как в базе)`;
  return ` (в базе ${fmt(entry.value)}, сейчас ${fmt(finding.value)})`;
}

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export interface Verdict {
  readonly exitCode: number;
  readonly lines: string[];
  readonly comparison: Comparison;
}

/**
 * Вердикт прогона. Один и тот же код зовут и `cli.ts`, и тесты — иначе
 * «прибор падает на новом красном» проверялся бы не тем кодом, который живёт.
 */
export function verdict(
  findings: readonly Finding[],
  baseline: Baseline,
  baselineError?: string,
): Verdict {
  const comparison = compareToBaseline(findings, baseline);
  const lines: string[] = [];
  if (baselineError) {
    lines.push(`!! база известного красного не прочитана: ${baselineError}`);
    lines.push('   всё красное считается новым — почини файл или сними базу заново');
  }
  lines.push(
    `красных строк ${findings.length}: известных ${comparison.known.length}, ` +
      `новых ${comparison.fresh.length}; записей в базе ${baseline.known.length}`,
  );
  for (const { finding, entry } of comparison.known) {
    lines.push(`   известное ${findingKey(finding)}${delta(entry, finding)} — ${entry.note}`);
  }
  for (const s of comparison.stale) {
    lines.push(`   база устарела: ${findingKey(s)} больше не красный — ${s.note}`);
  }
  for (const f of comparison.fresh) {
    lines.push(
      `!! НОВОЕ КРАСНОЕ ${findingKey(f)}${typeof f.value === 'number' ? ` (${fmt(f.value)})` : ''} — ${f.note}`,
    );
  }
  const exitCode = comparison.fresh.length > 0 || baselineError ? 1 : 0;
  return { exitCode, lines, comparison };
}

/** Снять базу заново по текущему прогону (`pnpm sim --update-baseline`). */
export function writeBaseline(path: string, findings: readonly Finding[], note: string): void {
  const known = [...findings].sort((a, b) => findingKey(a).localeCompare(findingKey(b)));
  const body: Baseline = { note, measured: new Date().toISOString().slice(0, 10), known };
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}
