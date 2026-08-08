/**
 * Отдельная проверка узкого места первой главы: бой «Архивная стража третьего
 * яруса» — единственная дверь в главу 2. Доходим до него и играем осмысленно:
 * бьём самой сильной готовой атакой по самому слабому доступному врагу,
 * лечим только когда кто-то реально просел.
 *
 * Запуск: node tools/archivefight.mjs <url> <outDir> [попыток]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/archive';
const tries = Number(process.argv[4] ?? 3);
mkdirSync(outDir, { recursive: true });

const HEALS = ['ветошь и вода', 'колодец не спрашивает', 'милосердие без разбора', 'перевязка'];
const ROUTE = ['на мостки', 'в мокрые ряды', 'за реку', 'с клёстом', 'в читальню'];
const FIGHT = ['не отдавать', 'дойти до лестницы', 'сначала тот', 'их четверо'];

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
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();

const scene = () =>
  page.evaluate(() => {
    const raw = localStorage.getItem('nameless:save:v1');
    return raw ? JSON.parse(raw).state.scene : '';
  });

const results = [];
let shots = 0;

for (let step = 0; step < 4000 && results.length < tries; step++) {
  if (await page.locator('.screen.death').count()) {
    const b = page.locator('.death-footer .big-button');
    if (await b.count()) await b.click();
    await page.waitForTimeout(500);
    continue;
  }

  if (await page.locator('.screen.battle').count()) {
    const sc = await scene();
    const over = page.locator('.battle-over .big-button');
    if (await over.count()) {
      const res = await page.evaluate(() => document.querySelector('.outcome')?.textContent ?? '');
      const round = await page.evaluate(
        () => document.querySelector('.battle-top span')?.textContent ?? '',
      );
      if (sc === 'archive_night') {
        results.push({ res, round });
        console.log(`архивный бой #${results.length}: ${res}, ${round}`);
        if (shots < 2) await page.screenshot({ path: `${outDir}/archive-${shots++}.png` });
      }
      await over.click();
      await page.waitForTimeout(450);
      continue;
    }

    // Осмысленный ход: если все свои целы — бьём; если кто-то ниже 55 % — лечим.
    const info = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.card:not(.empty)')].map((c) => ({
        name: c.querySelector('.card-name')?.textContent ?? '',
        hp: c.querySelector('.card-hp')?.textContent ?? '',
        enemy: c.className.includes('enemy'),
      }));
      const ab = [...document.querySelectorAll('.ability')].map((a) => a.textContent.toLowerCase());
      return { cards, ab };
    });
    const hurt = info.cards
      .filter((c) => !c.enemy)
      .some((c) => {
        const [a, b] = c.hp.split('/').map(Number);
        return b && a / b < 0.55;
      });
    const idx = (() => {
      const healIdx = info.ab.findIndex((t) => HEALS.some((h) => t.includes(h)));
      if (hurt && healIdx >= 0) return healIdx;
      const atk = info.ab.findIndex((t) => !HEALS.some((h) => t.includes(h)));
      return atk >= 0 ? atk : 0;
    })();
    const ab = page.locator('.ability');
    if (await ab.count()) {
      await ab.nth(Math.min(idx, (await ab.count()) - 1)).click();
      await page.waitForTimeout(90);
      const targets = page.locator('.card.targetable');
      const n = await targets.count();
      if (n) {
        // самый слабый доступный
        const hps = await page.evaluate(() =>
          [...document.querySelectorAll('.card.targetable')].map((c) => {
            const [a] = (c.querySelector('.card-hp')?.textContent ?? '0/0').split('/').map(Number);
            return a;
          }),
        );
        let best = 0;
        hps.forEach((h, i) => {
          if (h < hps[best]) best = i;
        });
        await targets.nth(best).click();
        await page.waitForTimeout(270);
        continue;
      }
    }
    await page.waitForTimeout(240);
    continue;
  }

  const ch = page.locator('.choice');
  if (await ch.count()) {
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
    );
    let i = texts.findIndex((t) => ROUTE.some((w) => t.includes(w)));
    if (i < 0) i = texts.findIndex((t) => FIGHT.some((w) => t.includes(w)));
    if (i < 0) i = 0;
    await ch.nth(i).click();
    await page.waitForTimeout(190);
    continue;
  }
  const h = page.locator('.tap-hint');
  if (await h.count()) await h.click();
  await page.waitForTimeout(140);
}

console.log('\nитог по архивному бою:', JSON.stringify(results));
console.log('финальная сцена:', await scene());
await browser.close();
