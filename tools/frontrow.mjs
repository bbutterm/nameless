/**
 * Читается ли правило переднего ряда: проходим несколько своих ходов подряд и
 * для каждого действующего юнита смотрим, кто подсвечен целью и чем именно
 * недоступная цель отличается на вид от доступной.
 *
 * Запуск: node tools/frontrow.mjs <url> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/frontrow';
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
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();

const FIGHT = ['на мостки', 'не вмешиваться'];
for (let i = 0; i < 400; i++) {
  if (await page.locator('.screen.battle').count()) break;
  // Бирка новобранца (В2) перекрывает экран подложкой — до её закрытия любой
  // тап уходит в подложку, и проход падал на «tag-backdrop intercepts pointer
  // events». Ветка та же, что в `battlelab.mjs`.
  const backdrop = page.locator('.tag-backdrop');
  if (await backdrop.count()) {
    await backdrop.first().click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(150);
    continue;
  }
  const ch = page.locator('.choice');
  if (await ch.count()) {
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
    );
    let k = texts.findIndex((t) => FIGHT.some((w) => t.includes(w)));
    if (k < 0) k = 0;
    await ch.nth(k).click();
  } else {
    const h = page.locator('.tap-hint');
    if (await h.count()) await h.click();
  }
  await page.waitForTimeout(180);
}

let shots = 0;
for (let turn = 0; turn < 6; turn++) {
  if (await page.locator('.battle-over').count()) break;
  const ab = page.locator('.ability:not(.cooling)');
  if ((await ab.count()) === 0) {
    await page.waitForTimeout(400);
    continue;
  }
  const actor = await page.evaluate(
    () => document.querySelector('.card.selected .card-name')?.textContent ?? '(никто не подсвечен)',
  );
  const abilities = await page.evaluate(() =>
    [...document.querySelectorAll('.ability:not(.cooling)')].map((a) => a.textContent),
  );
  for (let a = 0; a < (await ab.count()); a++) {
    await ab.nth(a).click();
    await page.waitForTimeout(150);
    const t = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.card:not(.empty)')]
        .map((c) => ({
          n: c.querySelector('.card-name')?.textContent,
          row:
            (c.className.includes('enemy') ? 'враг/' : 'свой/') +
            (c.closest('.row').className.includes('row-front') ? 'перёд' : 'зад'),
          ok: c.classList.contains('targetable'),
          shadow: getComputedStyle(c).boxShadow.slice(0, 40),
          opacity: getComputedStyle(c).opacity,
          filter: getComputedStyle(c).filter,
        }));
      return rows;
    });
    console.log(
      `ход ${turn + 1}: действует «${actor}», способность «${abilities[a]}» → доступны: ` +
        t.filter((x) => x.ok).map((x) => `${x.n}(${x.row})`).join(', ') +
        ' | НЕдоступны: ' +
        (t.filter((x) => !x.ok).map((x) => `${x.n}(${x.row})`).join(', ') || '—'),
    );
    const blocked = t.find((x) => !x.ok);
    const okCard = t.find((x) => x.ok);
    if (blocked && okCard && shots < 2) {
      console.log(
        `   вид доступной: тень «${okCard.shadow}» прозрачность ${okCard.opacity} фильтр ${okCard.filter}`,
      );
      console.log(
        `   вид закрытой:  тень «${blocked.shadow}» прозрачность ${blocked.opacity} фильтр ${blocked.filter}`,
      );
      await page.screenshot({ path: `${outDir}/frontrow-${shots++}.png` });
    }
  }
  // ходим первой способностью по первой цели
  await ab.first().click();
  await page.waitForTimeout(120);
  const tg = page.locator('.card.targetable');
  if (await tg.count()) await tg.first().click();
  await page.waitForTimeout(900);
}

await browser.close();
