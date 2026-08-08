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
    round: 'Раунд',
    memoryLocked: 'Лот закреплён',
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
    close: 'Закрыть',
    saveError: 'Сейв не читается. Начни заново.',
    emptyParty: 'Отряд пуст',
    levelUp: 'Уровень',
    evolved: 'Превращение',
    noMemories: 'Ни одного лота не выкуплено.',
    tutorialTap: 'Коснись экрана — реплика за репликой.',
    tutorialChoice: 'Выбирай снизу. Некоторых вариантов ты не увидишь никогда.',
    tutorialBattle: 'Тапни свою карту, потом врага. Передний ряд прикрывает задний.',
    skip: 'Пропустить',
  },
  en: {
    title: 'The Nameless',
    subtitle: 'Deposit the First',
    continue: 'Continue',
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
    round: 'Round',
    memoryLocked: 'Lot redeemed',
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
    close: 'Close',
    saveError: 'Save unreadable. Start over.',
    emptyParty: 'No one follows you',
    levelUp: 'Level',
    evolved: 'Turned',
    noMemories: 'Not a single lot redeemed.',
    tutorialTap: 'Tap the screen — line by line.',
    tutorialChoice: 'Choose below. Some options you will never see.',
    tutorialBattle: 'Tap your card, then an enemy. The front row shields the back.',
    skip: 'Skip',
  },
} as const;

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
