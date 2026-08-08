# ASSETS_LIST — реестр графических ассетов «Безымянного»

Статус на 2026-08-08. Все пути — относительно `packages/content/assets/`.

## Как это работает

Базовый слой графики — **процедурный** (`procedural/procedural.ts`): чистые
детерминированные функции, генерирующие SVG на лету из id/seed, без сети и
без зависимостей. Он работает всегда и не требует скачанных файлов. Реальные
арты и внешние паки, перечисленные ниже, — **улучшение поверх** этого слоя:
если файл лежит в нужной папке под ожидаемым именем — клиент подхватывает
его вместо процедурной заглушки (см. `cards/README.md` для портретов юнитов).

## Скачано и лежит в репозитории

| Файл | Что это | Источник | Статус |
|---|---|---|---|
| `fonts/playfair-700-lat.woff2` | Playfair Display, начертание 700, латиница | Google Fonts — https://fonts.google.com/specimen/Playfair+Display (OFL) | скачан |
| `fonts/playfair-700-cyr.woff2` | Playfair Display, начертание 700, кириллица | Google Fonts — https://fonts.google.com/specimen/Playfair+Display (OFL) | скачан |
| `fonts/ptsans-400-lat.woff2` | PT Sans, начертание 400, латиница | Google Fonts — https://fonts.google.com/specimen/PT+Sans (OFL) | скачан |
| `fonts/ptsans-400-cyr.woff2` | PT Sans, начертание 400, кириллица | Google Fonts — https://fonts.google.com/specimen/PT+Sans (OFL) | скачан |
| `fonts/ptsans-700-lat.woff2` | PT Sans, начертание 700, латиница | Google Fonts — https://fonts.google.com/specimen/PT+Sans (OFL) | скачан |
| `fonts/ptsans-700-cyr.woff2` | PT Sans, начертание 700, кириллица | Google Fonts — https://fonts.google.com/specimen/PT+Sans (OFL) | скачан |
| `procedural/procedural.ts` | Генератор портретов/арта карт/иконок/рамок/фонов | Собственный код проекта, без внешних источников | готово |
| `procedural/samples/**/*.svg` | Примеры вывода генератора (портреты, карты, рамки, иконки, фоны) | Сгенерировано локально функциями `procedural.ts` | готово |
| `palette.css` | Единая палитра проекта + `@font-face` | Авторские значения, согласованные с `packages/client/src/theme.css` | готово |

Суммарный вес скачанных файлов: 6 файлов шрифтов, ≈211 КБ суммарно (наибольший
файл — `ptsans-700-lat.woff2`, 47 КБ) — далеко в пределах лимита 300 КБ/файл
и 10 МБ на весь набор.

## Не скачано — сетевые ограничения окружения

Важно: в этой рабочей среде исходящий HTTPS для произвольных доменов
проходит через политику-прокси, которая **блокирует** hosts вне списка
пакетных реестров (npm/pypi/crates/…) кодом 403 — проверено вживую на
`game-icons.net`, `kenney.nl`, `opengameart.org` (все три — `403 policy
denial`). Значит бинарные файлы (zip/png/svg-паки) с внешних сайтов
физически нельзя скачать из этой сессии в принципе, вне зависимости от
времени поиска. Ниже — то, что нашлось поиском и годится по стилю (тёмный
мрачный фэнтези-UI, без ярких мультяшных цветов) — **скачать вручную** и
положить в указанную папку.

### Что найти руками

| Что нужно | Куда класть | Источник (ссылка) | Лицензия | Статус |
|---|---|---|---|---|
| UI-панели, рамки окон, кнопки (тёмное фэнтези) | `ui/` | Kenney — Fantasy UI Borders — https://kenney.nl/assets/fantasy-ui-borders | CC0 | скачать вручную |
| UI-кит общего назначения (кнопки, полосы, иконки статов) | `ui/` | Kenney — UI Pack (RPG Expansion) — https://kenney.nl/assets/ui-pack-rpg-expansion | CC0 | скачать вручную |
| UI-кит «Adventure» (свитки, рамки диалогов) | `ui/` | Kenney — UI Pack - Adventure — https://kenney.nl/assets/ui-pack-adventure | CC0 | скачать вручную |
| Иконки способностей (расширение набора из `procedural.ts`, если 24 базовых не хватит) | `icons/` | game-icons.net — https://game-icons.net/ (4180+ SVG, фильтр по тегам «medieval-fantasy», «weapons», «magic») | CC BY 3.0 — требуется атрибуция при использовании | скачать вручную |
| Иконки способностей, альтернативный источник без атрибуции | `icons/` | OpenGameArt — 700+ RPG Icons — https://opengameart.org/content/700-rpg-icons | см. страницу пака (обычно CC0/CC-BY, уточнить на месте) | скачать вручную |
| Готовые рамки карточек юнитов (тёмное фэнтези, модульные PNG+SVG) | `frames/` | itch.io — Dark Fantasy Card Frames – Deckbuilder & RPG UI Pack (найдено поиском, автора уточнить на странице) — https://itch.io/game-assets/tag-card-game/tag-frame | уточнить на странице пака перед использованием | скачать вручную |
| Фоны сцен (диалог/бой), пиксель-арт с parallax слоями | `backgrounds/` | CraftPix — Free Fantasy Cartoon Game Backgrounds — https://craftpix.net/freebies/free-fantasy-cartoon-game-backgrounds/ | royalty-free (см. лицензию CraftPix freebies) | скачать вручную |
| Фоны сцен, альтернатива с parallax-слоями подземелья/руин | `backgrounds/` | CraftPix — Horizontal Pixel Art Backgrounds Collection — https://craftpix.net/sets/horizontal-pixel-art-backgrounds-collection/ | проверить: часть коллекции платная | скачать вручную |
| Иконки-заглушки альтернативного стиля (пиксель) | `icons/` | itch.io — Shikashi's Fantasy Icons Pack (FREE) — https://shikashipx.itch.io/shikashis-fantasy-icons-pack | см. страницу (обычно free/donation) | скачать вручную |

**Перед использованием любого стороннего пака**: проверить лицензию на
самой странице (некоторые «free»-паки на itch.io требуют атрибуции или
запрещают коммерческое использование), и убедиться, что стиль не спорит с
`docs/STYLE.md` (тёмная палитра, одна толщина линии на иконках, не
мультяшный пиксель-арт с яркими цветами). При сомнении — не тащить в repo,
оставить процедурную графику как есть: она уже покрывает все роли и ничего
не сломает.

## Папки-назначения (пока пустые, кроме samples/)

| Папка | Что туда кладут | Формат |
|---|---|---|
| `ui/` | Панели, кнопки, декоративные рамки окон | svg/png, ≤300 КБ/файл |
| `icons/` | Дополнительные иконки способностей сверх 24 базовых из `procedural.ts` | svg, viewBox 24×24 |
| `frames/` | Альтернативные/дополненные рамки карточек (см. также `procedural/samples/frames/` — процедурный вариант уже есть) | svg/png |
| `backgrounds/` | Фоны сцен диалога/боя | svg/png/webp, ≤300 КБ/файл |
| `cards/` | Портреты юнитов от пользователя — см. `cards/README.md`, единственная папка не под управлением Агента 8 (только README) | webp/png 3:4 |
