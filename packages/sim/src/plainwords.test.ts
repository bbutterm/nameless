import { describe, expect, it } from 'vitest';
import {
  checkNames,
  checkScene,
  SKIPPED_SCENES,
  tierAHits,
  tierBHits,
  tierBLimit,
  visibleLines,
} from '../../../tools/plainwords.mjs';

/**
 * Проверка исключений §7 `docs/ПЕРЕХОД.md`. Тесты стоят именно на них, а не
 * на «ловит ли скрипт слово ломбард»: словарь ловит очевидное и без надзора,
 * а вот исключения — та часть, где прибор легко сделать бесполезным. Скрипт,
 * который считает имя города вывеской, заставит переименовать Заклад; скрипт,
 * который читает id файлов, потребует переименовать `lombard_yard.json`
 * вопреки канону §6 п. 6. И то и другое — прямой вред.
 */
describe('исключения словаря (ПЕРЕХОД §7)', () => {
  it('«Заклад» с прописной — топоним, не считается', () => {
    expect(tierAHits('В Закладе к вечеру пусто. Заклад стоит на сваях.', 'ru')).toEqual([]);
  });

  it('«закладский» — прилагательное топонима, не считается', () => {
    expect(tierAHits('закладский мостик, закладская сырость', 'ru')).toEqual([]);
  });

  it('«заклад» со строчной — тир А', () => {
    expect(tierAHits('Взять держателя заклада.', 'ru').map((h) => h.root)).toEqual(['заклад']);
  });

  it('«Закладная» — тир А, и прописная её не спасает', () => {
    expect(tierAHits('Закладной договор', 'ru').map((h) => h.root)).toEqual(['закладн']);
  });

  it('Ревизор остаётся человеком, Ревизия — институт и тир А', () => {
    expect(tierAHits('Ревизор в сером пальто', 'ru')).toEqual([]);
    expect(tierAHits('Ревизия придёт в среду', 'ru').map((h) => h.root)).toEqual(['ревизи']);
  });

  it('английское зеркало ищется в en, русские основы — в ru', () => {
    expect(tierAHits('The Pawnshop keeps the pledge', 'en').map((h) => h.root)).toEqual([
      'pawn',
      'pledge',
    ]);
    expect(tierAHits('Read the price list', 'en').map((h) => h.root)).toEqual(['price list']);
  });

  it('id узлов, id сцены и имена файлов не читаются', () => {
    const scene = {
      id: 'lombard_yard',
      title: { ru: 'Задний двор', en: 'Back Yard' },
      nodes: [
        {
          kind: 'narration',
          id: 'pledge_note_deposit',
          text: { ru: 'Двое делят на вес вещи.', en: 'Two men split things by weight.' },
          keywords: [{ match: { ru: 'вещи', en: 'things' }, tone: 'lore' }],
          next: 'end',
        },
        {
          kind: 'choice',
          id: 'audit_choice',
          options: [
            { id: 'stay_silent', text: { ru: 'Промолчать.', en: 'Stay silent.' }, to: 'end' },
            { id: 'pawnshop_speak', text: { ru: 'Встать поперёк.', en: 'Step in.' }, to: 'end' },
          ],
        },
      ],
    };
    const r = checkScene(scene);
    expect(r.tierA).toEqual([]);
    expect(visibleLines(scene).map((l) => l.text)).not.toContain('pledge_note_deposit');
  });

  it('`silver_counter` пропускается до физического удаления', () => {
    expect(SKIPPED_SCENES.has('silver_counter')).toBe(true);
  });
});

describe('пороги словаря (ПЕРЕХОД §6)', () => {
  it('потолок 6 держит короткие сцены, длинные считаются по формуле', () => {
    expect(tierBLimit(0)).toBe(6);
    expect(tierBLimit(750)).toBe(6);
    expect(tierBLimit(1000)).toBe(8);
    expect(tierBLimit(2000)).toBe(16);
  });

  it('тир Б берёт падежи, но не однокоренных чужаков', () => {
    expect(tierBHits('Лот сорок: опись и графа').map((h) => h.root)).toEqual([
      'лот',
      'опись',
      'графа',
    ]);
    // «лоток» и «сверкает» — не канцелярия, и наказывать за них нельзя:
    // ложное красное учит вычёркивать записи не глядя.
    expect(tierBHits('лоток сверкает на солнце')).toEqual([]);
  });

  it('больше двух слов тира Б в одной реплике — нарушение', () => {
    const scene = {
      id: 'проба',
      title: { ru: 'Проба', en: 'Test' },
      nodes: [
        {
          kind: 'narration',
          id: 'n1',
          text: { ru: 'Опись, графа, бланк.', en: 'x' },
          next: 'end',
        },
        { kind: 'narration', id: 'n2', text: { ru: 'Опись и графа.', en: 'x' }, next: 'end' },
      ],
    };
    const r = checkScene(scene);
    expect(r.perLine.map((l) => l.where)).toEqual(['n1']);
    expect(r.tierB).toBe(5);
  });
});

describe('правило шести словарей: имена юнитов', () => {
  const unit = (ru: string) => ({ name: { ru, en: ru } });

  it('словарь одной силы сверх 20% имён — нарушение', () => {
    const names = checkNames([
      unit('Товарищ по срезу'),
      unit('Сторож при склянках'),
      unit('Полый сержант'),
      unit('Вдова с гребнем'),
      unit('Мальчишка'),
    ]);
    const guild = names.find((n) => n.power === 'Цех');
    expect(guild?.matched).toBe(2);
    expect(guild?.over).toBe(true);
  });

  it('ровно пятая часть — ещё не нарушение', () => {
    const names = checkNames([
      unit('Товарищ по срезу'),
      unit('Полый сержант'),
      unit('Вдова'),
      unit('Мальчишка'),
      unit('Возчик'),
    ]);
    expect(names.find((n) => n.power === 'Цех')?.share).toBeCloseTo(0.2);
    expect(names.find((n) => n.power === 'Цех')?.over).toBe(false);
  });
});
