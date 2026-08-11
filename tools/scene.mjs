/**
 * Прыжок прямо в сцену: покажи мне вот эту, сейчас.
 *
 * Зачем. До этого скрипта увидеть свою правку можно было только одним
 * способом — доиграть до неё с начала. Для сценариста это убивает работу:
 * между «поправил слово» и «увидел слово» проходили минуты, и каждый прогон
 * шёл через выборы, которые к правке отношения не имеют.
 *
 * Как. Игра начинает забег честно, записывает сейв — и мы подменяем в нём
 * место: сцену и узел. Всё остальное игра выводит сама. Это тот же приём,
 * которым `powerbar.mjs` подкладывает память, и у него то же свойство:
 * если игра не выведет остальное, это и будет находкой.
 *
 * Запуск:
 *   node tools/scene.mjs <сцена> [узел] [ширина] [высота]
 *   node tools/scene.mjs hearth_reckoning
 *   node tools/scene.mjs skhod golos_empty 360 640
 *
 * Адрес сервера — в SCENE_URL (по умолчанию http://localhost:4173).
 * Снимки кладутся в /tmp/сцены/<сцена>.png.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const scene = process.argv[2];
const node = process.argv[3] && !/^\d+$/.test(process.argv[3]) ? process.argv[3] : undefined;
const rest = process.argv.slice(node ? 4 : 3);
const width = Number(rest[0] ?? 390);
const height = Number(rest[1] ?? 844);
const url = process.env.SCENE_URL ?? 'http://localhost:4173';
const outDir = process.env.SCENE_OUT ?? '/tmp/сцены';

if (!scene) {
  console.log('Как звать: node tools/scene.mjs <сцена> [узел] [ширина] [высота]');
  console.log('Например: node tools/scene.mjs hearth_reckoning');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width, height },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'ru-RU',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();
await page.waitForTimeout(400);

const seeded = await page.evaluate(
  ([sc, nd]) => {
    const raw = localStorage.getItem('nameless:save:v1');
    if (!raw) return 'сейва нет — игра не начала забег';
    const env = JSON.parse(raw);
    env.state.scene = sc;
    env.state.node = nd ?? '@entry';
    // Лента прошлой сцены не должна ехать за нами: иначе в кадре чужие реплики.
    env.state.log = [];
    localStorage.setItem('nameless:save:v1', JSON.stringify(env));
    return 'ок';
  },
  [scene, node],
);
if (seeded !== 'ок') {
  console.log(`!! ${seeded}`);
  await browser.close();
  process.exit(1);
}
await page.reload({ waitUntil: 'networkidle' });
// «Продолжить» — потому что сейв уже есть и он указывает в нужную сцену.
const cont = page.locator('.big-button').first();
await cont.click();
await page.waitForTimeout(600);

/* Пролистываем сцену до первого выбора или до конца: сценаристу нужно
   увидеть свой текст, а не заглавную реплику. Тапаем не больше сорока раз —
   этого хватает любой сцене, а зациклившуюся видно по счётчику. */
const shots = [];
let taps = 0;
for (; taps < 40; taps++) {
  if (await page.locator('.choice').count()) break;
  // Ушли из диалога — значит сцена доиграла: бой, церемония смерти, титул.
  // Тыкать дальше бессмысленно, а сорок слепых касаний ещё и врут в отчёте
  // («другой экран, 40 касаний» вместо «привела к смерти на пятом»).
  if (!(await page.locator('.screen.dialogue').count())) break;
  await page.mouse.click(width / 2, height * 0.35);
  await page.waitForTimeout(90);
}
await page.waitForTimeout(400);

const seen = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll('.feed .say, .feed .narration, .feed .lore, .feed .chosen')];
  return {
    where: document.querySelector('.screen.battle')
      ? 'бой'
      : document.querySelector('.screen.death')
        ? 'церемония смерти'
        : document.querySelector('.screen.title')
          ? 'титул (сцена кончилась забегом)'
          : document.querySelector('.screen.dialogue')
            ? 'диалог'
            : 'неизвестный экран',
    lines: bubbles.slice(-6).map((b) => (b.textContent ?? '').trim().slice(0, 90)),
    choices: [...document.querySelectorAll('.choice')].map((c) => (c.textContent ?? '').trim().slice(0, 70)),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

const shot = `${outDir}/${scene}${node ? '-' + node : ''}-${width}x${height}.png`;
await page.screenshot({ path: shot });
shots.push(shot);

console.log(`── ${scene}${node ? ' # ' + node : ''} — ${seen.where}, ${taps} касаний ──`);
for (const l of seen.lines) console.log(`   ${l}`);
if (seen.choices.length) {
  console.log(`   ── выбор (${seen.choices.length}):`);
  for (const c of seen.choices) console.log(`      • ${c}`);
} else {
  console.log('   выбора на экране нет');
}
if (seen.overflow) console.log('!! страница уехала вбок — что-то не влезло в экран');
const real = errors.filter((e) => !e.includes('favicon'));
console.log(`   ошибок в консоли: ${real.length}`);
for (const e of real.slice(0, 5)) console.log(`   !! ${e}`);
console.log(`   снимок: ${shot}`);

await browser.close();
