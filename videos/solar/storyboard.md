# «Солнечная система» (детское, 30 с) — пример из первой версии пайплайна

Озвучки в репозитории нет (тайминги считаются по длине текста). Дубль голоса Marina: https://elevenlabs.io/app/flows/QgZUJlJLmszkfxxQ6XLS
Чтобы подключить голос по новому пайплайну, добавьте `script.json` + `voice/narration.mp3` + `voice/words.json` и переведите `video.js` на `narration()` (как в `videos/basilisk`).

## Video 2 — «Солнечная система» (kids)

**One thread:** a little rocket with an original kid astronaut (round helmet, orange suit) flies a tour. Every planet is a friendly round character that reacts as the rocket passes.

**Palette:** bright: violet-blue space (#2a2a7a → #4b3fb0), warm sun yellow/orange, candy colors for planets.

### Script (RU, slower, ~60 words)
1. Привет! Полетели в космос — знакомиться с Солнечной системой!
2. В центре — Солнце. Это огромная звезда, и она нас греет.
3. Вокруг него кружат восемь планет.
4. Меркурий, Венера, Земля — наш дом — и красный Марс.
5. Дальше — великаны! В Юпитер поместилось бы больше тысячи Земель!
6. Сатурн с кольцами, Уран и Нептун.
7. Вот она, наша космическая семья! Пока-пока!

### Scenes

**K1 Launch (line 1)**
- a) Astronaut waves on a launch pad; rocket lifts; camera follows up through clouds into space. ✔
- b) Rocket already in space.
- c) Kid in bedroom with a toy rocket.
→ **a**: clear start of the journey. Clouds = foreground parallax with blur. SFX: countdown beep, launch rumble, whoosh through clouds.

**K2 The Sun (line 2)**
- a) A big smiling Sun fills the frame; its glow pulses; the astronaut puts on sunglasses. ✔
- b) Thermometer.
- c) Sun drawn by a crayon.
→ **a**: funny and kid-readable "it's hot". Camera slow arc. SFX: warm shimmer, "cling" on sunglasses.

**K3 Eight orbits (line 3)**
- a) Pull back to a tilted view; 8 orbit rings draw on; planets pop in and orbit; a counter "8" bounces. ✔
- b) Planets fall like balls.
- c) Planets in a row.
→ **a**: explains "around the Sun". SFX: 8 pops on a rising scale.

**K4 Inner planets (line 4)**
- a) Rocket flies past Mercury, Venus, Earth, Mars — each says hi as it passes; labels pop in. ✔
- b) Cards with photos.
→ **a**: tour continuity. Earth has a moon and waves; Mars is red with a dusty swirl. Camera tracks the rocket; planets come from foreground to background. SFX: a tone per planet (rising melody).

**K5 Giants + Jupiter fact (line 5)**
- a) Jupiter rises huge; tiny Earths pour into it like candy into a jar; counter runs to "1000+". ✔
- b) Size comparison bars.
- c) Jupiter eats a sandwich.
→ **a**: the fact becomes an action. SFX: many tiny pops, counter ticks, "wow" chime.

**K6 Saturn, Uranus, Neptune (line 6)**
- a) Quick pan: Saturn spins its rings like a hula hoop; Uranus rolls on its side; Neptune blue and windy. ✔
- b) Static three.
→ **a**: each gets a true and fun trait (Uranus is tilted on its side — real fact). SFX: whirr, roll, wind.

**K7 Family photo (line 7)**
- a) All planets and the Sun line up; the astronaut takes a selfie; flash; freeze frame with title «Солнечная система». ✔
- b) Rocket flies away.
→ **a**: clear ending and a readable final card. SFX: camera shutter, final chord.

Music: bright, bouncy 120 BPM, major key; marimba/pluck melody + soft bass + light percussion; ending chord on the photo flash.
