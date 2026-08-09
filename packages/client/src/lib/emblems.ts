/**
 * Знаки: кто говорит, чей юнит, что за место.
 *
 * Графика — 700 RPG-иконок Lorc (OpenGameArt, CC BY 3.0), перекрашенные в
 * палитру и склеенные в три спрайт-ленты скриптом
 * `packages/content/assets/ui/nameless/emblems.py`. Здесь только адресация:
 * из ключа получить смещение по ленте.
 *
 * Импорты ТОЧЕЧНЫЕ — три файла по имени, никакого `import.meta.glob` по папкам
 * паков (иначе в сборку уедут все 789 PNG, см. docs/UI_INTEGRATION.md §4).
 *
 * Почему спрайт, а не файл на знак: 57 знаков отдельными PNG — это 57 запросов
 * или 57 data-URI внутри JS-бандла; одной лентой те же знаки весят заметно
 * меньше (zlib жмёт похожие глифы общим словарём) и стоят три запроса.
 */
import speakersUrl from '../../../content/assets/emblems/speakers.png';
import unitsUrl from '../../../content/assets/emblems/units.png';
import placesUrl from '../../../content/assets/emblems/places.png';
import {
  PLACES_ORDER,
  SPEAKERS_ORDER,
  SPEAKER_TONE,
  UNITS_ORDER,
  UNIT_TONE,
} from './emblems.generated';
import type { CSSProperties } from 'react';

const SPEAKER_AT = new Map(SPEAKERS_ORDER.map((k, i) => [k as string, i]));
const UNIT_AT = new Map(UNITS_ORDER.map((k, i) => [k as string, i]));
const PLACE_AT = new Map(PLACES_ORDER.map((k, i) => [k as string, i]));

/**
 * Переменные для CSS. Размер ячейки на экране задаёт CSS (`--mark-s`), здесь
 * только лента, число ячеек и номер нужной — так один и тот же знак можно
 * показать и в 28px портрета, и в 190px водяного знака, не заводя второй файл.
 */
function vars(url: string, count: number, at: number, tone?: string): CSSProperties {
  return {
    '--mark-url': `url(${url})`,
    '--mark-n': count,
    '--mark-i': at,
    ...(tone ? { '--mark-tone': `var(--${tone})` } : {}),
  } as CSSProperties;
}

/**
 * Знак говорящего. Незнакомая роль получает запасной знак «фигура без примет»,
 * а не процедурный капюшон: смешивать в одной ленте два разных способа рисовать
 * лицо — это ровно то, из-за чего экран выглядит «из разных игр».
 */
export function speakerEmblem(speakerId: string): CSSProperties {
  const at = SPEAKER_AT.get(speakerId) ?? SPEAKER_AT.get('unknown') ?? 0;
  const tone = SPEAKER_TONE[speakerId] ?? SPEAKER_TONE['unknown'] ?? 'text-faint';
  return vars(speakersUrl, SPEAKERS_ORDER.length, at, tone);
}

/**
 * Знак на карточке юнита. Сначала личный знак спутника, потом знак дома:
 * институт говорит одним лицом, спутник — своим (см. таблицу UNITS в
 * `emblems.py`). Юнит без того и другого знака не получает — лучше пусто,
 * чем чужой предмет.
 */
export function unitEmblem(
  unitId: string | undefined,
  faction: string | undefined,
): CSSProperties | undefined {
  const key = (unitId && UNIT_AT.has(unitId) ? unitId : faction) ?? '';
  const at = UNIT_AT.get(key);
  if (at === undefined) return undefined;
  return vars(unitsUrl, UNITS_ORDER.length, at, UNIT_TONE[key]);
}

/**
 * Знак места. Ключи сцен и боёв разбираются по имени: в id уже записано, где
 * это происходит, и держать вторую таблицу «сцена → место» рядом с данными
 * (их правит геймдизайнер) значило бы ломать её при каждой новой сцене.
 * Незнакомый id получает знак по умолчанию — башню Ломбарда: город один.
 */
const PLACE_RULES: [RegExp, string][] = [
  // Чулан и последняя смерть — не «прилавок», а срок: игрок просыпается там,
  // где кончился предыдущий он. Знак места здесь называет не мебель, а время.
  [/chulan|last_death|things_turn/, 'hourglass'],
  [/counter|first_lot|osoka_book/, 'counter'],
  [/appraiser|tminny|reckoning|ledger_hub/, 'hall'],
  [/archive|reading_room|foundation|lowest_shelf|rat_escort/, 'archive'],
  [/vault/, 'vault'],
  [/guild|zhichka|wet_rows/, 'guild'],
  [/revizor|audit|dratva/, 'audit'],
  [/garden|brotherhood|quiet_together|proshchai/, 'garden'],
  [/yard|hire_wall|guard|gate|marauders/, 'gate'],
  [/pier|vytsvet|road|scavengers/, 'road'],
  [/witness|gar_debt|contract/, 'ledger'],
  [/hub|descent/, 'tower'],
];

export function placeKey(sceneOrBattleId: string): string {
  for (const [re, key] of PLACE_RULES) {
    if (re.test(sceneOrBattleId)) return key;
  }
  return 'tower';
}

export function placeEmblem(sceneOrBattleId: string): CSSProperties {
  const at = PLACE_AT.get(placeKey(sceneOrBattleId)) ?? 0;
  return vars(placesUrl, PLACES_ORDER.length, at);
}

/** Знак по прямому ключу места — для экранов без сцены (смерть, опись). */
export function placeEmblemByKey(key: string): CSSProperties {
  const at = PLACE_AT.get(key) ?? 0;
  return vars(placesUrl, PLACES_ORDER.length, at);
}
