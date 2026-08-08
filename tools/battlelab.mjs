/**
 * Разбор боя руками: доходим до первой стычки, играем осмысленно и замеряем,
 * что игрок реально видит — чей ход, кого можно бить, что делает способность,
 * читаются ли карточки. Плюс проверка геометрии карточек и переполнения поля.
 *
 * Запуск: node tools/battlelab.mjs <url> <outDir> [ширина] [высота]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/battle';
const width = Number(process.argv[4] ?? 390);
const height = Number(process.argv[5] ?? 844);
mkdirSync(outDir, { recursive: true });
const tag = `${width}x${height}`;

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
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();

// Идём в первую попавшуюся драку: в хабе выбираем мостки, дальше — вариант с дракой.
const FIGHT_WORDS = ['не отдавать', 'драться', 'встать', 'бить', 'не вмешиваться', 'на мостки', 'не мешать'];
for (let i = 0; i < 400; i++) {
  if (await page.locator('.screen.battle').count()) break;
  const ch = page.locator('.choice');
  const n = await ch.count();
  if (n > 0) {
    const texts = await page.evaluate(() =>
      [...document.querySelectorAll('.choice')].map((b) => b.textContent.toLowerCase()),
    );
    let idx = texts.findIndex((t) => FIGHT_WORDS.some((w) => t.includes(w)));
    if (idx < 0) idx = 0;
    await ch.nth(idx).click();
  } else {
    const h = page.locator('.tap-hint');
    if (await h.count()) await h.click();
  }
  await page.waitForTimeout(200);
}

if (!(await page.locator('.screen.battle').count())) {
  console.log('до боя не дошли');
  await page.screenshot({ path: `${outDir}/no-battle-${tag}.png` });
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/battle-start-${tag}.png` });

const geom = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const cards = [...document.querySelectorAll('.card:not(.empty)')].map((c) => {
    const r = c.getBoundingClientRect();
    const name = c.querySelector('.card-name');
    return {
      name: name?.textContent ?? '',
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      top: +r.top.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      offTop: r.top < 0,
      offBottom: r.bottom > vh,
      nameFont: name ? parseFloat(getComputedStyle(name).fontSize) : null,
      nameClipped: name ? name.scrollHeight > name.clientHeight + 1 : false,
      hpFont: parseFloat(getComputedStyle(c.querySelector('.card-hp')).fontSize),
      hpText: c.querySelector('.card-hp')?.textContent ?? '',
      intent: !!c.querySelector('.intent'),
      intentTitle: c.querySelector('.intent')?.getAttribute('title') ?? '',
      targetable: c.classList.contains('targetable'),
      selected: c.classList.contains('selected'),
    };
  });
  const abilities = [...document.querySelectorAll('.ability')].map((a) => {
    const r = a.getBoundingClientRect();
    return {
      text: a.textContent,
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      font: parseFloat(getComputedStyle(a.querySelector('span')).fontSize),
      title: a.getAttribute('title') ?? '',
      aria: a.getAttribute('aria-label') ?? '',
    };
  });
  return {
    vw,
    vh,
    cards,
    abilities,
    hint: document.querySelector('.battle-hint')?.textContent ?? '',
    top: document.querySelector('.battle-top')?.textContent ?? '',
    fieldOverflow: (() => {
      const f = document.querySelector('.field');
      return f ? { scrollH: f.scrollHeight, clientH: f.clientHeight } : null;
    })(),
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
});
console.log(`\n── ${tag} ─────────────────────────`);
console.log('верхняя строка:', geom.top, '| подсказка:', JSON.stringify(geom.hint));
console.log('поле:', JSON.stringify(geom.fieldOverflow), 'гориз. скролл:', geom.hScroll);
for (const c of geom.cards) {
  const flags = [
    c.offTop ? 'ВЫШЕ ЭКРАНА' : '',
    c.offBottom ? 'НИЖЕ ЭКРАНА' : '',
    c.nameClipped ? 'ИМЯ ОБРЕЗАНО' : '',
    c.intent ? `намерение(${c.intentTitle})` : 'намерения нет',
  ].filter(Boolean);
  console.log(
    `  карта «${c.name}» ${c.w}×${c.h} top=${c.top} имя ${c.nameFont}px hp ${c.hpFont}px «${c.hpText}» ${flags.join(' ')}`,
  );
}
console.log('способности:');
for (const a of geom.abilities) {
  console.log(`  «${a.text}» ${a.w}×${a.h}, шрифт ${a.font}px, title=«${a.title}» aria=«${a.aria}»`);
}

// Выбираем способность и смотрим, кто подсветился целью.
if (geom.abilities.length) {
  await page.locator('.ability').first().click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/battle-targets-${tag}.png` });
  const t = await page.evaluate(() => ({
    hint: document.querySelector('.battle-hint')?.textContent ?? '',
    targetable: [...document.querySelectorAll('.card.targetable')].map(
      (c) => c.querySelector('.card-name')?.textContent,
    ),
    all: [...document.querySelectorAll('.card:not(.empty)')].map((c) => ({
      n: c.querySelector('.card-name')?.textContent,
      row: c.closest('.row')?.className,
      side: c.className.includes('enemy') ? 'enemy' : 'player',
      targetable: c.classList.contains('targetable'),
      disabled: c.disabled,
    })),
  }));
  console.log('после выбора способности подсказка:', JSON.stringify(t.hint));
  console.log('можно бить:', JSON.stringify(t.targetable));
  console.log('все карты:', JSON.stringify(t.all));

  // Тапаем по НЕдоступной цели — есть ли хоть какой-то отклик?
  const forbidden = await page.locator('.card:not(.empty):not(.targetable)').filter({ hasNot: page.locator('.selected') });
  if (await forbidden.count()) {
    const before = await page.evaluate(() => document.body.innerText);
    await forbidden.first().click({ force: true });
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => document.body.innerText);
    console.log(
      'тап по недоступной цели изменил экран:',
      before !== after ? 'да' : 'НЕТ (молчание)',
    );
    await page.screenshot({ path: `${outDir}/battle-forbidden-${tag}.png` });
  }
}

await browser.close();
