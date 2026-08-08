/**
 * Автопрохождение главы 1 в настоящем браузере: тапает пузыри, жмёт выборы,
 * доводит бои до конца и ждёт церемонию смерти. Проверяет то, чего не видит
 * ни один симулятор, — что игра действительно играется пальцем на телефоне.
 *
 * Запуск: node tools/playthrough.mjs [url] [outDir] [strategy]
 * strategy: first | last | random  (какой из доступных вариантов выбирать)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173';
const outDir = process.argv[3] ?? 'screenshots';
const strategy = process.argv[4] ?? 'first';
mkdirSync(outDir, { recursive: true });

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'ru-RU',
});
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();
await page.waitForTimeout(300);

let bubbles = 0;
let choices = 0;
let battles = 0;
let battleTaps = 0;
let deathSeen = false;
let shots = 0;
const seenScenes = new Set();

for (let step = 0; step < 1600; step++) {
  // Церемония смерти — цель прогона.
  if (await page.locator('.memory-card, .death-stage').count()) {
    if (!deathSeen) {
      deathSeen = true;
      await page.waitForTimeout(3200);
      await page.screenshot({ path: `${outDir}/play-death.png` });
    }
    const proceed = page.locator('.death-footer .big-button');
    if (await proceed.count()) {
      await proceed.click();
      await page.waitForTimeout(400);
      continue;
    }
    await page.waitForTimeout(300);
    continue;
  }

  // Бой.
  if (await page.locator('.screen.battle').count()) {
    if (battles === 0) {
      battles++;
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${outDir}/play-battle.png` });
    }
    const over = page.locator('.battle-over .big-button');
    if (await over.count()) {
      await over.click();
      await page.waitForTimeout(400);
      continue;
    }
    // Свой ход: выбрать способность, затем цель.
    const ability = page.locator('.ability').first();
    if (await ability.count()) {
      await ability.click();
      await page.waitForTimeout(80);
      const target = page.locator('.card.targetable').first();
      if (await target.count()) {
        await target.click();
        battleTaps++;
        await page.waitForTimeout(260);
        continue;
      }
    }
    await page.waitForTimeout(220);
    continue;
  }

  // Выбор.
  const choiceCount = await page.locator('.choice').count();
  if (choiceCount > 0) {
    if (choices === 0) await page.screenshot({ path: `${outDir}/play-choice.png` });
    const i =
      strategy === 'last'
        ? choiceCount - 1
        : strategy === 'random'
          ? Math.floor(Math.random() * choiceCount)
          : 0;
    await page.locator('.choice').nth(i).click();
    choices++;
    await page.waitForTimeout(160);
    continue;
  }

  // Диалог: тапаем по ленте.
  if (await page.locator('.screen.dialogue').count()) {
    const hint = await page.locator('.tutorial').count();
    if (hint) {
      await page.locator('.tutorial').click();
      await page.waitForTimeout(120);
      continue;
    }
    if (shots < 2 && bubbles === 6) {
      shots++;
      await page.screenshot({ path: `${outDir}/play-dialogue.png` });
    }
    const scene = await page.evaluate(() => document.querySelectorAll('.feed > *').length);
    seenScenes.add(scene);
    // Тапаем по подсказке, а не по ленте: в ленте попадаются раскрывашки лора,
    // которые гасят всплытие клика, и автопрохождение залипало на них навсегда.
    const hintEl = page.locator('.tap-hint');
    if (await hintEl.count()) await hintEl.click();
    else await page.locator('.screen.dialogue').click({ position: { x: 195, y: 40 } });
    bubbles++;
    await page.waitForTimeout(90);
    continue;
  }

  // Конец главы.
  if (await page.locator('.screen.title').count() && bubbles > 10) {
    await page.screenshot({ path: `${outDir}/play-end.png` });
    break;
  }
  await page.waitForTimeout(150);
}

await page.screenshot({ path: `${outDir}/play-final.png` });

console.log(`пузырей протапано: ${bubbles}`);
console.log(`выборов сделано:   ${choices}`);
console.log(`боёв начато:       ${battles}, ходов в бою: ${battleTaps}`);
console.log(`церемония смерти:  ${deathSeen ? 'показана' : 'НЕ ДОСТИГНУТА'}`);
console.log(`ошибок в консоли:  ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log(`   ${e}`);

await browser.close();
process.exit(deathSeen && errors.length === 0 ? 0 : 1);
