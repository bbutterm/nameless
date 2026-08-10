/**
 * Настоящий бандл как вход.
 *
 * Здесь единственный тест-файл, который берёт реальный контент игры и гоняет
 * его через движок. Задача — поймать ПОРЧУ КОНТЕНТА при будущих правках:
 * оборванный путь, бой, который перестал запускаться, воспоминание, которое
 * стало невозможно закрепить. Все проверки формулируются как инварианты,
 * а не как «в главе 1 должно быть 12 сцен» — иначе тест придётся править
 * при каждой новой сцене, и он превратится в шум.
 */
import { describe, expect, it } from 'vitest';
import {
  applyDeath,
  applyEffects,
  createInitialState,
  indexCombat,
  indexContent,
  parseRef,
  resolve,
  runAuto,
  scaledMaxHp,
  selectMemoryOnDeath,
  startBattle,
  type Effect,
  type GameState,
  type PartyUnit,
  type Scene,
  type SceneNode,
  type UnitDef,
} from '@nameless/engine';
import { content, validateBundle } from './index.js';
import { FACTION_HUES } from '../assets/procedural/procedural.js';

const scenesById = new Map(content.scenes.map((s) => [s.id, s]));
const unitsById = new Map(content.units.map((u) => [u.id, u]));

/** Все переходы узла, как их видит движок. */
function outgoing(node: SceneNode): string[] {
  switch (node.kind) {
    case 'say':
    case 'narration':
    case 'lore':
    case 'effects':
      return [node.next];
    case 'choice':
      return node.options.map((o) => o.to);
    case 'branch':
      return [...node.branches.map((b) => b.to), node.fallback];
    case 'battle':
      return [node.onWin, node.onLose];
    case 'death':
      return node.next ? [node.next] : [];
    default:
      return [];
  }
}

function allEffects(): { where: string; effects: Effect[] }[] {
  const out: { where: string; effects: Effect[] }[] = [];
  for (const s of content.scenes) {
    for (const n of s.nodes) {
      if (n.kind === 'effects') out.push({ where: `${s.id}#${n.id}`, effects: n.effects });
      if (n.kind === 'choice') {
        for (const o of n.options) {
          if (o.effects) out.push({ where: `${s.id}#${n.id}/${o.id}`, effects: o.effects });
        }
      }
    }
  }
  for (const b of content.battles) if (b.rewards) out.push({ where: `battle:${b.id}`, effects: b.rewards });
  for (const m of content.memories) if (m.grants) out.push({ where: `memory:${m.id}`, effects: m.grants });
  for (const l of content.lives) if (l.grants) out.push({ where: `life:${l.id}`, effects: l.grants });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Достижимость сцен
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Граф сцен: рёбра — переходы `scene:` и сцены пробуждения тех смертей,
 * до которых игрок действительно доходит. Именно так по игре движется игрок,
 * а не «все wakeScene доступны всегда», как считает валидатор.
 */
function reachableScenes(): Set<string> {
  const reached = new Set<string>();
  const queue: string[] = [];
  const push = (id: string): void => {
    if (!reached.has(id)) {
      reached.add(id);
      queue.push(id);
    }
  };
  for (const c of content.chapters) push(c.entryScene);
  while (queue.length > 0) {
    const sid = queue.shift() as string;
    const scene = scenesById.get(sid);
    if (!scene) continue;
    for (const node of scene.nodes) {
      for (const to of outgoing(node)) push(parseRef(to, sid).scene);
      if (node.kind === 'death') {
        const d = content.deaths.find((x) => x.id === node.death);
        if (d) push(d.wakeScene);
      }
    }
  }
  return reached;
}

describe('настоящий контент: связность сцен', () => {
  it('каждая сцена достижима от entry какой-нибудь главы', () => {
    const reached = reachableScenes();
    const orphans = content.scenes.filter((s) => !reached.has(s.id)).map((s) => s.id);
    expect(orphans, `сцены-сироты: ${orphans.join(', ')}`).toEqual([]);
  });

  it('каждый переход ведёт в существующий узел существующей сцены', () => {
    const broken: string[] = [];
    for (const scene of content.scenes) {
      const local = new Set(scene.nodes.map((n) => n.id));
      for (const node of scene.nodes) {
        for (const to of outgoing(node)) {
          const ref = parseRef(to, scene.id);
          const target = scenesById.get(ref.scene);
          if (!target) {
            broken.push(`${scene.id}#${node.id} → нет сцены «${ref.scene}»`);
            continue;
          }
          if (ref.scene === scene.id && ref.node && !local.has(ref.node)) {
            broken.push(`${scene.id}#${node.id} → нет узла «${ref.node}»`);
          }
          if (ref.scene !== scene.id && ref.node && !target.nodes.some((n) => n.id === ref.node)) {
            broken.push(`${scene.id}#${node.id} → нет узла «${ref.node}» в «${ref.scene}»`);
          }
        }
      }
    }
    expect(broken, broken.join('\n')).toEqual([]);
  });

  it('entry каждой сцены существует, и в каждой сцене есть выход', () => {
    for (const scene of content.scenes) {
      const ids = new Set(scene.nodes.map((n) => n.id));
      expect(ids.has(scene.entry), `${scene.id}: entry «${scene.entry}» не найден`).toBe(true);
      const hasExit = scene.nodes.some(
        (n) => n.kind === 'end' || n.kind === 'death' || outgoing(n).some((t) => t.startsWith('scene:')),
      );
      expect(hasExit, `${scene.id}: из сцены нет ни одного выхода`).toBe(true);
    }
  });

  it('entry-сцена каждой главы объявляет номер этой главы', () => {
    for (const c of content.chapters) {
      const s = scenesById.get(c.entryScene) as Scene;
      expect(s, `глава ${c.id}: нет сцены «${c.entryScene}»`).toBeDefined();
      expect(s.chapter, `глава ${c.id}: entry-сцена объявляет главу ${s.chapter}`).toBe(c.index);
    }
  });

  it('движок доходит от entry каждой главы до показываемого шага без ошибок', () => {
    const idx = indexContent(content);
    for (const c of content.chapters) {
      const s = createInitialState({
        seed: 'content-test',
        axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
        chapter: c.index,
        scene: c.entryScene,
        node: '@entry',
        now: 0,
      });
      const r = resolve(idx, s);
      expect(r.step.kind, `глава ${c.id}: ${r.step.kind === 'error' ? r.step.message : ''}`).not.toBe(
        'error',
      );
    }
  });

  it('каждый узел любой сцены разрешается движком без ошибки «нет узла»', () => {
    const idx = indexContent(content);
    const bad: string[] = [];
    for (const scene of content.scenes) {
      for (const node of scene.nodes) {
        const s = createInitialState({
          seed: 'node-probe',
          axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
          chapter: scene.chapter,
          scene: scene.id,
          node: node.id,
          now: 0,
        });
        const r = resolve(idx, s);
        if (r.step.kind === 'error') bad.push(`${scene.id}#${node.id}: ${r.step.message}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Бои
// ─────────────────────────────────────────────────────────────────────────────

describe('настоящий контент: бои', () => {
  const idx = indexCombat(content);

  /** Отряд-манекен: шесть первых юнитов, поднятых до уровня главы. */
  function dummyParty(level: number): PartyUnit[] {
    return content.units.slice(0, 6).map((u, i) => ({
      uid: `t${i}:${u.id}`,
      defId: u.id,
      hp: scaledMaxHp(u.stats.hp, level),
      xp: 0,
      level,
      slot: { row: (i < 3 ? 'front' : 'back') as 'front' | 'back', index: i % 3 },
    }));
  }

  it('каждый бой запускается: все враги встают на поле, ни один не потерян', () => {
    for (const b of content.battles) {
      const st = startBattle(idx, b, dummyParty(1), `start:${b.id}`);
      const enemies = st.units.filter((u) => u.side === 'enemy');
      expect(enemies.length, `бой ${b.id}: враги потеряны при расстановке`).toBe(b.enemies.length);
      for (const e of enemies) {
        expect(e.maxHp, `бой ${b.id}: у ${e.uid} нулевой максимум hp`).toBeGreaterThan(0);
        expect(e.alive, `бой ${b.id}: ${e.uid} мёртв на старте`).toBe(true);
      }
      expect(new Set(enemies.map((u) => u.uid)).size, `бой ${b.id}: одинаковые uid врагов`).toBe(
        enemies.length,
      );
    }
  });

  it('каждый бой завершается исходом — при любом из десяти сидов', () => {
    for (const b of content.battles) {
      for (let i = 0; i < 10; i++) {
        const st = runAuto(idx, startBattle(idx, b, dummyParty(3), `run:${b.id}:${i}`), 20000);
        expect(st.outcome, `бой ${b.id}, сид ${i}: не завершился (раунд ${st.round})`).not.toBe(
          'ongoing',
        );
        expect(st.round, `бой ${b.id}, сид ${i}: раунд ноль`).toBeGreaterThan(0);
      }
    }
  });

  it('каждый бой заканчивается и против пустого отряда, и против шестерых', () => {
    for (const b of content.battles) {
      expect(runAuto(idx, startBattle(idx, b, [], `empty:${b.id}`), 20000).outcome).toBe('lose');
      expect(
        runAuto(idx, startBattle(idx, b, dummyParty(6), `six:${b.id}`), 20000).outcome,
      ).not.toBe('ongoing');
    }
  });

  it('у каждого юнита есть хотя бы одна способность, и все они есть в реестре', () => {
    const abilityIds = new Set(content.abilities.map((a) => a.id));
    for (const u of content.units) {
      expect(u.abilities.length, `юнит ${u.id} без способностей`).toBeGreaterThan(0);
      for (const a of u.abilities) {
        expect(abilityIds.has(a), `юнит ${u.id}: нет способности «${a}»`).toBe(true);
      }
    }
  });

  it('каждый бой без лимита ходов имеет врагов, способных наносить урон', () => {
    const abilityById = new Map(content.abilities.map((a) => [a.id, a]));
    const dealsDamage = (unitId: string): boolean => {
      const u = unitsById.get(unitId);
      if (!u) return false;
      return u.abilities.some((id) => {
        const a = abilityById.get(id);
        if (!a) return false;
        return !a.effects || a.effects.length === 0 || a.effects.some((e) => e.kind === 'damage');
      });
    };
    for (const b of content.battles) {
      if (b.turnLimit !== 0) continue;
      // turnLimit: 0 = «без лимита». Если враги не могут убивать, а отряд игрока
      // тоже (например, один водонос), бой не заканчивается НИКОГДА.
      expect(
        b.enemies.some((e) => dealsDamage(e.unit)),
        `бой ${b.id} без лимита ходов, и ни один враг не наносит урона`,
      ).toBe(true);
    }
  });

  it('бой воспроизводим по сиду', () => {
    for (const b of content.battles) {
      const p = dummyParty(2);
      const a = runAuto(idx, startBattle(idx, b, p, 'det'), 20000);
      const c = runAuto(idx, startBattle(idx, b, p, 'det'), 20000);
      expect(JSON.stringify(a.events), `бой ${b.id} невоспроизводим`).toBe(JSON.stringify(c.events));
    }
  });

  it('на каждый бой ссылается хотя бы один узел battle', () => {
    const referenced = new Set<string>();
    for (const s of content.scenes) for (const n of s.nodes) if (n.kind === 'battle') referenced.add(n.battle);
    const dead = content.battles.filter((b) => !referenced.has(b.id)).map((b) => b.id);
    expect(dead, `бои, до которых игрок не дойдёт: ${dead.join(', ')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Память
// ─────────────────────────────────────────────────────────────────────────────

describe('настоящий контент: память', () => {
  it('каждому воспоминанию в игре хватает осколков на закрепление', () => {
    const available = new Map<string, number>();
    for (const { effects } of allEffects()) {
      for (const e of effects) {
        if (e.kind === 'fragment') {
          available.set(e.memory, (available.get(e.memory) ?? 0) + (e.amount ?? 1));
        }
      }
    }
    const starved = content.memories
      .filter((m) => (available.get(m.id) ?? 0) < m.cost)
      .map((m) => `${m.id}: в игре ${available.get(m.id) ?? 0} осколков, нужно ${m.cost}`);
    expect(starved, starved.join('\n')).toEqual([]);
  });

  it('каждое воспоминание может быть закреплено смертью', () => {
    for (const m of content.memories) {
      const state: GameState = {
        ...createInitialState({
          seed: 'mem',
          axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
          chapter: 1,
          scene: 'x',
          node: 'y',
          now: 0,
        }),
        fragments: { [m.id]: m.cost },
        // Остальные воспоминания уже закреплены — значит выбор падает на m.
        lockedMemories: content.memories.filter((x) => x.id !== m.id).map((x) => x.id),
      };
      expect(selectMemoryOnDeath(state, content)?.id, `воспоминание ${m.id} не закрепить`).toBe(m.id);
    }
  });

  it('закрепление воспоминания будит его жизнь и раздаёт гранты', () => {
    const idx = indexContent(content);
    for (const m of content.memories) {
      const death = content.deaths[0];
      if (!death) break;
      const state: GameState = {
        ...createInitialState({
          seed: 'mem2',
          axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
          chapter: 1,
          scene: 'x',
          node: 'y',
          now: 0,
        }),
        fragments: { [m.id]: m.cost },
        lockedMemories: content.memories.filter((x) => x.id !== m.id).map((x) => x.id),
      };
      const res = applyDeath(state, content, death, idx.effectCtx);
      expect(res.memory?.id, `воспоминание ${m.id}`).toBe(m.id);
      expect(res.state.lockedMemories, `воспоминание ${m.id} не закрепилось`).toContain(m.id);
      expect(res.state.awakenedLives, `жизнь ${m.life} не проснулась`).toContain(m.life);
    }
  });

  it('каждая жизнь набирается своими воспоминаниями, и все они существуют', () => {
    const memoryIds = new Set(content.memories.map((m) => m.id));
    for (const l of content.lives) {
      expect(l.memories.length, `жизнь ${l.id} без воспоминаний`).toBeGreaterThan(0);
      for (const m of l.memories) expect(memoryIds.has(m), `жизнь ${l.id}: нет «${m}»`).toBe(true);
      expect(
        content.axes.some((a) => a.id === l.axis),
        `жизнь ${l.id}: нет оси «${l.axis}»`,
      ).toBe(true);
    }
    // И обратно: у воспоминания есть жизнь, которая его знает.
    for (const m of content.memories) {
      const life = content.lives.find((l) => l.id === m.life);
      expect(life, `воспоминание ${m.id}: нет жизни «${m.life}»`).toBeDefined();
      expect(life?.memories, `воспоминание ${m.id} не в мозаике своей жизни`).toContain(m.id);
    }
  });

  it('каждая смерть будит игрока в существующей сцене и на неё кто-то ссылается', () => {
    const used = new Set<string>();
    for (const s of content.scenes) for (const n of s.nodes) if (n.kind === 'death') used.add(n.death);
    const reached = reachableScenes();
    for (const d of content.deaths) {
      expect(scenesById.has(d.wakeScene), `смерть ${d.id}: нет сцены «${d.wakeScene}»`).toBe(true);
      expect(used.has(d.id), `смерть ${d.id}: до неё не доводит ни один узел death`).toBe(true);
      expect(reached.has(d.wakeScene), `смерть ${d.id}: сцена пробуждения недостижима`).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Эффекты как ссылки
// ─────────────────────────────────────────────────────────────────────────────

describe('настоящий контент: эффекты ссылаются на существующее', () => {
  it('ни один recruit/dismiss/heal/xp не зовёт юнита, которого нет', () => {
    const bad: string[] = [];
    for (const { where, effects } of allEffects()) {
      for (const e of effects) {
        if ((e.kind === 'recruit' || e.kind === 'dismiss') && !unitsById.has(e.unit)) {
          bad.push(`${where}: ${e.kind} несуществующего «${e.unit}»`);
        }
        if ((e.kind === 'heal' || e.kind === 'xp') && e.unit && !unitsById.has(e.unit)) {
          bad.push(`${where}: ${e.kind} несуществующего «${e.unit}»`);
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('ни один осколок/awakenLife/axis не ссылается в пустоту', () => {
    const memoryIds = new Set(content.memories.map((m) => m.id));
    const lifeIds = new Set(content.lives.map((l) => l.id));
    const axisIds = new Set(content.axes.map((a) => a.id));
    const bad: string[] = [];
    for (const { where, effects } of allEffects()) {
      for (const e of effects) {
        if (e.kind === 'fragment' && !memoryIds.has(e.memory)) bad.push(`${where}: осколок «${e.memory}»`);
        if (e.kind === 'awakenLife' && !lifeIds.has(e.life)) bad.push(`${where}: жизнь «${e.life}»`);
        if (e.kind === 'axis' && !axisIds.has(e.axis)) bad.push(`${where}: ось «${e.axis}»`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('каждый recruit доводится до отряда: юнит встаёт в свободную клетку', () => {
    const idx = indexContent(content);
    const recruited = new Set<string>();
    for (const { effects } of allEffects()) {
      for (const e of effects) if (e.kind === 'recruit') recruited.add(e.unit);
    }
    for (const unitId of recruited) {
      const s0 = createInitialState({
        seed: 'rec',
        axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
        chapter: 1,
        scene: 'x',
        node: 'y',
        now: 0,
      });
      const s = applyEffects(s0, [{ kind: 'recruit', unit: unitId }], idx.effectCtx);
      expect(s.party.map((u) => u.defId), `recruit ${unitId} не сработал`).toContain(unitId);
      const def = unitsById.get(unitId) as UnitDef;
      expect(s.party[0]?.hp, `recruit ${unitId}: не полный hp`).toBe(def.stats.hp);
    }
  });

  it('эффект heal с неположительным amount ничего не делает — такого в контенте нет', () => {
    const bad: string[] = [];
    for (const { where, effects } of allEffects()) {
      for (const e of effects) {
        if (e.kind === 'heal' && e.amount <= 0) bad.push(`${where}: heal amount=${e.amount}`);
        if (e.kind === 'fragment' && (e.amount ?? 1) <= 0) bad.push(`${where}: fragment amount=${e.amount}`);
        if (e.kind === 'xp' && e.amount < 0) bad.push(`${where}: xp amount=${e.amount}`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Помянник
// ─────────────────────────────────────────────────────────────────────────────

describe('настоящий контент: Помянник', () => {
  it('весь бандл, включая codex, проходит валидацию без ошибок и предупреждений про codex', () => {
    const issues = validateBundle(content).filter((i) => i.where.startsWith('codex'));
    expect(issues.map((i) => `${i.where}: ${i.message}`)).toEqual([]);
  });

  it('каждая запись имеет непустые приметы и хотя бы одну строку', () => {
    for (const entry of content.codex) {
      expect(entry.signs.ru.trim().length, `${entry.id}: пустые приметы (ru)`).toBeGreaterThan(0);
      expect(entry.signs.en.trim().length, `${entry.id}: пустые приметы (en)`).toBeGreaterThan(0);
      expect(entry.lines.length, `${entry.id}: без строк`).toBeGreaterThanOrEqual(1);
    }
  });

  it('kind person заводится только тем, кто есть в speakers.json, кроме narrator/player/ochered', () => {
    const speakerIds = new Set(content.speakers.map((s) => s.id));
    for (const entry of content.codex) {
      if (entry.kind !== 'person') continue;
      expect(speakerIds.has(entry.id), `${entry.id}: нет среди speakers`).toBe(true);
      expect(['narrator', 'player', 'ochered']).not.toContain(entry.id);
    }
  });

  it('kind life заводится только для существующих прошлых жизней', () => {
    const lifeIds = new Set(content.lives.map((l) => l.id));
    for (const entry of content.codex) {
      if (entry.kind !== 'life') continue;
      expect(lifeIds.has(entry.id), `${entry.id}: нет среди lives`).toBe(true);
    }
  });

  it('id строк Помянника уникальны глобально', () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const entry of content.codex) {
      for (const line of entry.lines) {
        if (seen.has(line.id)) dup.push(line.id);
        seen.add(line.id);
      }
    }
    expect(dup).toEqual([]);
  });
});

describe('графика знает про фракции', () => {
  it('у каждой фракции ростера задан свой оттенок карточки', () => {
    // Оттенок незнакомой фракции берётся из хэша id, то есть врёт: два юнита
    // одной силы выходят разного цвета, а разные силы могут совпасть. На этом
    // уже спотыкались, когда таблица знала три фракции из шести, — и снова,
    // когда мир B привёл три новые.
    const unknown = [...new Set(content.units.map((u) => u.faction))].filter(
      (f) => !(f in FACTION_HUES),
    );
    expect(unknown).toEqual([]);
  });
});
