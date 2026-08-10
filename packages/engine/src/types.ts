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
  /**
   * Сколько осколков набрано в разделе — считая и досыпанные лестницей.
   *
   * Нужно церемонии, чтобы не соврать про саму себя: досыпка в один
   * осколок иногда добирает воспоминание до цены, и тогда архив выдаёт
   * память, говоря словами про её отсутствие. Условие позволяет
   * последней ступени выбрать раздел, который от одного осколка ещё не
   * закроется. Игроку ни это число, ни его существование не показываются.
   */
  | { kind: 'fragments'; memory: MemoryId; op: CompareOp; value: number }
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
  /** Имя в шапке пузыря. Без него клиент показал бы сырой id. */
  name?: LocalizedText;
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
  /**
   * Условие входа в сцену — АВТОРСКИЙ ИНВАРИАНТ, А НЕ ЗАМОК.
   *
   * Движок его намеренно не исполняет. Замок обязан иметь ответ на вопрос
   * «а куда девать игрока, который постучался», и никакого хорошего ответа
   * тут нет: молча оставить на месте — зависание, увести в фолбэк — сцена,
   * которую сценарист не писал. Поэтому `available` — обещание автора
   * («сюда приходят только вот при таких условиях»), а не проверка движка.
   *
   * Обещание держат два инструмента:
   * - валидатор ловит доказанные противоречия «переход зовёт — сцена не пустит»;
   * - фаззер диалогов проверяет условие на каждом входе живого прохождения
   *   и краснеет, если игрок вошёл туда, куда по `available` не должен был.
   *
   * Ставить сюда условие, от которого зависит проходимость, нельзя: оно ничего
   * не закрывает. Закрывают условия на самих переходах.
   */
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
  /** Ряд своих: тот ряд, в котором стоит выбранный союзник. */
  | 'ally_row'
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
  /**
   * Пассив: кнопки нет, ход не тратится, применяется один раз при начале боя
   * (`startBattle`). Задумано под «Опись» Перечня (MEMORY_POWERS §A.6): её
   * интерфейс — сами цифры на врагах, а не слот в панели.
   *
   * Эффекты пассива применяются к стороне, названной в `target`
   * (`enemy_*` — всем живым врагам, прочее — всем живым своим), кроме
   * `reveal` и `idle_toll`: те не целятся ни в кого — это режимы боя.
   */
  passive?: boolean;
  /** Уникальный тег для анимации на клиенте. */
  anim?: 'lunge' | 'shot' | 'cast' | 'aoe' | 'buff';
}

/**
 * Эффекты внутри боя (не путать с Effect — тот про мета-состояние).
 *
 * Три семейства, и они ведут себя по-разному:
 * - ПОЦЕЛЕВЫЕ (`damage`…`revive`, `heal_flat`, `purge`, `recorded`) —
 *   применяются к каждой цели способности;
 * - ВСЕОБЩИЕ (`rally`, `spare_worst_foe`, `bare_truth`) — исполняются один раз
 *   на применение и сами знают свою публику, независимо от `target`;
 * - РЕЖИМНЫЕ (`reveal`, `idle_toll`, `shield_refund`) — не бьют и не лечат,
 *   а меняют правила боя на его срок.
 */
export type BattleEffect =
  | { kind: 'damage'; power: number }
  /** Лечение долей атаки носителя. */
  | { kind: 'heal'; power: number }
  /**
   * Лечение фиксированным числом. Умения памяти не масштабируются от atk
   * юнитов (MEMORY_POWERS §A.1): руки героя одинаковы, кто бы ни уступил ход.
   */
  | { kind: 'heal_flat'; amount: number }
  | { kind: 'shield'; amount: number; turns: number; tag?: string }
  | { kind: 'buff'; stat: 'atk' | 'def' | 'initiative'; amount: number; turns: number }
  | { kind: 'debuff'; stat: 'atk' | 'def' | 'initiative'; amount: number; turns: number }
  | { kind: 'dot'; amount: number; turns: number; tag: string }
  | { kind: 'stun'; turns: number }
  /** Снять с цели дот, дебафы и оглушение. */
  | { kind: 'cleanse' }
  /** Снять с цели бафы и щиты — зеркало `cleanse`, «без прибавления». */
  | { kind: 'purge' }
  /**
   * «Занесено в протокол»: N раундов цель не принимает НОВЫХ бафов, щитов и
   * лечения. Урон, доты и дебафы проходят: протокол не защищает, он запрещает
   * приписки.
   */
  | { kind: 'recorded'; turns: number }
  /**
   * Щиты ЭТОГО применения, истёкшие непробитыми, возвращаются владельцу
   * лечением 1:1. Помечает щиты тегом; чужие щиты не трогает никогда —
   * иначе правка сдвинула бы цену каждого щитоносца в ростере.
   */
  | { kind: 'shield_refund' }
  /** Баф ВСЕМ живым своим применяющего, независимо от цели способности. */
  | { kind: 'rally'; stat: 'atk' | 'def' | 'initiative'; amount: number; turns: number }
  /** Фиксированное лечение самому раненому (по доле hp) живому врагу. */
  | { kind: 'spare_worst_foe'; amount: number }
  /**
   * «Год Голой Правды»: снимает все статусы со ВСЕХ бойцов обеих сторон и на
   * N раундов запрещает накладывать новые кому бы то ни было. Урон и лечение
   * работают.
   */
  | { kind: 'bare_truth'; turns: number }
  /** Режим «Опись»: точные числа и намерения врагов открыты с первого раунда. */
  | { kind: 'reveal' }
  /**
   * Пеня за бездействие: живой союзник, не совершивший действия в раунде,
   * теряет `amount` hp в его конце.
   */
  | { kind: 'idle_toll'; amount: number }
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
  /**
   * Метки боя. `lethal` — бой, который игрок по сюжету не переживает
   * (смерть наступает и при победе): балансовые коридоры к нему неприменимы.
   * `tutorial` — бой-знакомство: коридор победы выше обычного.
   */
  tags?: string[];
  /**
   * Каким отрядом этот бой мерить в симуляторе. Без подсказки симулятор берёт
   * шесть сильнейших юнитов тира, а в начале главы у игрока их двое — и бой,
   * посильный двоим, читается как стопроцентный.
   */
  expectParty?: UnitId[];
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
  /**
   * Что закреплённое воспоминание делает с БОЕВЫМ арсеналом самого игрока
   * (не отряда). Поле необязательное: пятнадцать воспоминаний, написанных до
   * появления умений, обязаны проходить валидацию без единой правки.
   *
   * Почему список, а не одно умение: одно воспоминание вправе дать одно,
   * усилить другое и отнять третье — «за всё платится», и плата за силу
   * выражается здесь же, а не отдельной сущностью.
   */
  powers?: MemoryPower[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Умения игрока
//
// Умения принадлежат ИГРОКУ, а не карте на доске: у игрока своей карточки нет,
// произносит умение та карта, чей сейчас ход. Набор умений — производная от
// `lockedMemories`: отдельного хранилища нет и быть не должно, иначе появятся
// два источника правды, которые разъедутся на первой же миграции сейва.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Поправка к умению, которую вносит воспоминание.
 *
 * Все поля складываются/перемножаются между собой по КОММУТАТИВНЫМ правилам —
 * именно поэтому итог не зависит от порядка закрепления воспоминаний
 * (см. `derivePlayerPowers`):
 * - `power`, `cooldown`, `turns` — суммируются (нейтраль 0);
 * - `effectScale` — перемножается (нейтраль 1);
 * - `piercing` — логическое ИЛИ (нейтраль false).
 */
export interface AbilityAmplify {
  /** Прибавка к множителю силы. Ниже нуля итог не опускается. */
  power?: number;
  /** Поправка к перезарядке; обычно отрицательная. Ниже нуля не опускается. */
  cooldown?: number;
  /**
   * Множитель числам внутри `effects`: урону, лечению, щиту, доту, бафу,
   * доле hp у воскрешения. 1 — ничего не меняет.
   */
  effectScale?: number;
  /**
   * Прибавка к числам внутри `effects` — ПОСЛЕ множителя. Нейтраль 0.
   *
   * Существует рядом с `effectScale`, потому что ступени умений памяти
   * заданы каноном не в процентах, а числами (14 → 10 → 12 у Ключаря), и
   * множитель выражал бы их дробями вида 20/14. Сложение коммутативно, значит
   * порядок закрепления воспоминаний по-прежнему ни на что не влияет.
   */
  effectAmount?: number;
  /** Прибавка к длительности статусов внутри `effects`. */
  turns?: number;
  /** Умение начинает пробивать прикрытие переднего ряда. */
  piercing?: boolean;
  /**
   * Умение начинает бить шире: «один» → «ряд» → «все».
   *
   * Слияние двух поправок берёт БОЛЕЕ ШИРОКУЮ цель (при равной ширине —
   * меньшую по обычному строковому сравнению). Это единственное коммутативное
   * прочтение: «расширить» — операция без обратной, и два расширения обязаны
   * дать одно и то же независимо от того, какое воспоминание пришло первым.
   */
  target?: TargetKind;
  /**
   * Эффекты, которые воспоминание ДОБАВЛЯЕТ к умению.
   *
   * Нужны потому, что третья ступень каждой жизни не усиливает вторую, а
   * переворачивает её (MEMORY_POWERS §A.1): розжиг становится сигналом к
   * штурму, лечение задевает врага, опись начинает есть своих. Числами это не
   * выражается — выражается новым эффектом.
   *
   * ДОБАВЛЕННОЕ НЕ МАСШТАБИРУЕТСЯ ни `effectScale`, ни `effectAmount`,
   * ни `turns`. Правило намеренное: усиление правит то, что умение уже делало,
   * а принесённое воспоминанием приходит своими числами, за которые оно и
   * отвечает. Иначе «Счёт за сезон» ловил бы прибавку длительности от «Плёс
   * горит» и раздавал бы бафы на раунд дольше, чем написано в каноне.
   *
   * Слияние — объединение списков с последующей сортировкой по стабильному
   * ключу, поэтому порядок закрепления не меняет ни состав, ни порядок эффектов.
   */
  addEffects?: BattleEffect[];
}

/** Что воспоминание делает с умениями игрока: даёт, усиливает или отнимает. */
export type MemoryPower =
  /**
   * ДАТЬ. `ability` — id из общего реестра способностей: движок и так умеет
   * его исполнять, отдельного вида контента заводить не нужно.
   */
  | {
      kind: 'grant';
      ability: AbilityId;
      /**
       * Тратит ли применение ход носителя. По умолчанию ДА (см. `act`).
       * `false` — умение вне очереди; такому умению перезарядка ≥1 обязательна,
       * иначе ход не сдвинется никогда.
       */
      costsTurn?: boolean;
    }
  /** УСИЛИТЬ уже данное. Усиление умения, которого никто не дал, — мёртвая запись (ловит валидатор). */
  | { kind: 'amplify'; ability: AbilityId; amplify: AbilityAmplify }
  /**
   * ОТНЯТЬ. Умение исчезает из набора игрока НАВСЕГДА, независимо от того,
   * закреплено дающее воспоминание раньше или позже отнимающего: иначе итог
   * зависел бы от порядка смертей, а он не должен.
   */
  | { kind: 'revoke'; ability: AbilityId; note?: LocalizedText };

/** Умение игрока в разобранном виде: то, чем движок действительно бьёт. */
export interface PlayerAbility {
  id: AbilityId;
  /** Способность с уже вложенными усилениями — НЕ равна записи из реестра. */
  ability: Ability;
  /** Воспоминания, которые умение дали. Отсортированы по id. */
  grantedBy: MemoryId[];
  /** Воспоминания, которые его усилили. Отсортированы по id. */
  amplifiedBy: MemoryId[];
  /** Накопленное усиление в сыром виде — для экрана памяти. */
  amplify: AbilityAmplify;
  /** Тратит ли применение ход носителя. */
  costsTurn: boolean;
  /**
   * Чья это жизнь. Берётся у воспоминания, которое умение дало, — отдельного
   * поля в контенте под это не заводится. По ней бой находит сродственных
   * юнитов для отклика (MEMORY_POWERS §C.2).
   */
  life?: LifeId;
  /**
   * Ступень: сколько воспоминаний этой жизни закреплено. Ровно то, что канон
   * называет `skillTier` (§A.1) — счётчик, а не конкретный id.
   */
  tier: number;
}

/** Умение, которое у игрока отняли: показывается в памяти, в бой не попадает. */
export interface RevokedPlayerAbility {
  id: AbilityId;
  /** Воспоминания, которые отняли. Отсортированы по id. */
  by: MemoryId[];
  /** Чем объясняется потеря — текст пишет канон. */
  note?: LocalizedText;
  /** Было ли что отнимать: какое-то закреплённое воспоминание это умение давало. */
  wasGranted: boolean;
}

/** Полный расклад умений игрока: что есть и что отняли. */
export interface PlayerPowerSet {
  abilities: PlayerAbility[];
  revoked: RevokedPlayerAbility[];
}

/**
 * Умения игрока внутри одного боя.
 *
 * Перезарядка общая на игрока, а не на карту: умение произносит та карта, чей
 * ход, но принадлежит оно игроку — двумя картами одно и то же умение дважды
 * за раунд не выжать.
 */
export interface PlayerLoadout {
  abilities: PlayerAbility[];
  cooldowns: Record<AbilityId, number>;
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

// ─────────────────────────────────────────────────────────────────────────────
// Помянник
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Откуда строка известна рассказчику. Пометка печатается рядом со строкой:
 * «увидено» ручается за факт, «со слов» — только за то, что так сказали
 * (CODEX §8: книге врать нельзя, людям в ней — можно).
 */
export type CodexSource = 'seen' | 'heard' | 'after_death' | 'last';

/**
 * Условие, по которому строка открывается. Ровно одно на строку.
 *
 * Отступление от CODEX §9, сознательное: вместо `char_death` и `chapter_end`
 * — один `flag`. Смерть персонажа и конец главы контент и так отмечает
 * флагами; отдельные виды события дали бы движку два новых обработчика,
 * которые внутри проверяли бы тот же флаг.
 */
export type CodexUnlock =
  /** Первая встреча: говорящий появился в ленте. */
  | { kind: 'meet'; speaker: string }
  /** Прожит конкретный узел конкретной сцены. */
  | { kind: 'node'; scene: SceneId; node: NodeId }
  /** Воспоминание закреплено смертью. */
  | { kind: 'memory'; memory: MemoryId }
  /** Игрок умер, а этот человек говорил с ним в той же сцене. */
  | { kind: 'player_death_with'; speaker: string }
  /** Флаг мира: смерть персонажа, конец главы, что угодно из контента. */
  | { kind: 'flag'; flag: FlagId };

export interface CodexLine {
  /** Уникален глобально: `osoka_l2`. По нему хранилище отличает открытое. */
  id: string;
  text: LocalizedText;
  source: CodexSource;
  unlock: CodexUnlock;
}

/** Страница Помянника: человек или прошлая жизнь игрока. */
export interface CodexEntry {
  /** Совпадает с id говорящего (`person`) или прошлой жизни (`life`). */
  id: string;
  kind: 'person' | 'life';
  name: LocalizedText;
  /** Подпись-должность под именем. */
  blurb: LocalizedText;
  /** Приметы: что с этим лицом сделала работа. ≤160 знаков. */
  signs: LocalizedText;
  lines: CodexLine[];
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
  codex: CodexEntry[];
}
