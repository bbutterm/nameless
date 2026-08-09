/*
 * СГЕНЕРИРОВАНО. Не править руками.
 * Источник: packages/content/assets/ui/nameless/emblems.py
 * Перегенерация: python3 packages/content/assets/ui/nameless/emblems.py
 *
 * Порядок имён здесь = порядок ячеек в ленте спрайта. Разъедутся —
 * у каждого говорящего окажется чужой знак, и это молча.
 */

export const SPEAKERS_CELL = 96;
export const SPEAKERS_ORDER = [
  'osoka', // раскрытая книга описи: «по описи — всё»
  'tminny', // пенсне старшего оценщика
  'otsenshchik', // лупа младшего за окошком
  'klyost', // бегущий: посыльный, ноги сюжета
  'pisar_chitalni', // перо и чернильница читальни
  'storozh_arkhiva', // фонарь сторожа
  'dratva', // шлем с забралом: устав в лицах
  'strazhnik', // щит на воротах
  'revizor', // казённая печать: «расхождение: одно»
  'svodchik', // остриё пера, которым сводят счёт
  'naryad_revizii', // скрещённые древки наряда
  'proshchai', // росток: «репа сегодня удалась»
  'brat_ogorodnik', // лопата огородника
  'golos_iz_trukhi', // губы без лица: голос из трухи
  'zhichka', // подвеска на скупку: чужое на продажу
  'marodyor', // весы мародёра — он так и зовётся
  'player', // пустой капюшон: серый человек
  'poproshayka', // протянутая ладонь
  'ochered', // трое друг за другом
  'mertvyy_v_ocheredi', // череп: очередь не расходится
  'unknown', // фигура без примет
] as const;

export const UNITS_CELL = 144;
export const UNITS_ORDER = [
  'great_pawnshop', // башня с замочной скважиной
  'greedy_memory_guild', // воровская полумаска
  'clear_head_brotherhood', // лицо с закрытыми глазами
  'street', // нож: улица объясняет коротко
  'echo', // круги отголоска
  'companion', // двое рядом: запасной знак спутника
  'grateful_debtor', // поклон: долг прощён
  'almshouse_sister', // перебинтованный: богадельня
  'throat_taker', // когти горлохвата
  'tar_burner', // котёл смолокура
  'sworn_witness', // поднятая ладонь присяги
  'plain_speaker', // открытый рот: говорит прямо
  'promise_pedlar', // рупор разносчика посулов
  'borrowed_face', // чужое лицо как маска
  'ledger_clerk', // книга счетовода
  'cold_reckoner', // снежинка холодного счёта
  'archive_rat', // паутина нижнего яруса
  'flask_hoarder', // склянка скопидома
  'tight_fist', // кулак
  'pledge_holder', // замок на закладе
  'barefoot_brother', // босая ступня
  'gravedigger_of_things', // гроб для вещей
  'unclaimed_pledge', // узел, за которым не пришли
  'dusty_errand_boy', // конверт посыльного
] as const;

export const PLACES_CELL = 192;
export const PLACES_ORDER = [
  'counter', // окошко приёма
  'hall', // весы оценочного зала
  'archive', // книга на пюпитре
  'vault', // связка ключей
  'tower', // башня Ломбарда
  'ledger', // свиток описи
  'gate', // арка ворот
  'road', // сухое дерево у дороги
  'garden', // грядка Того берега
  'hourglass', // песочные часы чулана
  'guild', // полумаска Мокрых рядов
  'audit', // печать Ревизии
] as const;

/** Тон дома для подложки знака: имя переменной палитры. */
export const SPEAKER_TONE: Record<string, string> = {
  'osoka': 'accent',
  'tminny': 'accent',
  'otsenshchik': 'accent',
  'klyost': 'accent',
  'pisar_chitalni': 'accent',
  'storozh_arkhiva': 'accent',
  'dratva': 'text-dim',
  'strazhnik': 'text-dim',
  'revizor': 'danger',
  'svodchik': 'danger',
  'naryad_revizii': 'danger',
  'proshchai': 'memory',
  'brat_ogorodnik': 'memory',
  'golos_iz_trukhi': 'memory',
  'zhichka': 'lie',
  'marodyor': 'lie',
  'player': 'text-faint',
  'poproshayka': 'text-faint',
  'ochered': 'text-faint',
  'mertvyy_v_ocheredi': 'text-faint',
  'unknown': 'text-faint',
};

export const UNIT_TONE: Record<string, string> = {
  'great_pawnshop': 'accent',
  'greedy_memory_guild': 'lie',
  'clear_head_brotherhood': 'text-dim',
  'street': 'danger',
  'echo': 'memory',
  'companion': 'hp-ally',
  'grateful_debtor': 'hp-ally',
  'almshouse_sister': 'hp-ally',
  'throat_taker': 'hp-ally',
  'tar_burner': 'hp-ally',
  'sworn_witness': 'hp-ally',
  'plain_speaker': 'hp-ally',
  'promise_pedlar': 'hp-ally',
  'borrowed_face': 'hp-ally',
  'ledger_clerk': 'hp-ally',
  'cold_reckoner': 'hp-ally',
  'archive_rat': 'hp-ally',
  'flask_hoarder': 'hp-ally',
  'tight_fist': 'hp-ally',
  'pledge_holder': 'hp-ally',
  'barefoot_brother': 'hp-ally',
  'gravedigger_of_things': 'hp-ally',
  'unclaimed_pledge': 'hp-ally',
  'dusty_errand_boy': 'hp-ally',
};
