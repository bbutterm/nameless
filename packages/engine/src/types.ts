/**
 * Контракт данных. Всё, что читают content/, client/ и sim/, объявлено здесь.
 * Идентификаторы осей, флагов и воспоминаний — свободные строки: движок про них
 * ничего не знает, реестр живёт в контенте и проверяется схемами zod.
 */

/** Двуязычный текст. Контент самодостаточен — никаких внешних словарей на сцены. */
export interface LocalizedText {
  ru: string;
  en: string;
}

export type Lang = 'ru' | 'en';

export type AxisId = string;
export type FlagId = string;
export type CounterId = string;
export type MemoryId = string;
export type LifeId = string;
export type SceneId = string;
export type NodeId = string;
export type UnitId = string;
export type AbilityId = string;
export type BattleId = string;

// ─────────────────────────────────────────────────────────────────────────────
// Условия
// ─────────────────────────────────────────────────────────────────────────────

export type CompareOp = 'gte' | 'lte' | 'gt' | 'lt' | 'eq' | 'neq';

export type Condition =
  | { kind: 'always' }
  | { kind: 'never' }
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition }
  /** Значение оси личности. Оси лежат в диапазоне [-100, 100]. */
  | { kind: 'axis'; axis: AxisId; op: CompareOp; value: number }
  /** Флаг памяти мира. `value` по умолчанию true. */
  | { kind: 'flag'; flag: FlagId; value?: boolean }
  | { kind: 'counter'; counter: CounterId; op: CompareOp; value: number }
  /** Воспоминание закреплено смертью. */
  | { kind: 'memory'; memory: MemoryId }
  /** Прошлая жизнь пробуждена (доступна как источник проверок). */
  | { kind: 'life'; life: LifeId }
  /** Сцена уже посещалась. */
  | { kind: 'visited'; scene: SceneId }
  | { kind: 'deaths'; op: CompareOp; value: number }
  | { kind: 'chapter'; op: CompareOp; value: number }
  /** Юнит есть в отряде. */
  | { kind: 'hasUnit'; unit: UnitId }
  /** Размер отряда. */
  | { kind: 'partySize'; op: CompareOp; value: number };

// ─────────────────────────────────────────────────────────────────────────────
// Эффекты
// ─────────────────────────────────────────────────────────────────────────────

export type Effect =
  | { kind: 'axis'; axis: AxisId; delta: number }
  | { kind: 'flag'; flag: FlagId; value: boolean }
  | { kind: 'counter'; counter: CounterId; delta: number }
  /** Осколок воспоминания — копится, закрепляется смертью. */
  | { kind: 'fragment'; memory: MemoryId; amount?: number }
  /** Немедленно пробудить прошлую жизнь (редко: сюжетные моменты). */
  | { kind: 'awakenLife'; life: LifeId }
  | { kind: 'recruit'; unit: UnitId }
  | { kind: 'dismiss'; unit: UnitId }
  | { kind: 'heal'; unit?: UnitId; amount: number }
  | { kind: 'gold'; delta: number }
  | { kind: 'xp'; unit?: UnitId; amount: number };

// ─────────────────────────────────────────────────────────────────────────────
// Сцены
// ─────────────────────────────────────────────────────────────────────────────

/** Кто говорит. `narrator` рисуется курсивом без портрета. */
export interface Speaker {
  id: string;
  /** Путь к портрету или id процедурной заглушки. */
  art?: string;
}

/** Ключевое слово, подсвеченное в пузыре. */
export interface Keyword {
  /** Подстрока в тексте (для каждого языка своя). */
  match: LocalizedText;
  /** Тон подсветки: смысловые группы, цвета задаёт тема клиента. */
  tone: 'memory' | 'danger' | 'name' | 'lore' | 'lie';
}

/** Проверка на кнопке выбора: «[⚔ Наёмник] Схватить за горло». */
export interface OptionChip {
  icon: string;
  label: LocalizedText;
  /** Ось/жизнь, к которой относится чип — для окраски. */
  tone?: 'life' | 'axis' | 'item';
}

export interface Option {
  id: string;
  text: LocalizedText;
  chip?: OptionChip;
  /** Кому показывать. Отсутствие условия = показывать всегда. */
  conditions?: Condition;
  /**
   * Страховочный вариант: не отфильтровывается никогда.
   * Железное правило — в каждом choice-узле минимум два таких либо
   * гарантированно проходящих варианта. Проверяет фаззер.
   */
  fallback?: boolean;
  effects?: Effect[];
  /** Куда идти. Локальный NodeId или "scene:id" / "scene:id#node". */
  to: string;
  /** Приоритет показа, если после фильтрации осталось больше 4 вариантов. */
  priority?: number;
}

export type SceneNode =
  | {
      kind: 'say';
      id: NodeId;
      speaker: string;
      text: LocalizedText;
      keywords?: Keyword[];
      /** Эмоция для смены портрета/тона пузыря. */
      mood?: string;
      next: string;
    }
  | { kind: 'narration'; id: NodeId; text: LocalizedText; keywords?: Keyword[]; next: string }
  /** Раскрывашка «▸ рассмотреть ближе». */
  | { kind: 'lore'; id: NodeId; title: LocalizedText; text: LocalizedText; next: string }
  | { kind: 'choice'; id: NodeId; prompt?: LocalizedText; options: Option[] }
  | { kind: 'effects'; id: NodeId; effects: Effect[]; next: string }
  /** Невидимая развилка по состоянию. */
  | {
      kind: 'branch';
      id: NodeId;
      branches: { when: Condition; to: string }[];
      fallback: string;
    }
  | { kind: 'battle'; id: NodeId; battle: BattleId; onWin: string; onLose: string }
  /** Смерть игрока: закрепляет воспоминание и открывает ветку. */
  | { kind: 'death'; id: NodeId; death: string; next?: string }
  | { kind: 'end'; id: NodeId };

export interface Scene {
  id: SceneId;
  chapter: number;
  title: LocalizedText;
  /** Свободные метки: 'hub', 'combat', 'death', 'branch_a'… */
  tags?: string[];
  /** Условие входа в сцену (для хабов и выбора следующей сцены). */
  available?: Condition;
  entry: NodeId;
  nodes: SceneNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Бой
// ─────────────────────────────────────────────────────────────────────────────

export type Row = 'front' | 'back';
export type Side = 'player' | 'enemy';

/** Тип цели способности. */
export type TargetKind =
  | 'enemy_front' // только первый ряд врага (или задний, если передний пуст)
  | 'enemy_any' // любой враг — дальнобойность
  | 'enemy_row' // весь ряд
  | 'enemy_all'
  | 'ally_one'
  | 'ally_all'
  | 'self';

export interface Ability {
  id: AbilityId;
  name: LocalizedText;
  /** ≤ 12 слов: показывается в тултипе на карте. */
  description: LocalizedText;
  icon: string;
  target: TargetKind;
  /** Множитель к атаке носителя. 0 = урона нет (баф/лечение). */
  power: number;
  /** Ходов перезарядки. 0 = каждый ход. */
  cooldown: number;
  /** Задержка перед первым применением. */
  initialCooldown?: number;
  effects?: BattleEffect[];
  /** Игнорирует правило «передний ряд прикрывает задний». */
  piercing?: boolean;
  /** Уникальный тег для анимации на клиенте. */
  anim?: 'lunge' | 'shot' | 'cast' | 'aoe' | 'buff';
}

/** Эффекты внутри боя (не путать с Effect — тот про мета-состояние). */
export type BattleEffect =
  | { kind: 'damage'; power: number }
  | { kind: 'heal'; power: number }
  | { kind: 'shield'; amount: number; turns: number }
  | { kind: 'buff'; stat: 'atk' | 'def' | 'initiative'; amount: number; turns: number }
  | { kind: 'debuff'; stat: 'atk' | 'def' | 'initiative'; amount: number; turns: number }
  | { kind: 'dot'; amount: number; turns: number; tag: string }
  | { kind: 'stun'; turns: number }
  | { kind: 'cleanse' }
  | { kind: 'revive'; hpPercent: number };

export interface UnitStats {
  hp: number;
  atk: number;
  def: number;
  initiative: number;
}

export interface UnitDef {
  id: UnitId;
  name: LocalizedText;
  /** ≤ 8 слов на карте. */
  blurb: LocalizedText;
  /** Путь к арту или '' — тогда рисуется процедурная заглушка по id. */
  art: string;
  faction: string;
  tier: 1 | 2 | 3;
  /** Предпочтительный ряд; строй всё равно решает игрок. */
  row: Row;
  stats: UnitStats;
  abilities: AbilityId[];
  /** Во что эволюционирует и при каком опыте. */
  evolvesTo?: UnitId;
  evolveAt?: number;
  /** Кто готов идти к игроку: условие по осям личности. */
  recruitable?: Condition;
  traits?: string[];
}

/** Экземпляр юнита в отряде игрока — растёт и помнит раны. */
export interface PartyUnit {
  /** Уникальный ключ экземпляра (несколько одинаковых юнитов возможны). */
  uid: string;
  defId: UnitId;
  hp: number;
  xp: number;
  level: number;
  slot: { row: Row; index: number };
}

export interface BattleUnitState {
  uid: string;
  defId: UnitId;
  side: Side;
  row: Row;
  index: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  initiative: number;
  alive: boolean;
  cooldowns: Record<AbilityId, number>;
  statuses: StatusEffect[];
  /** Что юнит собирается сделать в этом раунде (для иконок намерений). */
  intent?: Intent;
  /** Ходил ли уже в этом раунде. */
  acted: boolean;
}

export interface StatusEffect {
  kind: BattleEffect['kind'];
  stat?: 'atk' | 'def' | 'initiative';
  amount: number;
  turns: number;
  tag?: string;
}

export interface Intent {
  ability: AbilityId;
  targetUid?: string;
  /** Иконка намерения для UI. */
  icon: string;
}

export interface BattleDef {
  id: BattleId;
  name: LocalizedText;
  enemies: { unit: UnitId; row: Row; index: number; level?: number }[];
  /** Сколько ходов до поражения (0 = без лимита). */
  turnLimit?: number;
  background?: string;
  /** Награда за победу. */
  rewards?: Effect[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Память и смерть
// ─────────────────────────────────────────────────────────────────────────────

export interface PastLife {
  id: LifeId;
  name: LocalizedText;
  /** Одна фраза — «вкус» жизни. */
  flavor: LocalizedText;
  icon: string;
  /** Какая ось тянет к этой жизни. */
  axis: AxisId;
  /** Знак: к какому полюсу оси. */
  pole: 'positive' | 'negative';
  /** Воспоминания, из которых складывается жизнь. */
  memories: MemoryId[];
  /** Что даёт пробуждённая жизнь: проверки в диалогах + бонус в бою. */
  grants?: Effect[];
}

export interface Memory {
  id: MemoryId;
  life: LifeId;
  name: LocalizedText;
  /** Текст, который игрок видит в момент закрепления. */
  revelation: LocalizedText;
  icon: string;
  /** Сколько осколков нужно, чтобы воспоминание могло закрепиться. */
  cost: number;
  grants?: Effect[];
}

export interface DeathDef {
  id: string;
  /** Как игрок умер — для текста пробуждения. */
  name: LocalizedText;
  /** Куда попадает игрок после смерти. */
  wakeScene: SceneId;
  /** Текст пробуждения (может быть переопределён закреплённым воспоминанием). */
  wakeText: LocalizedText;
}

// ─────────────────────────────────────────────────────────────────────────────
// Главы
// ─────────────────────────────────────────────────────────────────────────────

export interface Chapter {
  index: number;
  id: string;
  title: LocalizedText;
  subtitle?: LocalizedText;
  entryScene: SceneId;
}

/** Описание оси личности: имя, полюса, стартовое значение. */
export interface AxisDef {
  id: AxisId;
  positive: LocalizedText;
  negative: LocalizedText;
  /** Порог, за которым мир считает игрока «крайним». */
  extreme: number;
  start: number;
}

/** Весь контент игры, собранный и провалидированный. */
export interface ContentBundle {
  axes: AxisDef[];
  scenes: Scene[];
  units: UnitDef[];
  abilities: Ability[];
  battles: BattleDef[];
  lives: PastLife[];
  memories: Memory[];
  deaths: DeathDef[];
  chapters: Chapter[];
  speakers: Speaker[];
}
