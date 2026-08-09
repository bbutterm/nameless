#!/usr/bin/env python3
"""
emblems.py — знаки «Безымянного» из 700 RPG-иконок Lorc (OpenGameArt, CC BY 3.0).

Зачем вообще этот пак. Иконочный слот игры (`packages/client/src/components/Icon.tsx`)
уже занят набором game-icons, и его основной автор — тот же Lorc. Это не «второй
источник формы», а тот же почерк: плотный белый глиф-силуэт без штриховки, читаемый
на 24px. Поэтому 700 иконок отсюда ложатся в игру не как чужой пак, а как расширение
уже принятого языка — при одном условии: они работают ЗНАКАМИ (кто это, где это),
а не иллюстрациями. Правило §7.2 docs/STYLE.md («один источник формы иконок»)
соблюдено, потому что источник — тот же.

Что делает скрипт:

1. Снимает служебную серую рамку исходника (Lorc экспортировал 400×400 с каймой
   в 13px ровного серого 136 — она попадёт в альфу, если её не убрать).
2. Превращает белый глиф на чёрном в одноцветный глиф с альфой: альфа = яркость
   пикселя. Полутона сглаживания сохраняются, поэтому глиф не рвётся на 28px.
3. Красит его в ОДИН цвет из palette.css. Цвет запекается в PNG по той же причине,
   что и у рамок Kenney (см. tint.py): из белого `hue-rotate()` цвета не даёт, а
   `mask-image` + `background-color` пришлось бы дублировать в двух префиксах ради
   одного эффекта, который здесь статичен.
4. Складывает глифы одного назначения в ОДИН спрайт-лист. Это важнее, чем кажется:
   двадцать один отдельный PNG по 2.6 КБ весит 55 КБ и даёт 21 запрос (или 21
   data-URI в JS), а тот же набор одной лентой — 30 КБ и один запрос, потому что
   zlib жмёт похожие глифы общим словарём.
5. Пишет `packages/client/src/lib/emblems.generated.ts` — порядок ячеек и тон дома.
   Руками этот файл не править: порядок ячеек в нём обязан совпадать с порядком
   пикселей в ленте, а единственный способ это гарантировать — генерировать оба
   из одной таблицы ниже.

Запуск (нужен Pillow):  python3 packages/content/assets/ui/nameless/emblems.py
Результат детерминирован: один и тот же вход даёт побайтово те же PNG.

Атрибуция: Lorc, OpenGameArt, CC BY 3.0 — строка на титуле
(`packages/client/src/components/Attribution.tsx`) и `assets/ATTRIBUTION.md`.
"""

import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.abspath(os.path.join(HERE, "..", ".."))
REPO = os.path.abspath(os.path.join(ASSETS, "..", "..", ".."))
LORC = os.path.join(REPO, "art-source", "oga-700-rpg-icons", "789_Lorc_RPG_icons")
OUT_PNG = os.path.join(ASSETS, "emblems")
OUT_TS = os.path.join(REPO, "packages", "client", "src", "lib", "emblems.generated.ts")

# Палитра «Заклад» — 1:1 из palette.css. Ключ = имя переменной CSS без «--».
PALETTE = {
    "accent": "#c9a227",
    "gold": "#d8b34a",
    "memory": "#7fd3d0",
    "lie": "#b06fd0",
    "danger": "#c1483f",
    "text-dim": "#9a90a0",
    "text-faint": "#6b6470",
    "hp-ally": "#6fbf73",
}

# ---------------------------------------------------------------------------
# Таблицы знаков
#
# Формат: (ключ, файл Lorc, тон палитры, комментарий «почему этот знак»).
# Тон — это ДОМ, а не настроение: цвет говорит, чей человек перед тобой,
# глиф — кто именно. Разводить цвета по характерам нельзя, иначе лента диалога
# становится витражом (см. docs/STYLE.md §7 «тест гармонии»).
# ---------------------------------------------------------------------------

# Портреты говорящих. 44×44 в ленте → ячейка 96px (×2 под retina).
SPEAKERS = [
    # Великий Ломбард / Учёт — золото.
    ("osoka", "Icon.2_81.png", "accent", "раскрытая книга описи: «по описи — всё»"),
    ("tminny", "Icon.6_30.png", "accent", "пенсне старшего оценщика"),
    ("otsenshchik", "Icon.4_68.png", "accent", "лупа младшего за окошком"),
    ("klyost", "Icon.4_33.png", "accent", "бегущий: посыльный, ноги сюжета"),
    ("pisar_chitalni", "Icon.4_83.png", "accent", "перо и чернильница читальни"),
    ("storozh_arkhiva", "Icon.3_18.png", "accent", "фонарь сторожа"),
    # Стража — серая сталь.
    ("dratva", "Icon.1_05.png", "text-dim", "шлем с забралом: устав в лицах"),
    ("strazhnik", "Icons8_10.png", "text-dim", "щит на воротах"),
    # Ревизия — цвет угрозы.
    ("revizor", "Icon.6_42.png", "danger", "казённая печать: «расхождение: одно»"),
    ("svodchik", "Icon.4_77.png", "danger", "остриё пера, которым сводят счёт"),
    ("naryad_revizii", "Icon.4_73.png", "danger", "скрещённые древки наряда"),
    # Братство Чистой Головы и голоса памяти — бирюза.
    ("proshchai", "Icon.2_26.png", "memory", "росток: «репа сегодня удалась»"),
    ("brat_ogorodnik", "Icon.3_46.png", "memory", "лопата огородника"),
    ("golos_iz_trukhi", "Icon.6_54.png", "memory", "губы без лица: голос из трухи"),
    # Цех Жадной Памяти и те, кто торгует чужим, — фиолет посула.
    ("zhichka", "Icon.5_84.png", "lie", "подвеска на скупку: чужое на продажу"),
    ("marodyor", "Icon.2_14.png", "lie", "весы мародёра — он так и зовётся"),
    # Безымянные, очередь, ты сам — бледный.
    ("player", "Icon.2_30.png", "text-faint", "пустой капюшон: серый человек"),
    ("poproshayka", "Icon.4_57.png", "text-faint", "протянутая ладонь"),
    ("ochered", "Icon.6_01.png", "text-faint", "трое друг за другом"),
    ("mertvyy_v_ocheredi", "Icon.1_37.png", "text-faint", "череп: очередь не расходится"),
    # Запасной знак для роли, которой ещё нет в реестре говорящих.
    ("unknown", "Icon.4_53.png", "text-faint", "фигура без примет"),
]

# Знак на карточке юнита. 105×140 в бою → ячейка 144px.
#
# Правило простое: ДОМ говорит одним лицом, СПУТНИК — своим.
# Пять домов (Ломбард, Цех, Братство, улица, отголоски) — это институты, и в
# каноне они обезличивают своих: стражник Ломбарда и есть Ломбард. Поэтому у
# дома один знак на всех его юнитов, и цвет знака = цвет дома.
# Восемнадцать спутников — те, кого игрок собирает и обязан различать в своём
# отряде; у каждого свой предмет, тон один на всех (--hp-ally, «мой»), иначе
# отряд превращается в витраж.
# Ключ ищется сначала по id юнита, потом по фракции (см. lib/emblems.ts).
UNITS = [
    # Дома.
    ("great_pawnshop", "Icon.5_81.png", "accent", "башня с замочной скважиной"),
    ("greedy_memory_guild", "Icon.3_90.png", "lie", "воровская полумаска"),
    ("clear_head_brotherhood", "Icon.2_29.png", "text-dim", "лицо с закрытыми глазами"),
    ("street", "Icons8_21.png", "danger", "нож: улица объясняет коротко"),
    ("echo", "Icon.5_74.png", "memory", "круги отголоска"),
    ("companion", "Icons8_39.png", "hp-ally", "двое рядом: запасной знак спутника"),
    # Спутники — по одному предмету на каждого.
    ("grateful_debtor", "Icon.4_09.png", "hp-ally", "поклон: долг прощён"),
    ("almshouse_sister", "Icon.2_59.png", "hp-ally", "перебинтованный: богадельня"),
    ("throat_taker", "Icon.1_13.png", "hp-ally", "когти горлохвата"),
    ("tar_burner", "Icon.2_92.png", "hp-ally", "котёл смолокура"),
    ("sworn_witness", "Icon.5_92.png", "hp-ally", "поднятая ладонь присяги"),
    ("plain_speaker", "Icon.5_88.png", "hp-ally", "открытый рот: говорит прямо"),
    ("promise_pedlar", "Icon.2_57.png", "hp-ally", "рупор разносчика посулов"),
    ("borrowed_face", "Icons8_69.png", "hp-ally", "чужое лицо как маска"),
    ("ledger_clerk", "Icon.2_16.png", "hp-ally", "книга счетовода"),
    ("cold_reckoner", "Icon.2_39.png", "hp-ally", "снежинка холодного счёта"),
    ("archive_rat", "Icon.5_39.png", "hp-ally", "паутина нижнего яруса"),
    ("flask_hoarder", "Icon.1_69.png", "hp-ally", "склянка скопидома"),
    ("tight_fist", "Icon.3_10.png", "hp-ally", "кулак"),
    ("pledge_holder", "Icon.4_18.png", "hp-ally", "замок на закладе"),
    ("barefoot_brother", "Icon.5_56.png", "hp-ally", "босая ступня"),
    ("gravedigger_of_things", "Icon.4_63.png", "hp-ally", "гроб для вещей"),
    ("unclaimed_pledge", "Icon.6_37.png", "hp-ally", "узел, за которым не пришли"),
    ("dusty_errand_boy", "Icon.6_36.png", "hp-ally", "конверт посыльного"),
]

# Знак места: очень бледный водяной знак в пустоте над лентой. Ячейка 192px.
PLACES = [
    ("counter", "Icon.3_97.png", "accent", "окошко приёма"),
    ("hall", "Icon.2_14.png", "accent", "весы оценочного зала"),
    ("archive", "Icon.4_19.png", "accent", "книга на пюпитре"),
    ("vault", "Icon.5_78.png", "accent", "связка ключей"),
    ("tower", "Icon.5_81.png", "accent", "башня Ломбарда"),
    ("ledger", "Icon.5_85.png", "accent", "свиток описи"),
    ("gate", "Icon.3_67.png", "text-dim", "арка ворот"),
    ("road", "Icon.4_96.png", "text-dim", "сухое дерево у дороги"),
    ("garden", "Icon.2_26.png", "memory", "грядка Того берега"),
    ("hourglass", "Icon.2_98.png", "memory", "песочные часы чулана"),
    ("guild", "Icon.3_90.png", "lie", "полумаска Мокрых рядов"),
    ("audit", "Icon.6_42.png", "danger", "печать Ревизии"),
]

SHEETS = [
    ("speakers", SPEAKERS, 96),
    ("units", UNITS, 144),
    ("places", PLACES, 192),
]


def glyph(filename: str) -> Image.Image:
    """Глиф Lorc → маска альфы без служебной рамки.

    Исходник — 400×400, белый глиф на чёрном, вокруг ровная серая кайма.
    Ширину каймы не хардкодим: у части файлов она на пиксель другая, а лишний
    пиксель серого на краю превращается в мутную рамку вокруг знака.
    """
    src = Image.open(os.path.join(LORC, filename)).convert("L")
    w, h = src.size
    px = src.load()

    def row_is_frame(y: int) -> bool:
        return all(100 < px[x, y] < 200 for x in range(0, w, 5))

    def col_is_frame(x: int) -> bool:
        return all(100 < px[x, y] < 200 for y in range(0, h, 5))

    top = 0
    while top < 40 and row_is_frame(top):
        top += 1
    bottom = h - 1
    while bottom > h - 41 and row_is_frame(bottom):
        bottom -= 1
    left = 0
    while left < 40 and col_is_frame(left):
        left += 1
    right = w - 1
    while right > w - 41 and col_is_frame(right):
        right -= 1
    # Ещё пиксель внутрь: край каймы сглажен, и её остаток читается ореолом.
    pad = 2
    return src.crop((left + pad, top + pad, right + 1 - pad, bottom + 1 - pad))


# Ступеней прозрачности на краю глифа. 256 уровней сглаживания — это шум, который
# PNG обязан хранить попиксельно: лента говорящих весит 79 КБ при 256 уровнях и
# 33 КБ при 16. На экране разницы нет — знак показывается в 28px, где весь край
# укладывается в полтора пикселя. Ниже 16 (пробовал 8 и 5) на крупном знаке места
# в 190px край начинает ступенчато «лесенкой», и это уже видно.
ALPHA_LEVELS = 16


def tint(mask: Image.Image, hex_color: str, size: int) -> Image.Image:
    """Маска → одноцветный глиф нужного размера. Кадр Lorc не обрезаем по
    содержимому: он сам по себе выверен оптически, и подрезка по bbox сделала бы
    узкий знак (нож) такого же «веса», как широкий (весы)."""
    rgb = tuple(int(hex_color[i : i + 2], 16) for i in (1, 3, 5))
    alpha = mask.resize((size, size), Image.LANCZOS)
    step = 255 // (ALPHA_LEVELS - 1)
    alpha = alpha.point(lambda v: min(255, round(v / step) * step))
    out = Image.new("RGBA", (size, size), rgb + (0,))
    out.putalpha(alpha)
    return out


def build_sheet(name: str, table: list, cell: int) -> str:
    sheet = Image.new("RGBA", (cell * len(table), cell), (0, 0, 0, 0))
    for i, (_key, filename, tone, _why) in enumerate(table):
        sheet.paste(tint(glyph(filename), PALETTE[tone], cell), (i * cell, 0))
    path = os.path.join(OUT_PNG, f"{name}.png")
    sheet.save(path, optimize=True)
    size = os.path.getsize(path)
    print(f"{name+'.png':16} {len(table):2}×{cell}px  {size:6} B")
    return path


def emit_ts() -> None:
    lines = [
        "/*",
        " * СГЕНЕРИРОВАНО. Не править руками.",
        " * Источник: packages/content/assets/ui/nameless/emblems.py",
        " * Перегенерация: python3 packages/content/assets/ui/nameless/emblems.py",
        " *",
        " * Порядок имён здесь = порядок ячеек в ленте спрайта. Разъедутся —",
        " * у каждого говорящего окажется чужой знак, и это молча.",
        " */",
        "",
    ]
    for name, table, cell in SHEETS:
        const = name.upper()
        lines.append(f"export const {const}_CELL = {cell};")
        lines.append(f"export const {const}_ORDER = [")
        for key, _f, _tone, why in table:
            lines.append(f"  '{key}', // {why}")
        lines.append("] as const;")
        lines.append("")
    lines.append("/** Тон дома для подложки знака: имя переменной палитры. */")
    lines.append("export const SPEAKER_TONE: Record<string, string> = {")
    for key, _f, tone, _why in SPEAKERS:
        lines.append(f"  '{key}': '{tone}',")
    lines.append("};")
    lines.append("")
    lines.append("export const UNIT_TONE: Record<string, string> = {")
    for key, _f, tone, _why in UNITS:
        lines.append(f"  '{key}': '{tone}',")
    lines.append("};")
    lines.append("")
    with open(OUT_TS, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(f"{os.path.relpath(OUT_TS, REPO)}  {os.path.getsize(OUT_TS)} B")


if __name__ == "__main__":
    os.makedirs(OUT_PNG, exist_ok=True)
    total = 0
    for name, table, cell in SHEETS:
        total += os.path.getsize(build_sheet(name, table, cell))
    emit_ts()
    print(f"итого графики: {total} B")
