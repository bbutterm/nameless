import type { ContentBundle, Condition, Effect, Scene } from '@nameless/engine';
import { collectRefs, emptyRefs } from '@nameless/engine';
import { zBundle } from './schema.js';

export interface Issue {
  level: 'error' | 'warn';
  where: string;
  message: string;
}

/** Собирает id, которые эффект ПИШЕТ — чтобы поймать сирот-флагов. */
function effectWrites(effects: Effect[] | undefined, out: ReturnType<typeof emptyRefs>): void {
  for (const e of effects ?? []) {
    switch (e.kind) {
      case 'axis':
        out.axes.add(e.axis);
        break;
      case 'flag':
        out.flags.add(e.flag);
        break;
      case 'counter':
        out.counters.add(e.counter);
        break;
      case 'fragment':
        out.memories.add(e.memory);
        break;
      case 'awakenLife':
        out.lives.add(e.life);
        break;
      case 'recruit':
      case 'dismiss':
        out.units.add(e.unit);
        break;
      case 'heal':
      case 'xp':
        if (e.unit) out.units.add(e.unit);
        break;
      default:
        break;
    }
  }
}

function sceneTargets(scene: Scene): { node: string; to: string }[] {
  const out: { node: string; to: string }[] = [];
  for (const n of scene.nodes) {
    switch (n.kind) {
      case 'say':
      case 'narration':
      case 'lore':
      case 'effects':
        out.push({ node: n.id, to: n.next });
        break;
      case 'choice':
        for (const o of n.options) out.push({ node: `${n.id}/${o.id}`, to: o.to });
        break;
      case 'branch':
        for (const b of n.branches) out.push({ node: n.id, to: b.to });
        out.push({ node: n.id, to: n.fallback });
        break;
      case 'battle':
        out.push({ node: n.id, to: n.onWin });
        out.push({ node: n.id, to: n.onLose });
        break;
      case 'death':
        if (n.next) out.push({ node: n.id, to: n.next });
        break;
      case 'end':
        break;
      default:
        break;
    }
  }
  return out;
}

/** Эффекты, дающие юнита в отряд, — для проверки «юнита нельзя получить». */
function noteRecruits(effects: Effect[] | undefined, out: Set<string>): void {
  for (const e of effects ?? []) {
    if (e.kind === 'recruit') out.add(e.unit);
  }
}

/**
 * Сколько осколков каждого воспоминания вообще существует в игре. Меньше
 * `cost` — воспоминание не закрепить никаким прохождением.
 */
function noteFragments(effects: Effect[] | undefined, out: Map<string, number>): void {
  for (const e of effects ?? []) {
    if (e.kind === 'fragment') out.set(e.memory, (out.get(e.memory) ?? 0) + (e.amount ?? 1));
  }
}

/** Эффекты, которые записаны, но не делают ничего. */
function noteNoOps(where: string, effects: Effect[] | undefined, issues: Issue[]): void {
  for (const e of effects ?? []) {
    if (e.kind === 'heal' && e.amount <= 0) {
      issues.push({
        level: 'warn',
        where,
        message: `heal с amount=${e.amount} ничего не делает: лечение никогда не снижает hp`,
      });
    }
    if (e.kind === 'fragment' && (e.amount ?? 1) <= 0) {
      issues.push({
        level: 'warn',
        where,
        message: `fragment с amount=${e.amount} не приближает воспоминание к закреплению`,
      });
    }
    if (e.kind === 'xp' && e.amount < 0) {
      issues.push({ level: 'warn', where, message: `xp с amount=${e.amount} отнимает опыт — уровень пересчитается вниз` });
    }
  }
}

/**
 * Условие, которое не выполнится НИ ПРИ КАКОМ состоянии: never в цепочке all,
 * сравнение оси за пределами [-100, 100] и т.п. Такой вариант/ветка — мёртвый текст.
 */
function staticallyImpossible(cond: Condition | undefined): boolean {
  if (!cond) return false;
  switch (cond.kind) {
    case 'never':
      return true;
    case 'all':
      return cond.of.some((c) => staticallyImpossible(c));
    case 'any':
      return cond.of.every((c) => staticallyImpossible(c));
    case 'not':
      return staticallyAlways(cond.of);
    case 'axis':
      // Оси зажаты clampAxis в [-100, 100].
      return (
        (cond.op === 'gt' && cond.value >= 100) ||
        (cond.op === 'gte' && cond.value > 100) ||
        (cond.op === 'lt' && cond.value <= -100) ||
        (cond.op === 'lte' && cond.value < -100) ||
        (cond.op === 'eq' && Math.abs(cond.value) > 100)
      );
    default:
      return false;
  }
}

/** Условие, которое выполняется всегда — зеркало для not(...). */
function staticallyAlways(cond: Condition): boolean {
  switch (cond.kind) {
    case 'always':
      return true;
    case 'all':
      return cond.of.every((c) => staticallyAlways(c));
    case 'any':
      return cond.of.some((c) => staticallyAlways(c));
    case 'not':
      return staticallyImpossible(cond.of);
    case 'axis':
      return (
        (cond.op === 'gte' && cond.value <= -100) ||
        (cond.op === 'lte' && cond.value >= 100) ||
        (cond.op === 'gt' && cond.value < -100) ||
        (cond.op === 'lt' && cond.value > 100)
      );
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Противоречие между условием перехода и `available` целевой сцены
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Разбирает условие в список конъюнктов (то, что обязано выполняться разом).
 * `any`/`not` дальше не раскладываются — проверка сознательно консервативна:
 * лучше промолчать, чем выдать ложное предупреждение сценаристу.
 */
function conjuncts(cond: Condition | undefined): Condition[] {
  if (!cond) return [];
  if (cond.kind === 'all') return cond.of.flatMap((c) => conjuncts(c));
  return [cond];
}

/** Числовое условие → ключ, по которому его можно сравнивать с другим. */
function numericKey(c: Condition): string | undefined {
  switch (c.kind) {
    case 'axis':
      return `axis:${c.axis}`;
    case 'counter':
      return `counter:${c.counter}`;
    case 'deaths':
      return 'deaths';
    case 'chapter':
      return 'chapter';
    case 'partySize':
      return 'partySize';
    default:
      return undefined;
  }
}

interface Interval {
  lo: number;
  hi: number;
}

/**
 * Пересечение числовых ограничений. Все сравниваемые величины целые
 * (оси округляются clampAxis, остальное — счётчики и размеры), поэтому
 * `gt v` честно превращается в `>= v+1`.
 */
function narrow(iv: Interval, c: Condition & { op: string; value: number }): Interval {
  switch (c.op) {
    case 'gte':
      return { lo: Math.max(iv.lo, c.value), hi: iv.hi };
    case 'gt':
      return { lo: Math.max(iv.lo, c.value + 1), hi: iv.hi };
    case 'lte':
      return { lo: iv.lo, hi: Math.min(iv.hi, c.value) };
    case 'lt':
      return { lo: iv.lo, hi: Math.min(iv.hi, c.value - 1) };
    case 'eq':
      return { lo: Math.max(iv.lo, c.value), hi: Math.min(iv.hi, c.value) };
    default:
      return iv;
  }
}

/**
 * Могут ли два набора условий выполниться ОДНОВРЕМЕННО? `false` — только когда
 * противоречие доказано: конфликт по флагу или пустой числовой интервал.
 */
function jointlyImpossible(a: Condition[], b: Condition[]): string | undefined {
  const all = [...a, ...b];

  const flagWanted = new Map<string, boolean>();
  for (const c of all) {
    if (c.kind !== 'flag') continue;
    const want = c.value ?? true;
    const prev = flagWanted.get(c.flag);
    if (prev !== undefined && prev !== want) return `флаг «${c.flag}» требуется и true, и false`;
    flagWanted.set(c.flag, want);
  }

  const ranges = new Map<string, Interval>();
  for (const c of all) {
    const key = numericKey(c);
    if (!key) continue;
    const start = ranges.get(key) ?? {
      lo: key.startsWith('axis:') ? -100 : Number.NEGATIVE_INFINITY,
      hi: key.startsWith('axis:') ? 100 : Number.POSITIVE_INFINITY,
    };
    const next = narrow(start, c as Condition & { op: string; value: number });
    if (next.lo > next.hi) return `${key} не может быть одновременно ≥${next.lo} и ≤${next.hi}`;
    ranges.set(key, next);
  }

  // never на любой стороне — противоречие само по себе (ловится и отдельно).
  if (all.some((c) => c.kind === 'never')) return 'условие содержит never';
  return undefined;
}

/**
 * Условия перехода за вычетом того, что сам переход переписывает: вариант
 * вида «показывать, пока флага нет» → «поставить флаг» → «уйти в сцену,
 * которая флага требует» абсолютно законен, и путать его с противоречием
 * нельзя.
 */
function conditionsAtArrival(cond: Condition | undefined, effects: Effect[] | undefined): Condition[] {
  const written = new Set<string>();
  const setFlags: Condition[] = [];
  for (const e of effects ?? []) {
    if (e.kind === 'flag') {
      written.add(`flag:${e.flag}`);
      setFlags.push({ kind: 'flag', flag: e.flag, value: e.value });
    }
    if (e.kind === 'axis') written.add(`axis:${e.axis}`);
    if (e.kind === 'counter') written.add(`counter:${e.counter}`);
    if (e.kind === 'recruit' || e.kind === 'dismiss') written.add('partySize');
  }
  const kept = conjuncts(cond).filter((c) => {
    if (c.kind === 'flag') return !written.has(`flag:${c.flag}`);
    if (c.kind === 'axis') return !written.has(`axis:${c.axis}`);
    if (c.kind === 'counter') return !written.has(`counter:${c.counter}`);
    if (c.kind === 'partySize') return !written.has('partySize');
    return true;
  });
  return [...kept, ...setFlags];
}

/**
 * Ссылочная целостность: битые переходы, неизвестные id, недостижимые узлы,
 * флаги, которые читают, но никогда не пишут.
 */
export function validateBundle(bundle: ContentBundle): Issue[] {
  const issues: Issue[] = [];

  const parsed = zBundle.safeParse(bundle);
  if (!parsed.success) {
    for (const e of parsed.error.errors) {
      issues.push({ level: 'error', where: e.path.join('.') || 'bundle', message: e.message });
    }
  }

  const sceneIds = new Set(bundle.scenes.map((s) => s.id));
  const unitIds = new Set(bundle.units.map((u) => u.id));
  const abilityIds = new Set(bundle.abilities.map((a) => a.id));
  const battleIds = new Set(bundle.battles.map((b) => b.id));
  const memoryIds = new Set(bundle.memories.map((m) => m.id));
  const lifeIds = new Set(bundle.lives.map((l) => l.id));
  const deathIds = new Set(bundle.deaths.map((d) => d.id));
  const axisIds = new Set(bundle.axes.map((a) => a.id));
  const speakerIds = new Set(bundle.speakers.map((s) => s.id));

  const dup = (name: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push({ level: 'error', where: name, message: `Дубликат id: ${id}` });
      seen.add(id);
    }
  };
  dup('scenes', bundle.scenes.map((s) => s.id));
  dup('units', bundle.units.map((u) => u.id));
  dup('abilities', bundle.abilities.map((a) => a.id));
  dup('memories', bundle.memories.map((m) => m.id));
  // Контент пишут несколько агентов параллельно — дубликаты возможны в любом реестре.
  dup('battles', bundle.battles.map((b) => b.id));
  dup('lives', bundle.lives.map((l) => l.id));
  dup('deaths', bundle.deaths.map((d) => d.id));
  dup('chapters', bundle.chapters.map((c) => c.id));
  dup('axes', bundle.axes.map((a) => a.id));
  dup('speakers', bundle.speakers.map((s) => s.id));
  dup('codex', bundle.codex.map((e) => e.id));

  const reads = emptyRefs();
  const writes = emptyRefs();
  /** Юниты, которых игрок может получить recruit-эффектом. */
  const recruitTargets = new Set<string>();
  /** Сколько осколков каждого воспоминания существует во всём контенте. */
  const fragmentTotals = new Map<string, number>();

  // Узлы, на которые ссылаются из других сцен через "scene:id#node", —
  // законные точки входа: без этого учёта они ложно значились бы недостижимыми.
  const externalEntryNodes = new Map<string, Set<string>>();
  for (const s of bundle.scenes) {
    for (const { to } of sceneTargets(s)) {
      if (!to.startsWith('scene:')) continue;
      const rest = to.slice(6);
      const hash = rest.indexOf('#');
      if (hash === -1) continue;
      const sid = rest.slice(0, hash);
      const nid = rest.slice(hash + 1);
      const set = externalEntryNodes.get(sid) ?? new Set<string>();
      set.add(nid);
      externalEntryNodes.set(sid, set);
    }
  }

  for (const scene of bundle.scenes) {
    const nodeIds = new Set(scene.nodes.map((n) => n.id));
    if (!nodeIds.has(scene.entry)) {
      issues.push({
        level: 'error',
        where: scene.id,
        message: `entry «${scene.entry}» не найден среди узлов`,
      });
    }

    for (const { node, to } of sceneTargets(scene)) {
      if (to.startsWith('scene:')) {
        const rest = to.slice(6);
        const [sid, nid] = rest.split('#');
        if (!sid || !sceneIds.has(sid)) {
          issues.push({ level: 'error', where: `${scene.id}#${node}`, message: `Нет сцены «${sid}»` });
        } else if (nid) {
          const target = bundle.scenes.find((s) => s.id === sid);
          if (target && !target.nodes.some((n) => n.id === nid)) {
            issues.push({
              level: 'error',
              where: `${scene.id}#${node}`,
              message: `Нет узла «${nid}» в сцене «${sid}»`,
            });
          }
        }
      } else if (!nodeIds.has(to)) {
        issues.push({
          level: 'error',
          where: `${scene.id}#${node}`,
          message: `Переход в несуществующий узел «${to}»`,
        });
      }
    }

    // Достижимость внутри сцены: от entry и от узлов, в которые ведут
    // переходы "scene:id#node" из других сцен.
    const seeds = [scene.entry, ...(externalEntryNodes.get(scene.id) ?? [])].filter((n) =>
      nodeIds.has(n),
    );
    const reachable = new Set<string>(seeds);
    const queue = [...seeds];
    const targets = sceneTargets(scene);
    while (queue.length) {
      const cur = queue.shift() as string;
      for (const { node, to } of targets) {
        if (node !== cur && !node.startsWith(`${cur}/`)) continue;
        if (to.startsWith('scene:')) continue;
        if (!reachable.has(to) && nodeIds.has(to)) {
          reachable.add(to);
          queue.push(to);
        }
      }
    }
    for (const n of scene.nodes) {
      if (!reachable.has(n.id)) {
        issues.push({
          level: 'warn',
          where: `${scene.id}#${n.id}`,
          message: 'Узел недостижим из entry сцены',
        });
      }
    }

    for (const n of scene.nodes) {
      if (n.kind === 'say' && !speakerIds.has(n.speaker)) {
        issues.push({ level: 'warn', where: `${scene.id}#${n.id}`, message: `Неизвестный говорящий «${n.speaker}»` });
      }
      if (n.kind === 'battle' && !battleIds.has(n.battle)) {
        issues.push({ level: 'error', where: `${scene.id}#${n.id}`, message: `Нет боя «${n.battle}»` });
      }
      if (n.kind === 'death' && !deathIds.has(n.death)) {
        issues.push({ level: 'error', where: `${scene.id}#${n.id}`, message: `Нет смерти «${n.death}»` });
      }
      if (n.kind === 'effects') {
        effectWrites(n.effects, writes);
        noteRecruits(n.effects, recruitTargets);
        noteFragments(n.effects, fragmentTotals);
        noteNoOps(`${scene.id}#${n.id}`, n.effects, issues);
      }
      if (n.kind === 'branch') {
        n.branches.forEach((b) => collectRefs(b.when as Condition, reads));
        for (const b of n.branches) {
          if (staticallyImpossible(b.when as Condition)) {
            issues.push({
              level: 'warn',
              where: `${scene.id}#${n.id}`,
              message: `Ветка «${b.to}» не сработает никогда: условие статически невыполнимо`,
            });
          }
        }
      }
      if (n.kind === 'choice') {
        const ids = new Set<string>();
        for (const o of n.options) {
          if (ids.has(o.id)) {
            issues.push({ level: 'error', where: `${scene.id}#${n.id}`, message: `Дубликат id варианта «${o.id}»` });
          }
          ids.add(o.id);
          collectRefs(o.conditions as Condition | undefined, reads);
          effectWrites(o.effects, writes);
          noteRecruits(o.effects, recruitTargets);
          noteFragments(o.effects, fragmentTotals);
          noteNoOps(`${scene.id}#${n.id}/${o.id}`, o.effects, issues);
          if (!o.fallback && staticallyImpossible(o.conditions as Condition | undefined)) {
            issues.push({
              level: 'warn',
              where: `${scene.id}#${n.id}/${o.id}`,
              message: 'Вариант не покажется никогда: условие статически невыполнимо',
            });
          }
        }
        const unconditional = n.options.filter((o) => !o.conditions || o.fallback).length;
        if (unconditional < 2) {
          issues.push({
            level: 'warn',
            where: `${scene.id}#${n.id}`,
            message: `Безусловных/страховочных вариантов: ${unconditional}. Нужно ≥2, иначе всё держится на фаззере`,
          });
        }
      }
    }

    // Правило «≤15 пузырей до выбора».
    const bubbleRun = longestBubbleRun(scene);
    if (bubbleRun > 15) {
      issues.push({
        level: 'warn',
        where: scene.id,
        message: `${bubbleRun} пузырей подряд без выбора (максимум 15)`,
      });
    }
    if (scene.available) {
      collectRefs(scene.available as Condition, reads);
      if (staticallyImpossible(scene.available as Condition)) {
        issues.push({
          level: 'warn',
          where: scene.id,
          message: 'available статически невыполнимо: сцена не откроется никогда',
        });
      }
    }
  }

  for (const u of bundle.units) {
    for (const a of u.abilities) {
      if (!abilityIds.has(a)) {
        issues.push({ level: 'error', where: `unit:${u.id}`, message: `Нет способности «${a}»` });
      }
    }
    if (u.evolvesTo && !unitIds.has(u.evolvesTo)) {
      issues.push({ level: 'error', where: `unit:${u.id}`, message: `Эволюция в неизвестного «${u.evolvesTo}»` });
    }
    if (u.recruitable) collectRefs(u.recruitable as Condition, reads);
  }

  for (const b of bundle.battles) {
    for (const e of b.enemies) {
      if (!unitIds.has(e.unit)) {
        issues.push({ level: 'error', where: `battle:${b.id}`, message: `Нет юнита «${e.unit}»` });
      }
    }
    const slots = new Set(b.enemies.map((e) => `${e.row}:${e.index}`));
    if (slots.size !== b.enemies.length) {
      issues.push({ level: 'error', where: `battle:${b.id}`, message: 'Два врага в одной клетке' });
    }
    effectWrites(b.rewards, writes);
    noteRecruits(b.rewards, recruitTargets);
    noteFragments(b.rewards, fragmentTotals);
    noteNoOps(`battle:${b.id}`, b.rewards, issues);
  }

  const lifeByMemory = new Map<string, string[]>();
  for (const l of bundle.lives) {
    for (const m of l.memories) {
      lifeByMemory.set(m, [...(lifeByMemory.get(m) ?? []), l.id]);
    }
  }
  for (const m of bundle.memories) {
    if (!lifeIds.has(m.life)) {
      issues.push({ level: 'error', where: `memory:${m.id}`, message: `Нет жизни «${m.life}»` });
    } else if (!(lifeByMemory.get(m.id) ?? []).includes(m.life)) {
      // Жизнь есть, но её мозаика не знает об этом воспоминании: прогресс
      // жизни и её пробуждение это воспоминание не учтут.
      issues.push({
        level: 'warn',
        where: `memory:${m.id}`,
        message: `Воспоминание не входит в memories своей жизни «${m.life}»`,
      });
    }
    effectWrites(m.grants, writes);
    noteRecruits(m.grants, recruitTargets);
    noteFragments(m.grants, fragmentTotals);
    noteNoOps(`memory:${m.id}`, m.grants, issues);
  }
  for (const l of bundle.lives) {
    if (!axisIds.has(l.axis)) {
      issues.push({ level: 'error', where: `life:${l.id}`, message: `Нет оси «${l.axis}»` });
    }
    for (const m of l.memories) {
      if (!memoryIds.has(m)) {
        issues.push({ level: 'error', where: `life:${l.id}`, message: `Нет воспоминания «${m}»` });
      }
    }
    effectWrites(l.grants, writes);
    noteRecruits(l.grants, recruitTargets);
    noteFragments(l.grants, fragmentTotals);
    noteNoOps(`life:${l.id}`, l.grants, issues);
  }
  for (const d of bundle.deaths) {
    if (!sceneIds.has(d.wakeScene)) {
      issues.push({ level: 'error', where: `death:${d.id}`, message: `Нет сцены пробуждения «${d.wakeScene}»` });
    }
  }
  for (const c of bundle.chapters) {
    if (!sceneIds.has(c.entryScene)) {
      issues.push({ level: 'error', where: `chapter:${c.id}`, message: `Нет стартовой сцены «${c.entryScene}»` });
    }
  }

  // ── Помянник (CODEX §2, §9) ────────────────────────────────────────────────
  const codexLineIds = new Set<string>();
  for (const entry of bundle.codex) {
    const where = `codex:${entry.id}`;
    if (entry.kind === 'person' && !speakerIds.has(entry.id)) {
      issues.push({
        level: 'error',
        where,
        message: `Запись Помянника «${entry.id}» (person) не найдена среди говорящих в speakers.json`,
      });
    }
    if (entry.kind === 'life' && !lifeIds.has(entry.id)) {
      issues.push({
        level: 'error',
        where,
        message: `Запись Помянника «${entry.id}» (life) не найдена среди прошлых жизней`,
      });
    }
    if (entry.lines.length < 1 || entry.lines.length > 6) {
      issues.push({
        level: 'error',
        where,
        message: `В записи ${entry.lines.length} строк — по CODEX §2 допустимо от 1 до 6`,
      });
    }
    const lastCount = entry.lines.filter((l) => l.source === 'last').length;
    if (lastCount > 1) {
      issues.push({
        level: 'error',
        where,
        message: `В записи ${lastCount} строк с source «last» — последняя строка на запись только одна`,
      });
    }
    for (const line of entry.lines) {
      const lineWhere = `${where}#${line.id}`;
      if (codexLineIds.has(line.id)) {
        issues.push({ level: 'error', where: lineWhere, message: `Дубликат id строки Помянника: «${line.id}»` });
      }
      codexLineIds.add(line.id);
      const unlock = line.unlock;
      switch (unlock.kind) {
        case 'meet':
        case 'player_death_with':
          if (!speakerIds.has(unlock.speaker)) {
            issues.push({
              level: 'error',
              where: lineWhere,
              message: `unlock ссылается на несуществующего говорящего «${unlock.speaker}»`,
            });
          }
          break;
        case 'node': {
          const targetScene = bundle.scenes.find((s) => s.id === unlock.scene);
          if (!targetScene) {
            issues.push({
              level: 'error',
              where: lineWhere,
              message: `unlock ссылается на несуществующую сцену «${unlock.scene}»`,
            });
          } else if (!targetScene.nodes.some((n) => n.id === unlock.node)) {
            issues.push({
              level: 'error',
              where: lineWhere,
              message: `unlock ссылается на несуществующий узел «${unlock.node}» в сцене «${unlock.scene}»`,
            });
          }
          break;
        }
        case 'memory':
          if (!memoryIds.has(unlock.memory)) {
            issues.push({
              level: 'error',
              where: lineWhere,
              message: `unlock ссылается на несуществующее воспоминание «${unlock.memory}»`,
            });
          }
          break;
        case 'flag':
          // Флаги мира свободные строки — существование не проверяется, как и в Condition.
          break;
        default:
          break;
      }
    }
  }

  // Сироты: читаем то, чего никто не пишет.
  for (const f of reads.flags) {
    if (!writes.flags.has(f)) {
      issues.push({ level: 'warn', where: 'flags', message: `Флаг «${f}» проверяется, но нигде не ставится` });
    }
  }
  for (const c of reads.counters) {
    if (!writes.counters.has(c)) {
      issues.push({ level: 'warn', where: 'counters', message: `Счётчик «${c}» проверяется, но нигде не меняется` });
    }
  }
  for (const a of reads.axes) {
    if (!axisIds.has(a)) {
      issues.push({ level: 'error', where: 'axes', message: `Неизвестная ось «${a}» в условии` });
    }
  }
  for (const m of reads.memories) {
    if (!memoryIds.has(m)) {
      issues.push({ level: 'error', where: 'memories', message: `Неизвестное воспоминание «${m}» в условии` });
    }
  }
  for (const l of reads.lives) {
    if (!lifeIds.has(l)) {
      issues.push({ level: 'error', where: 'lives', message: `Неизвестная жизнь «${l}» в условии` });
    }
  }
  for (const u of reads.units) {
    if (!unitIds.has(u)) {
      issues.push({ level: 'error', where: 'units', message: `Неизвестный юнит «${u}» в условии` });
    }
  }
  for (const m of writes.memories) {
    if (!memoryIds.has(m)) {
      issues.push({ level: 'error', where: 'memories', message: `Осколок неизвестного воспоминания «${m}»` });
    }
  }
  // Эффекты тоже обязаны ссылаться на существующие id — раньше проверялись только условия.
  for (const u of writes.units) {
    if (!unitIds.has(u)) {
      issues.push({ level: 'error', where: 'units', message: `Эффект ссылается на неизвестного юнита «${u}»` });
    }
  }
  for (const l of writes.lives) {
    if (!lifeIds.has(l)) {
      issues.push({ level: 'error', where: 'lives', message: `awakenLife неизвестной жизни «${l}»` });
    }
  }
  for (const a of writes.axes) {
    if (!axisIds.has(a)) {
      issues.push({ level: 'error', where: 'axes', message: `Эффект двигает неизвестную ось «${a}»` });
    }
  }
  for (const s of reads.scenes) {
    if (!sceneIds.has(s)) {
      issues.push({ level: 'error', where: 'scenes', message: `Условие visited ссылается на неизвестную сцену «${s}»` });
    }
  }

  // Воспоминание, которому ни один эффект не даёт осколков, закрепить нельзя.
  // Мало и того, что осколки есть: их должно хватать на cost, иначе
  // воспоминание — мёртвый контент, недостижимый ни одной жизнью игрока.
  for (const m of bundle.memories) {
    const total = fragmentTotals.get(m.id) ?? 0;
    if (total === 0) {
      issues.push({
        level: 'warn',
        where: `memory:${m.id}`,
        message: 'Осколков не даёт ни один эффект — воспоминание не закрепить',
      });
    } else if (total < m.cost) {
      issues.push({
        level: 'warn',
        where: `memory:${m.id}`,
        message: `Осколков во всей игре ${total}, а нужно ${m.cost} — воспоминание не закрепить ни одной жизнью`,
      });
    }
  }

  // Юнит, которого не даёт ни recruit, ни эволюция, и который не стоит врагом
  // ни в одном бою, — мёртвый контент.
  const enemyUnits = new Set<string>();
  for (const b of bundle.battles) for (const e of b.enemies) enemyUnits.add(e.unit);
  const evolveTargets = new Set<string>();
  for (const u of bundle.units) if (u.evolvesTo) evolveTargets.add(u.evolvesTo);
  for (const u of bundle.units) {
    if (!recruitTargets.has(u.id) && !evolveTargets.has(u.id) && !enemyUnits.has(u.id)) {
      issues.push({
        level: 'warn',
        where: `unit:${u.id}`,
        message: 'Юнита нельзя получить: нет recruit-эффекта, эволюции в него и боя с ним',
      });
    }
  }

  // Способность, не привязанная ни к одному юниту, никогда не попадёт в бой.
  const usedAbilities = new Set<string>();
  for (const u of bundle.units) for (const a of u.abilities) usedAbilities.add(a);
  for (const a of bundle.abilities) {
    if (!usedAbilities.has(a.id)) {
      issues.push({ level: 'warn', where: `ability:${a.id}`, message: 'Способность не привязана ни к одному юниту' });
    }
  }

  // Эволюция без порога (и наоборот) молча не срабатывает.
  for (const u of bundle.units) {
    if (!!u.evolvesTo !== (u.evolveAt !== undefined)) {
      issues.push({
        level: 'warn',
        where: `unit:${u.id}`,
        message: 'evolvesTo и evolveAt должны идти парой — иначе эволюция не сработает',
      });
    }
  }

  // Кросс-сценный охват: сцены, в которые никто не ведёт.
  const linkedScenes = new Set<string>(bundle.chapters.map((c) => c.entryScene));
  for (const d of bundle.deaths) linkedScenes.add(d.wakeScene);
  for (const s of bundle.scenes) {
    for (const { to } of sceneTargets(s)) {
      if (to.startsWith('scene:')) linkedScenes.add(to.slice(6).split('#')[0] as string);
    }
  }
  for (const s of bundle.scenes) {
    if (!linkedScenes.has(s.id)) {
      issues.push({ level: 'warn', where: `scene:${s.id}`, message: 'В сцену не ведёт ни один переход' });
    }
  }

  // ── Достижимость по-настоящему ────────────────────────────────────────────
  // Проверка выше признаёт сцену «связанной», если на неё хоть кто-то
  // ссылается — даже если сам ссылающийся недостижим, и даже если это
  // wakeScene смерти, до которой игрок никогда не доходит. Здесь честный обход
  // от entry глав: рёбра — переходы `scene:` и пробуждения ТЕХ смертей,
  // до чьих узлов игрок добирается.
  const sceneById = new Map(bundle.scenes.map((s) => [s.id, s]));
  const deathById = new Map(bundle.deaths.map((d) => [d.id, d]));
  const reachedScenes = new Set<string>();
  const reachedDeaths = new Set<string>();
  const reachedBattles = new Set<string>();
  const walk: string[] = [];
  const visit = (id: string): void => {
    if (!reachedScenes.has(id)) {
      reachedScenes.add(id);
      walk.push(id);
    }
  };
  // Стартуем ТОЛЬКО с первой главы. Раньше корнями обхода были entry всех глав
  // сразу — и это скрывало худший из возможных дефектов контента: глава 3 не
  // имела ни одного входящего перехода из главы 2, но числилась достижимой,
  // потому что была сама себе корнем. Игра собиралась, валидатор молчал,
  // фаззер показывал 97.9% охвата — а треть игры доехать было нельзя.
  // Игрок начинает новую игру с первой главы; всё остальное он обязан достичь.
  const orderedChapters = [...bundle.chapters].sort((a, b) => a.index - b.index);
  const firstChapter = orderedChapters[0];
  const drain = (): void => {
    while (walk.length > 0) {
      const sid = walk.shift() as string;
      const scene = sceneById.get(sid);
      if (!scene) continue;
      for (const { to } of sceneTargets(scene)) {
        if (to.startsWith('scene:')) visit(to.slice(6).split('#')[0] as string);
      }
      for (const n of scene.nodes) {
        if (n.kind === 'battle') reachedBattles.add(n.battle);
        if (n.kind === 'death') {
          reachedDeaths.add(n.death);
          const d = deathById.get(n.death);
          if (d) visit(d.wakeScene);
        }
      }
    }
  };

  if (firstChapter) visit(firstChapter.entryScene);
  drain();

  // Каждая следующая глава обязана достигаться из предыдущих. Это ошибка,
  // а не предупреждение: непройденная глава — это не «мёртвый узел где-то
  // сбоку», это отсутствующая треть игры.
  for (const c of orderedChapters.slice(1)) {
    if (reachedScenes.has(c.entryScene)) continue;
    issues.push({
      level: 'error',
      where: `chapter:${c.id}`,
      message: `Стартовая сцена главы «${c.entryScene}» недостижима из предыдущих глав: в неё не ведёт ни один переход`,
    });
    // Дальше считаем главу открытой — иначе одна оборванная связка выдала бы
    // ещё и лавину «сцена недостижима» на весь её текст, и настоящую причину
    // пришлось бы искать в сотне строк отчёта.
    visit(c.entryScene);
    drain();
  }

  for (const s of bundle.scenes) {
    if (linkedScenes.has(s.id) && !reachedScenes.has(s.id)) {
      issues.push({
        level: 'warn',
        where: `scene:${s.id}`,
        message: 'Сцена недостижима от entry ни одной главы: ссылки на неё есть, пути нет',
      });
    }
  }

  // Бой, до которого игрок не дойдёт, — мёртвый контент: его никто не тестирует
  // и не балансирует, а симулятор всё равно считает по нему цифры.
  const battleNodes = new Set<string>();
  for (const s of bundle.scenes) for (const n of s.nodes) if (n.kind === 'battle') battleNodes.add(n.battle);
  for (const b of bundle.battles) {
    if (!battleNodes.has(b.id)) {
      issues.push({ level: 'warn', where: `battle:${b.id}`, message: 'На бой не ссылается ни один узел battle' });
    } else if (!reachedBattles.has(b.id)) {
      issues.push({
        level: 'warn',
        where: `battle:${b.id}`,
        message: 'Узел с этим боем есть, но лежит в недостижимой сцене',
      });
    }
  }

  // Смерть без узла — это ещё и недостижимая сцена пробуждения: игрок
  // никогда не увидит ни текст смерти, ни то, что за ней написано.
  const deathNodes = new Set<string>();
  for (const s of bundle.scenes) for (const n of s.nodes) if (n.kind === 'death') deathNodes.add(n.death);
  for (const d of bundle.deaths) {
    if (!deathNodes.has(d.id)) {
      issues.push({
        level: 'warn',
        where: `death:${d.id}`,
        message: `На смерть не ссылается ни один узел death — сцена пробуждения «${d.wakeScene}» недостижима через неё`,
      });
    } else if (!reachedDeaths.has(d.id)) {
      issues.push({
        level: 'warn',
        where: `death:${d.id}`,
        message: 'Узел этой смерти лежит в недостижимой сцене',
      });
    }
  }

  // ── available против условия перехода ─────────────────────────────────────
  // Хаб предлагает вариант, а сцена на том конце отказывается открываться:
  // игрок жмёт кнопку и не попадает никуда. Ловим только доказанные
  // противоречия (флаг требуется и true и false, пустой числовой интервал).
  for (const scene of bundle.scenes) {
    for (const n of scene.nodes) {
      const links: { where: string; cond: Condition | undefined; effects: Effect[] | undefined; to: string }[] = [];
      if (n.kind === 'choice') {
        for (const o of n.options) {
          links.push({ where: `${scene.id}#${n.id}/${o.id}`, cond: o.conditions as Condition | undefined, effects: o.effects, to: o.to });
        }
      }
      if (n.kind === 'branch') {
        for (const b of n.branches) {
          links.push({ where: `${scene.id}#${n.id}`, cond: b.when as Condition, effects: undefined, to: b.to });
        }
      }
      for (const link of links) {
        if (!link.to.startsWith('scene:')) continue;
        const targetId = link.to.slice(6).split('#')[0] as string;
        if (targetId === scene.id) continue;
        const target = sceneById.get(targetId);
        if (!target?.available) continue;
        const clash = jointlyImpossible(
          conditionsAtArrival(link.cond, link.effects),
          conjuncts(target.available as Condition),
        );
        if (clash) {
          issues.push({
            level: 'warn',
            where: link.where,
            message: `Переход в «${targetId}» противоречит её available: ${clash}`,
          });
        }
      }
    }
  }

  // ── Бой без лимита ходов, который некому закончить ────────────────────────
  // turnLimit: 0 означает «без лимита». Если ни один враг не может нанести
  // урон, то бой держится только на способности отряда убивать: отряд из
  // одних лекарей зациклит движок навсегда.
  const abilityById = new Map(bundle.abilities.map((a) => [a.id, a]));
  const unitById = new Map(bundle.units.map((u) => [u.id, u]));
  const canDealDamage = (unitId: string): boolean => {
    const u = unitById.get(unitId);
    if (!u) return false;
    return u.abilities.some((id) => {
      const a = abilityById.get(id);
      if (!a) return false;
      // Способность без явных эффектов бьёт по ability.power — а урон
      // всегда минимум единица (computeDamage), так что это тоже урон.
      return !a.effects || a.effects.length === 0 || a.effects.some((e) => e.kind === 'damage');
    });
  };
  for (const b of bundle.battles) {
    if (b.turnLimit !== 0) continue;
    if (!b.enemies.some((e) => canDealDamage(e.unit))) {
      issues.push({
        level: 'warn',
        where: `battle:${b.id}`,
        message: 'Бой без лимита ходов, и ни один враг не наносит урона — бой может не закончиться никогда',
      });
    }
  }

  return issues;
}

function longestBubbleRun(scene: Scene): number {
  const byId = new Map(scene.nodes.map((n) => [n.id, n]));
  let best = 0;
  for (const start of scene.nodes) {
    if (start.kind !== 'say' && start.kind !== 'narration') continue;
    let run = 0;
    let cur: string | undefined = start.id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const n = byId.get(cur);
      if (!n) break;
      if (n.kind === 'say' || n.kind === 'narration') {
        run++;
        cur = n.next;
      } else if (n.kind === 'lore' || n.kind === 'effects') {
        cur = n.next;
      } else {
        break;
      }
      if (cur?.startsWith('scene:')) break;
    }
    best = Math.max(best, run);
  }
  return best;
}
