# Движок: как устроен проект и как писать сцены

```
engine/
  lib.js            камера, параллакс, DOF, motion blur, фигуры, звёзды, зерно, narration()
  index.html        загрузчик: engine/index.html?v=<slug> → videos/<slug>/timings.js + video.js
  align.py          голос + words.json → timings.js (+ вставка пауз pause_before)
  tts_elevenlabs.py озвучка и тайминги через REST API ElevenLabs
  dump_events.py    VIDEO.events() → out/<slug>/events.json
  mix.py            score.py + голос → дакинг → out/<slug>/mix.wav (+ стемы)
  render.py         все кадры i/60 через Chromium → out/<slug>/video.mp4 (мастер, crf 16)
  finish.py         перекодирование (crf 20) + звук −14 LUFS → <slug>.mp4, <slug>_720p.mp4, <slug>.srt
  preview.py        отдельные кадры + контактный лист out/<slug>/preview/sheet.jpg
  build.py          всё подряд
  audio/instruments.py   синтезаторы и SFX на numpy/scipy
videos/<slug>/ script.json, storyboard.md, video.js, score.py, voice/, timings.js
```

## Время и синхронизация
- Рендер детерминированный: кадр = чистая функция времени `t`. Никакого состояния между кадрами, никакого `Math.random()` — только `rng(seed)`.
- `const N = narration()` читает `window.TIMINGS`. `at(lineId, 'слово', n)` — время начала n-го слова в строке, начинающегося с этого префикса.
- Границы сцен `Bd` считаются от строк: середина паузы перед строкой, но не позже 0.25 с до первого слова.
- В сцене время локальное `u = t - Bd[i]`, длительность `d`. Хелпер: `const L = (id, n = 0) => lw('<lineId>', id, n);` → `L('слово')` — локальное время слова.
- ⚠ Поиск по **префиксу и первому совпадению**: «и» найдёт «идея», «кто» найдёт первое «кто» в строке, «не» — первое «не». Для повторов указывай `n` или якорись на соседнее уникальное слово. И не забудь второй параметр в `L` — `const L = id => …` молча ломает `L('слово', 1)` и камера улетает.

## Примитивы lib.js
- Хелперы времени: `seg(u, a, b)` → 0..1; `clamp`, `lerp`; изинги `E.out3`, `E.inOut`, `E.outBack(x, s)`, `E.in3`, `E.outElastic`.
- `camKeys(keys, u)` → `{x, y, z, r}` (Эрмит-сплайн без остановок на ключах); `applyCam(ctx, cam, parallax)`.
- `layer(ctx, blurPx, g => {...})` — слой с размытием (DOF) в половинном разрешении.
- Фигуры: `circle`, `rrect`, `ball(ctx, x, y, r, base, shadowColor, light, ang)` (шар с тенью-луной), `shaded(ctx, pathFn, base, dark, dx, dy)` (любая форма с плоской тенью; `pathFn(g, cont)` не вызывает `beginPath`, если `cont`), `glow(ctx, x, y, r, color, a)`.
- Цвет: `mix(hexA, hexB, t)` → `rgb()`, `rgba(hex, a)`.
- Звёзды: `makeStars(seed, n, w, h, rMin, rMax)` + `drawStars`. Зерно: `grain(ctx, t, 0.07)` в `drawOverlay`.
- `makeRenderer(canvas, drawScene, drawOverlay, mbFn)` — motion blur накоплением субкадров: `mbFn(t) → {n, shutter}`. n=2 по умолчанию, 6 — только ±0.5 с вокруг быстрых переходов (иначе рендер в разы дольше).

В `template/videos/basilisk/video.js` уже есть готовые: `sky`, `vignette`, `dust`, `fadeBlack`, `flash`, `pop`, `shake`, `eye` (глаз со зрачком-щелью), `dude` (герой), `mini` (толпа), `ideaOrb`, `bulb`, `heart`, `gear`, `envelope`, `aiCore`, `serpent`/`serpentHead`, `earth`, `virus`, `hourglass`, `forumCard`, `kineticWord`, `label`, `badge`. Копируй и переиспользуй.

## Шаблон сцены
```js
function s6(ctx, u, d, t) {
  const L = (id, n = 0) => lw('threat', id, n);
  const turn = E.inOut(seg(u, L('жуткий') - 0.2, L('поворот') + 0.3));          // состояние, завязанное на слова
  const cam = camKeys([{ t: 0, v: [1100, 560, 0.85, 0] },
                       { t: L('знал'), v: [800, 600, 1.0, 0.01] },
                       { t: d, v: [800, 620, 1.0, 0.01] }], u);
  sky(ctx, cam, t, { top: mix(PAL.bg0, '#1a0620', turn) });                     // фон с параллаксом
  ctx.save(); applyCam(ctx, cam, 1);
  // ... герои, предметы: появление pop(u, L('слово')), смена эмоции, реакции
  ctx.restore();
  dust(ctx, cam, t);                                                            // передний план в размытии
  vignette(ctx, 0.6);
}
```
Каждая сцена: фон с глубиной → главный объект → реакции → передний план → виньетка. Вход/выход — продолжение движения в соседнюю сцену (общий мир, match cut, нырок) или короткий fade на смене мира.

## Звук
- `VIDEO.events()` возвращает `{events:[{n, t, d?, i?}], Bd, END}` — каждое значимое действие = событие на слове (`at(...)`).
- `score.py` → `def score(ev, END): return music, sfx` (стерео numpy). Музыка — функцией `section(bus, t0, t1, chords, roots, gain, cutoff, arp, kick, hats, snap_, marim)` по драматургии: тёмный эмбиент (Dm) → нарастание с арпеджио → пульс угрозы с бочкой → **полная тишина на ударной фразе** → драйв → светлый мажор (F) для «хороших новостей» → рассвет → колыбельная → финальный низкий удар.
- SFX — ветки `elif n == '...'` с инструментами из `instruments.py`: `pop`, `whoosh`, `thud`, `bell`, `glock`, `zap`, `shatter`, `riser`, `hiss`, `click`, `boing`, `kick`, `snap`, `hat`, `pad_note`, `pluck`, `marimba`.
- `MASTER = {'duck': 0.6, 'mgain': 0.45, 'sgain': 0.6}` — дакинг музыки под голос и общий баланс.

## Команды
```bash
python3 engine/align.py <slug>
python3 engine/preview.py <slug> 3 12.5 40 90       # кадры → out/<slug>/preview/sheet.jpg
python3 engine/dump_events.py <slug> && python3 engine/mix.py <slug>
python3 engine/render.py <slug> [t0 t1] --pages 4   # ≈9–10 кадров/с на 4 ядрах
python3 engine/finish.py <slug>
python3 engine/build.py <slug>                      # всё сразу
node --check videos/<slug>/video.js                 # быстрая проверка синтаксиса
```
