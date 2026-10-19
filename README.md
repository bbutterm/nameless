# Контент-фабрика: научпоп-ролики кодом

Ориентир по стилю — Kurzgesagt: плоский вектор без контуров, глубокий индиго + неон, звёзды и частицы, живая камера, кинетическая типографика. Персонажи, палитра и кадры — свои.

**Как делается ролик:** сценарий → озвучка в ElevenLabs → тайминги каждого слова (ElevenLabs Scribe) → анимация на HTML Canvas, синхронизированная со словами → музыка и звуковые эффекты синтезируются Python-кодом по событиям анимации → Chromium рендерит каждый кадр → FFmpeg собирает MP4 1080p60 + SRT.

## Готовые ролики

| Ролик | Длина | Папка |
|---|---|---|
| Василиск Роко (ИИ) | 2:48 | `videos/basilisk/` |
| Солнечная система (детский, пример v1, без голоса) | 0:31 | `videos/solar/` |

## Установка

```bash
pip install -r requirements.txt        # numpy scipy pillow playwright
python3 -m playwright install chromium # или задайте CHROMIUM_PATH на любой Chromium
npm install                            # шрифты Unbounded / Montserrat / Nunito
# нужен ffmpeg
```

## Сборка

```bash
python3 engine/build.py basilisk        # выравнивание → события → звук → рендер → out/basilisk/basilisk.mp4 + .srt
python3 engine/preview.py basilisk 12 40.5 90   # отдельные кадры + контактный лист (быстро)
python3 engine/render.py basilisk 75 92         # отрендерить только кусок
```

Результаты — в `out/<ролик>/` (в git не попадают): `<ролик>.mp4`, `<ролик>.srt`, `mix.wav`, стемы музыки и SFX, превью.

## Структура

```
engine/                  общий движок
  lib.js                 камера-сплайн, параллакс, DOF-слои, motion blur, зерно, narration() — тайминги слов
  index.html             загрузчик: index.html?v=<ролик>
  align.py               голос + слова Scribe → videos/<v>/timings.js (+ паузы между блоками)
  dump_events.py         VIDEO.events() → out/<v>/events.json
  mix.py                 videos/<v>/score.py + голос → дакинг → out/<v>/mix.wav
  render.py              детерминированный рендер всех кадров i/60 → H.264
  finish.py              сведение, громкость −14 LUFS, SRT
  build.py               всё подряд
  audio/instruments.py   синтезаторы и SFX (пэды, плаки, маримба, колокола, вжухи, удары…)
videos/<ролик>/
  script.json            текст: для озвучки (say) и для субтитров (text), паузы, голос
  storyboard.md          раскадровка: варианты сцен и выбранный
  video.js               сцены (canvas) + VIDEO.events() для звука
  score.py               музыка и саунд-дизайн
  voice/narration.mp3    выбранный дубль ElevenLabs
  voice/words.json       тайминги слов (ElevenLabs Scribe)
  timings.js             генерируется align.py
.claude/skills/vizavi-motion/   скилл режиссуры motion-роликов (раскадровка, качество, итерации)
```

Подробная инструкция для работы с Claude — в `CLAUDE.md`.
