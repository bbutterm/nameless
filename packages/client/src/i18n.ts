import type { Lang, LocalizedText } from '@nameless/engine';

/**
 * Строки интерфейса. Тексты сцен живут в контенте (двуязычные прямо в JSON) —
 * здесь только оболочка.
 */
export const ui = {
  ru: {
    title: 'Безымянный',
    subtitle: 'Вклад Первый',
    continue: 'Продолжить',
    /* Первый запуск: сейва нет, и «Начать заново» на пустом месте пугает. */
    startGame: 'Начать',
    newGame: 'Начать заново',
    newGameWarn: 'Прошлое прохождение будет стёрто. Продолжить?',
    yes: 'Да',
    no: 'Нет',
    rotate: 'Поверни телефон вертикально',
    rotateHint: 'Заклад стоит на сваях. Он не ложится набок.',
    tapToContinue: 'коснись, чтобы продолжить',
    lookCloser: 'рассмотреть ближе',
    battleStart: 'Строй против строя',
    yourTurn: 'Твой ход',
    chooseTarget: 'Выбери цель',
    cancel: 'Отмена',
    victory: 'Победа',
    defeat: 'Поражение',
    /* Исход проигранного боя. Красное «Поражение» перед церемонией смерти
       спорило с каноном: смерть здесь — не наказание, а единственный способ
       вернуть себе себя. Строй рассыпается, игрок — продолжается. */
    battleLost: 'Строй рассыпался',
    battleLostNote: 'Труха соберётся снова. Что-то вернётся с тобой.',
    battleDraw: 'Никого не осталось',
    round: 'Раунд',
    /* Умения памяти: ромб в панели боя. Слов про оси и полюса тут нет и не
       будет — умение называется глаголом конторы, а не именем жизни. */
    powerSpent: 'Руки уже вспомнили — на этот бой хватит',
    powerSpentShort: 'вспомнил',
    powerNoTargets: 'Некому',
    powerNotYourTurn: 'Не твой черёд',
    /* Бой: очередь, намерения, разбор способности */
    turnOf: 'Ходит',
    nextRound: 'новый раунд',
    holdForInfo: 'удержи — разбор',
    chooseAbility: 'Выбери способность',
    aimsAt: 'бьёт',
    targetFront: 'первый ряд',
    targetAny: 'любого',
    targetRow: 'весь ряд',
    targetAll: 'всех',
    targetAlly: 'своего',
    targetAllies: 'всех своих',
    targetSelf: 'себя',
    piercing: 'сквозь строй',
    everyTurn: 'каждый ход',
    cooldownN: 'перезарядка',
    oncePerBattle: 'один раз за бой',
    damageWord: 'урон',
    healsWord: 'лечит',
    lethalHint: 'добьёт',
    coveredShort: 'прикрыт',
    coveredReason: 'Задний ряд прикрыт передним. Сначала передние.',
    notATarget: 'Этой способностью по нему не ударить.',
    allyReason: 'Это свой. Способность бьёт врагов.',
    effShield: 'щит',
    effDot: 'яд',
    effStun: 'оглушение',
    effCleanse: 'снимает порчу',
    effRevive: 'поднимает павшего',
    statAtk: 'атака',
    statDef: 'броня',
    statInit: 'прыть',
    memoryLocked: 'Зарубка признана',
    memoryLockedHint: 'Это воспоминание больше не отнять.',
    lifeAwakened: 'Жизнь откликнулась',
    joinedParty: 'В отряд',
    deathsCount: 'Смертей',
    proceed: 'Дальше',
    party: 'Отряд',
    memories: 'Память',
    settings: 'Настройки',
    language: 'Язык',
    haptics: 'Вибрация',
    sound: 'Звук',
    close: 'Закрыть',
    saveError: 'Сейв не читается. Начни заново.',
    emptyParty: 'Отряд пуст',
    rowFront: 'перёд',
    rowBack: 'зад',
    swapHint: 'Тапни двоих — поменяются местами. Удержи — бирка.',
    levelUp: 'Уровень',
    evolved: 'Превращение',
    noMemories: 'Ни одного лота не выкуплено.',
    tutorialTap: 'Коснись экрана — реплика за репликой.',
    tutorialChoice: 'Выбирай снизу. Некоторых вариантов ты не увидишь никогда.',
    tutorialBattle: 'Тапни свою карту, потом врага. Передний ряд прикрывает задний.',
    skip: 'Пропустить',
    /* Помянник (docs/CODEX.md) */
    codexOpen: 'Помянник',
    codexCount: 'вписано',
    codexEmpty: 'Пока никто не вписан.',
    codexYou: 'Ты',
    codexBack: 'К списку',
    codexReturn: 'Назад к церемонии',
    codexSourceSeen: 'увидено',
    codexSourceHeard: 'со слов',
    codexSourceAfterDeath: 'после твоей смерти',
    codexSourceLast: 'последняя',
    codexAdded: 'В Помянник дописано',
    /* Бирка вербовки (КАНОН_КРАТКО §9, REVIEW_GAMEPLAY §2.П1) */
    recruitCan: 'Что умеет в бою',
    recruitPlace: 'Место в строю',
    recruitNoAbilities: 'В драку не лезет.',
  },
  en: {
    title: 'The Nameless',
    subtitle: 'Deposit the First',
    continue: 'Continue',
    startGame: 'Begin',
    newGame: 'Start over',
    newGameWarn: 'Your previous run will be erased. Continue?',
    yes: 'Yes',
    no: 'No',
    rotate: 'Turn your phone upright',
    rotateHint: 'Zaklad stands on stilts. It does not lie down.',
    tapToContinue: 'tap to continue',
    lookCloser: 'look closer',
    battleStart: 'Line against line',
    yourTurn: 'Your turn',
    chooseTarget: 'Pick a target',
    cancel: 'Cancel',
    victory: 'Victory',
    defeat: 'Defeat',
    battleLost: 'The line came apart',
    battleLostNote: 'The dust will gather again. Something returns with you.',
    battleDraw: 'No one left standing',
    round: 'Round',
    powerSpent: 'The hands have remembered — enough for this fight',
    powerSpentShort: 'spent',
    powerNoTargets: 'No one to reach',
    powerNotYourTurn: 'Not your turn',
    turnOf: 'Acting',
    nextRound: 'new round',
    holdForInfo: 'hold for details',
    chooseAbility: 'Pick an ability',
    aimsAt: 'strikes',
    targetFront: 'front row',
    targetAny: 'anyone',
    targetRow: 'a whole row',
    targetAll: 'everyone',
    targetAlly: 'an ally',
    targetAllies: 'all allies',
    targetSelf: 'self',
    piercing: 'through the line',
    everyTurn: 'every turn',
    cooldownN: 'cooldown',
    oncePerBattle: 'once per fight',
    damageWord: 'damage',
    healsWord: 'heals',
    lethalHint: 'finishes',
    coveredShort: 'covered',
    coveredReason: 'The back row is covered. Clear the front first.',
    notATarget: 'This ability cannot reach them.',
    allyReason: 'One of yours. This ability strikes foes.',
    effShield: 'shield',
    effDot: 'poison',
    effStun: 'stun',
    effCleanse: 'cleanses',
    effRevive: 'raises the fallen',
    statAtk: 'attack',
    statDef: 'armour',
    statInit: 'speed',
    memoryLocked: 'Notch acknowledged',
    memoryLockedHint: 'This memory can never be taken again.',
    lifeAwakened: 'A life answered',
    joinedParty: 'Joined',
    deathsCount: 'Deaths',
    proceed: 'Onward',
    party: 'Party',
    memories: 'Memory',
    settings: 'Settings',
    language: 'Language',
    haptics: 'Haptics',
    sound: 'Sound',
    close: 'Close',
    saveError: 'Save unreadable. Start over.',
    emptyParty: 'No one follows you',
    rowFront: 'front',
    rowBack: 'back',
    swapHint: 'Tap two to swap their places. Hold one for its tag.',
    levelUp: 'Level',
    evolved: 'Turned',
    noMemories: 'Not a single lot redeemed.',
    tutorialTap: 'Tap the screen — line by line.',
    tutorialChoice: 'Choose below. Some options you will never see.',
    tutorialBattle: 'Tap your card, then an enemy. The front row shields the back.',
    skip: 'Skip',
    /* The Remembrance Book (docs/CODEX.md) */
    codexOpen: 'The Remembrance Book',
    codexCount: 'recorded',
    codexEmpty: 'No one is recorded yet.',
    codexYou: 'You',
    codexBack: 'To the list',
    codexReturn: 'Back to the ceremony',
    codexSourceSeen: 'seen',
    codexSourceHeard: 'as told',
    codexSourceAfterDeath: 'after your death',
    codexSourceLast: 'last',
    codexAdded: 'Recorded in the Book',
    /* Recruit tag (КАНОН_КРАТКО §9, REVIEW_GAMEPLAY §2.П1) */
    recruitCan: 'What they do in a fight',
    recruitPlace: 'Place in the line',
    recruitNoAbilities: 'Keeps out of the fighting.',
  },
} as const;

/**
 * Слова нрава для бирки вербовки: трейт юнита → одно-два слова.
 *
 * Названы только те трейты, которые игроку и правда что-то говорят. Служебные
 * (`life_*`, `pole_*` — привязка к прошлой жизни и к полюсу оси) сюда не
 * попадают намеренно: числа и оси личности игроку не показываются никогда
 * (КАНОН_КРАТКО §7). Незнакомый трейт просто не показывается — новый тег в
 * данных ничего не ломает.
 */
export const traitWords: Record<string, LocalizedText> = {
  fighter: { ru: 'бьётся', en: 'fights' },
  breaker: { ru: 'крушит', en: 'breaks things' },
  shield: { ru: 'прикрывает', en: 'shields' },
  guard: { ru: 'сторожит', en: 'guards' },
  healer: { ru: 'лечит', en: 'mends' },
  shooter: { ru: 'бьёт издали', en: 'strikes from afar' },
  mage: { ru: 'ворожит', en: 'works charms' },
  echo: { ru: 'из памяти', en: 'out of memory' },
  starter: { ru: 'с тобой с начала', en: 'with you from the start' },
  no_back_row: { ru: 'только впереди', en: 'front row only' },
  fear: { ru: 'пугает', en: 'frightens' },
  mirage: { ru: 'морочит', en: 'deceives the eye' },
  reveals_intent: { ru: 'видит наперёд', en: 'sees it coming' },
  heals_enemies: { ru: 'лечит и чужих', en: 'mends foes too' },
};

export type UiKey = keyof (typeof ui)['ru'];

export function t(lang: Lang, key: UiKey): string {
  return ui[lang][key];
}

export function loc(text: LocalizedText | undefined, lang: Lang): string {
  if (!text) return '';
  return text[lang] || text.ru;
}

const LANG_KEY = 'nameless:lang';

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    // приватный режим — обойдёмся значением по умолчанию
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'ru';
  return nav.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // не критично
  }
}
