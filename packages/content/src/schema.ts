import { z } from 'zod';

/**
 * Схемы валидации контента. Любой JSON-файл сцены/юнита проходит через них
 * перед сборкой: кривой контент не должен доезжать до телефона.
 */

export const zLocalized = z.object({
  ru: z.string().min(1),
  en: z.string().min(1),
});

export const zCompareOp = z.enum(['gte', 'lte', 'gt', 'lt', 'eq', 'neq']);

export const zCondition: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('always') }),
    z.object({ kind: z.literal('never') }),
    z.object({ kind: z.literal('all'), of: z.array(zCondition).min(1) }),
    z.object({ kind: z.literal('any'), of: z.array(zCondition).min(1) }),
    z.object({ kind: z.literal('not'), of: zCondition }),
    z.object({ kind: z.literal('axis'), axis: z.string(), op: zCompareOp, value: z.number() }),
    z.object({ kind: z.literal('flag'), flag: z.string(), value: z.boolean().optional() }),
    z.object({ kind: z.literal('counter'), counter: z.string(), op: zCompareOp, value: z.number() }),
    z.object({ kind: z.literal('memory'), memory: z.string() }),
    z.object({ kind: z.literal('life'), life: z.string() }),
    z.object({ kind: z.literal('visited'), scene: z.string() }),
    z.object({ kind: z.literal('deaths'), op: zCompareOp, value: z.number() }),
    z.object({ kind: z.literal('chapter'), op: zCompareOp, value: z.number() }),
    z.object({ kind: z.literal('hasUnit'), unit: z.string() }),
    z.object({ kind: z.literal('partySize'), op: zCompareOp, value: z.number() }),
  ]),
);

export const zEffect = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('axis'), axis: z.string(), delta: z.number() }),
  z.object({ kind: z.literal('flag'), flag: z.string(), value: z.boolean() }),
  z.object({ kind: z.literal('counter'), counter: z.string(), delta: z.number() }),
  z.object({ kind: z.literal('fragment'), memory: z.string(), amount: z.number().optional() }),
  z.object({ kind: z.literal('awakenLife'), life: z.string() }),
  z.object({ kind: z.literal('recruit'), unit: z.string() }),
  z.object({ kind: z.literal('dismiss'), unit: z.string() }),
  z.object({ kind: z.literal('heal'), unit: z.string().optional(), amount: z.number() }),
  z.object({ kind: z.literal('gold'), delta: z.number() }),
  z.object({ kind: z.literal('xp'), unit: z.string().optional(), amount: z.number() }),
]);

export const zKeyword = z.object({
  match: zLocalized,
  tone: z.enum(['memory', 'danger', 'name', 'lore', 'lie']),
});

export const zOptionChip = z.object({
  icon: z.string(),
  label: zLocalized,
  tone: z.enum(['life', 'axis', 'item']).optional(),
});

/** ≤10 слов на кнопке выбора — правило зоны большого пальца. */
const MAX_OPTION_WORDS = 10;
const wordCount = (s: string): number => s.trim().split(/\s+/).length;

export const zOption = z
  .object({
    id: z.string().min(1),
    text: zLocalized,
    chip: zOptionChip.optional(),
    conditions: zCondition.optional(),
    fallback: z.boolean().optional(),
    effects: z.array(zEffect).optional(),
    to: z.string().min(1),
    priority: z.number().optional(),
  })
  .refine((o) => wordCount(o.text.ru) <= MAX_OPTION_WORDS, {
    message: `Реплика выбора (ru) длиннее ${MAX_OPTION_WORDS} слов`,
    path: ['text', 'ru'],
  })
  .refine((o) => wordCount(o.text.en) <= MAX_OPTION_WORDS, {
    message: `Реплика выбора (en) длиннее ${MAX_OPTION_WORDS} слов`,
    path: ['text', 'en'],
  });

export const zSceneNode = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('say'),
    id: z.string(),
    speaker: z.string(),
    text: zLocalized,
    keywords: z.array(zKeyword).optional(),
    mood: z.string().optional(),
    next: z.string(),
  }),
  z.object({
    kind: z.literal('narration'),
    id: z.string(),
    text: zLocalized,
    keywords: z.array(zKeyword).optional(),
    next: z.string(),
  }),
  z.object({
    kind: z.literal('lore'),
    id: z.string(),
    title: zLocalized,
    text: zLocalized,
    next: z.string(),
  }),
  z.object({
    kind: z.literal('choice'),
    id: z.string(),
    prompt: zLocalized.optional(),
    options: z.array(zOption).min(2),
  }),
  z.object({
    kind: z.literal('effects'),
    id: z.string(),
    effects: z.array(zEffect).min(1),
    next: z.string(),
  }),
  z.object({
    kind: z.literal('branch'),
    id: z.string(),
    branches: z.array(z.object({ when: zCondition, to: z.string() })).min(1),
    fallback: z.string(),
  }),
  z.object({
    kind: z.literal('battle'),
    id: z.string(),
    battle: z.string(),
    onWin: z.string(),
    onLose: z.string(),
  }),
  z.object({
    kind: z.literal('death'),
    id: z.string(),
    death: z.string(),
    next: z.string().optional(),
  }),
  z.object({ kind: z.literal('end'), id: z.string() }),
]);

export const zScene = z.object({
  id: z.string().min(1),
  chapter: z.number().int().min(0),
  title: zLocalized,
  tags: z.array(z.string()).optional(),
  available: zCondition.optional(),
  entry: z.string().min(1),
  nodes: z.array(zSceneNode).min(1),
});

export const zBattleEffect = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('damage'), power: z.number() }),
  z.object({ kind: z.literal('heal'), power: z.number() }),
  z.object({ kind: z.literal('shield'), amount: z.number(), turns: z.number() }),
  z.object({
    kind: z.literal('buff'),
    stat: z.enum(['atk', 'def', 'initiative']),
    amount: z.number(),
    turns: z.number(),
  }),
  z.object({
    kind: z.literal('debuff'),
    stat: z.enum(['atk', 'def', 'initiative']),
    amount: z.number(),
    turns: z.number(),
  }),
  z.object({ kind: z.literal('dot'), amount: z.number(), turns: z.number(), tag: z.string() }),
  z.object({ kind: z.literal('stun'), turns: z.number() }),
  z.object({ kind: z.literal('cleanse') }),
  z.object({ kind: z.literal('revive'), hpPercent: z.number() }),
]);

export const zAbility = z.object({
  id: z.string().min(1),
  name: zLocalized,
  description: zLocalized,
  icon: z.string(),
  target: z.enum([
    'enemy_front',
    'enemy_any',
    'enemy_row',
    'enemy_all',
    'ally_one',
    'ally_all',
    'self',
  ]),
  power: z.number().min(0),
  cooldown: z.number().int().min(0),
  initialCooldown: z.number().int().min(0).optional(),
  effects: z.array(zBattleEffect).optional(),
  piercing: z.boolean().optional(),
  anim: z.enum(['lunge', 'shot', 'cast', 'aoe', 'buff']).optional(),
});

/** ≤8 слов на карте — иначе не читается на 360px. */
const MAX_BLURB_WORDS = 8;

export const zUnit = z
  .object({
    id: z.string().min(1),
    name: zLocalized,
    blurb: zLocalized,
    art: z.string(),
    faction: z.string(),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    row: z.enum(['front', 'back']),
    stats: z.object({
      hp: z.number().min(1),
      atk: z.number().min(0),
      def: z.number().min(0),
      initiative: z.number().min(0),
    }),
    abilities: z.array(z.string()).min(1),
    evolvesTo: z.string().optional(),
    evolveAt: z.number().optional(),
    recruitable: zCondition.optional(),
    traits: z.array(z.string()).optional(),
  })
  .refine((u) => wordCount(u.blurb.ru) <= MAX_BLURB_WORDS, {
    message: `Подпись на карте (ru) длиннее ${MAX_BLURB_WORDS} слов`,
    path: ['blurb', 'ru'],
  });

export const zBattle = z.object({
  id: z.string().min(1),
  name: zLocalized,
  tags: z.array(z.string()).optional(),
  enemies: z
    .array(
      z.object({
        unit: z.string(),
        row: z.enum(['front', 'back']),
        index: z.number().int().min(0).max(2),
        level: z.number().int().min(1).optional(),
      }),
    )
    .min(1)
    .max(6),
  turnLimit: z.number().int().min(0).optional(),
  background: z.string().optional(),
  rewards: z.array(zEffect).optional(),
});

export const zLife = z.object({
  id: z.string().min(1),
  name: zLocalized,
  flavor: zLocalized,
  icon: z.string(),
  axis: z.string(),
  pole: z.enum(['positive', 'negative']),
  memories: z.array(z.string()).min(1),
  grants: z.array(zEffect).optional(),
});

export const zMemory = z.object({
  id: z.string().min(1),
  life: z.string(),
  name: zLocalized,
  revelation: zLocalized,
  icon: z.string(),
  cost: z.number().int().min(1),
  grants: z.array(zEffect).optional(),
});

export const zDeath = z.object({
  id: z.string().min(1),
  name: zLocalized,
  wakeScene: z.string(),
  wakeText: zLocalized,
});

export const zChapter = z.object({
  index: z.number().int().min(0),
  id: z.string().min(1),
  title: zLocalized,
  subtitle: zLocalized.optional(),
  entryScene: z.string(),
});

export const zAxis = z.object({
  id: z.string().min(1),
  positive: zLocalized,
  negative: zLocalized,
  extreme: z.number().int().min(1).max(100),
  start: z.number().int().min(-100).max(100),
});

export const zSpeaker = z.object({
  id: z.string().min(1),
  name: zLocalized.optional(),
  art: z.string().optional(),
});

export const zBundle = z.object({
  axes: z.array(zAxis).min(1),
  scenes: z.array(zScene),
  units: z.array(zUnit),
  abilities: z.array(zAbility),
  battles: z.array(zBattle),
  lives: z.array(zLife),
  memories: z.array(zMemory),
  deaths: z.array(zDeath),
  chapters: z.array(zChapter).min(1),
  speakers: z.array(zSpeaker),
});
