# Атрибуция

Вся временная графика и звук в проекте — либо сгенерированы кодом, либо взяты
из свободных источников. Этот файл существует, чтобы при замене на финальный арт
было понятно, что откуда и что можно выбрасывать.

## Шрифты

| Шрифт | Начертания | Лицензия | Источник |
|---|---|---|---|
| Playfair Display | 700 (latin + cyrillic) | SIL Open Font License 1.1 | Google Fonts |
| PT Sans | 400, 700 (latin + cyrillic) | SIL Open Font License 1.1 | Google Fonts |

Файлы: `packages/content/assets/fonts/*.woff2`, подключение — в
`packages/content/assets/palette.css`.

## Заимствованная графика

| Что | Источник | Лицензия | Где лежит |
|---|---|---|---|
| 24 иконки способностей и намерений | game-icons.net (авторы Lorc, Delapouite) | **CC BY 3.0 — атрибуция обязательна** | `packages/content/assets/icons/*.svg` |
| 700 RPG-иконок | Lorc, через OpenGameArt | **CC BY 3.0 — атрибуция обязательна** | `packages/content/assets/icons/oga-700-rpg-icons/` |
| Fantasy UI Borders | Kenney | CC0 | `packages/content/assets/ui/fantasy-ui-borders/` |
| UI Pack (RPG Expansion) | Kenney | CC0 | `packages/content/assets/ui/ui-pack-rpg-expansion/` |
| UI Pack — Adventure | Kenney | CC0 | `packages/content/assets/ui/ui-pack-adventure/` |

**Обязательная строка атрибуции для сборки, которую видит игрок:**

> Иконки: game-icons.net — Lorc, Delapouite (CC BY 3.0).
> RPG-иконки: Lorc, OpenGameArt (CC BY 3.0).
> Интерфейс: Kenney (CC0).

Ссылки: https://game-icons.net/ · https://opengameart.org/content/700-rpg-icons ·
https://kenney.nl/assets/fantasy-ui-borders · https://kenney.nl/assets/ui-pack-rpg-expansion ·
https://kenney.nl/assets/ui-pack-adventure

## Процедурная графика

Всё, что не перечислено выше, сгенерировано кодом — портреты, карточки юнитов,
фоны сцен, иконки PWA. Внешних изображений для них нет.

| Что | Где | Как устроено |
|---|---|---|
| Портреты NPC | `assets/procedural/procedural.ts`, `portraitSvg` | Силуэт в капюшоне, без лица; форма и оттенок выводятся из id говорящего |
| Карточки юнитов | `unitCardSvg` | Силуэт фигуры + рамка тира; оттенок фона — из фракции |
| Рамки по тирам | `frameSvg` | Толщина обводки и декор растут с тиром |
| Иконки способностей | `iconSvg` и `client/src/components/Icon.tsx` | 24×24, одна толщина линии, без заливок |
| Фоны сцен | `backgroundSvg` | Градиент и силуэты свай; расстановка выводится из id сцены |
| Иконки PWA | `client/scripts/make-icons.mjs` | PNG собирается пиксельно средствами `node:zlib`, без зависимостей |

Всё детерминировано: одинаковый id всегда даёт одинаковую картинку, поэтому
внешний вид юнита не «прыгает» между запусками.

## Палитра

Палитра «Заклад» — авторская, не заимствована. 18 цветов, определены один раз в
`packages/content/assets/palette.css` и продублированы как TypeScript-объект
`PALETTE` для процедурной графики. Клиент читает те же переменные.

## Звук

Звука-файлов в проекте нет. Всё синтезируется через WebAudio в
`packages/client/src/lib/sound.ts`: сухой щелчок счётов на реплику, глухой удар
и шум в бою, стеклянный звон склянки при закреплении лота. Причина — в
`docs/EXPERIMENTS.md`: разнородные сэмплы звучат «из разных игр» так же, как
разнородная графика выглядит, и весят несравнимо больше.

## Что ещё не взято

Список внешних паков, которые подошли бы по стилю, но которые не удалось
скачать из-за сетевой политики окружения, — в `docs/ASSETS_LIST.md`, с полными
ссылками и лицензиями. Ни один из них в репозитории не используется.

## Влияния

Тон проекта ориентируется на дух Disco Elysium, Discworld и Planescape: Torment.
Заимствований нет: ни имён, ни топонимов, ни сущностей, ни механизмов-подписей.
Мир, персонажи, термины и механики оригинальны — см. `docs/CANON.md`, разд. 10
(запреты) и разд. 11 (глоссарий).
