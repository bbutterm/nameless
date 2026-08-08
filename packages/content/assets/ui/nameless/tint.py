#!/usr/bin/env python3
"""
tint.py — перекраска рамок Kenney «Fantasy UI Borders» в палитру «Заклад».

Зачем скрипт, а не CSS-фильтр: исходники Kenney — БЕЛАЯ штриховая графика на
прозрачном фоне. Из белого нельзя получить произвольный цвет ни одним
`hue-rotate()` (у белого нет тона), а `mask-border` для 9-slice-маски есть
только под префиксом `-webkit-` и отсутствует в Firefox. Поэтому цвет палитры
запекается в сам PNG: файл получается 200–400 байт, Vite инлайнит его в CSS
как data-URI, и никакой рантайм-магии не требуется.

Правило §7.1 docs/STYLE.md («один источник цвета») соблюдено: значения ниже —
дословно переменные из packages/content/assets/palette.css, не «похожие».

Запуск (нужен Pillow):  python3 packages/content/assets/ui/nameless/tint.py
Результат детерминирован: один и тот же вход даёт побайтово тот же PNG.
"""

import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PACK = os.path.join(HERE, "..", "fantasy-ui-borders", "PNG", "Default")
BORDER = os.path.join(PACK, "Border")
DIVIDER = os.path.join(PACK, "Divider Fade")

# Палитра «Заклад» — 1:1 из palette.css. Ключ = имя переменной CSS.
PALETTE = {
    "line": "#372f3d",
    "text-faint": "#6b6470",
    "accent-dim": "#8a6f1c",
    "tier-1": "#6b6470",
    "tier-2": "#a8935c",
    "tier-3": "#8fd6d1",
    "memory": "#7fd3d0",
}


def tint(img: Image.Image, hex_color: str) -> Image.Image:
    """Красит непрозрачные пиксели в один цвет, альфу (в т.ч. полутона) сохраняет."""
    rgb = tuple(int(hex_color[i : i + 2], 16) for i in (1, 3, 5))
    src = img.convert("RGBA")
    alpha = src.getchannel("A")
    flat = Image.new("RGB", src.size, rgb)
    out = flat.convert("RGBA")
    out.putalpha(alpha)
    return out


def save(img: Image.Image, name: str) -> None:
    path = os.path.join(HERE, name)
    img.save(path, optimize=True)
    print(f"{name:26} {img.size[0]}×{img.size[1]}  {os.path.getsize(path)} B")


def border(num: str, color_key: str, name: str) -> None:
    src = Image.open(os.path.join(BORDER, f"panel-border-{num}.png"))
    save(tint(src, PALETTE[color_key]), name)


def divider(num: str, color_key: str, name: str) -> None:
    """Половинка разделителя Kenney зеркалится сама в себя — получается
    симметричный орнамент по центру и затухание к обоим краям."""
    half = Image.open(os.path.join(DIVIDER, f"divider-fade-{num}.png")).convert("RGBA")
    w, h = half.size
    whole = Image.new("RGBA", (w * 2, h), (0, 0, 0, 0))
    whole.paste(half, (0, 0))
    whole.paste(half.transpose(Image.FLIP_LEFT_RIGHT), (w, 0))
    save(tint(whole, PALETTE[color_key]), name)


if __name__ == "__main__":
    # Рамки карт по тирам: форма и цвет растут вместе с тиром.
    border("015", "tier-1", "frame-tier-1.png")  # голая рамка
    border("001", "tier-2", "frame-tier-2.png")  # + угловые квадраты
    border("002", "tier-3", "frame-tier-3.png")  # + угловые узлы
    # Панели и кнопки — та же форма 001, три тона по громкости элемента.
    border("001", "line", "frame-panel.png")  # стопка кнопок выбора: тихо
    border("001", "text-faint", "frame-panel-lit.png")  # одиночные мелкие цели
    border("001", "accent-dim", "frame-accent.png")  # активное/главное
    # Рамка «памяти» на экране смерти — форма тира 3 в цвете --memory.
    border("002", "memory", "frame-memory.png")
    # Разделитель между сторонами боя и по верхней кромке листа описи.
    divider("004", "text-faint", "divider-ornate.png")
