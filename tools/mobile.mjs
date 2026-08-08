/**
 * Мобильные мелочи: скролл ленты вверх, раскрывашки лора, размеры тап-целей,
 * плашка поворота, безопасные зоны, длинные слова, перенос имён на карточках.
 *
 * Запуск: node tools/mobile.mjs <url> <outDir>
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4180';
const outDir = process.argv[3] ?? '/tmp/playtest/mobile';
mkdirSync(outDir, { recursive: true });

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

async function session(w, h, label) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
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
  // Набираем ленту побольше.
  for (let i = 0; i < 25; i++) {
    if (await page.locator('.screen.battle, .screen.death').count()) break;
    const ch = page.locator('.choice');
    if (await ch.count()) await ch.first().click();
    else {
      const t = page.locator('.tap-hint');
      if (await t.count()) await t.click();
    }
    await page.waitForTimeout(190);
  }

  console.log(`\n══ ${label} (${w}×${h}) ══`);

  // 1. Скролл ленты вверх и что происходит после тапа.
  const scrollInfo = await page.evaluate(() => {
    const f = document.querySelector('.feed');
    return { scrollH: f.scrollHeight, clientH: f.clientHeight, top: f.scrollTop };
  });
  await page.evaluate(() => {
    document.querySelector('.feed').scrollTop = 0;
  });
  await page.waitForTimeout(400);
  const afterScroll = await page.evaluate(() => document.querySelector('.feed').scrollTop);
  await page.screenshot({ path: `${outDir}/feed-scrolled-up-${label}.png` });
  // тап по ленте (как будто игрок промахнулся, читая старое)
  await page.locator('.feed').click({ position: { x: 30, y: 60 } });
  await page.waitForTimeout(700);
  const afterTap = await page.evaluate(() => {
    const f = document.querySelector('.feed');
    return { top: f.scrollTop, max: f.scrollHeight - f.clientHeight };
  });
  console.log(
    `лента: ${scrollInfo.scrollH}/${scrollInfo.clientH}, после ручного скролла вверх top=${afterScroll}; ` +
      `тап по ленте => top=${afterTap.top} из ${afterTap.max} ${afterTap.top >= afterTap.max - 4 ? '(швырнуло вниз и промотало реплику)' : ''}`,
  );

  // 2. Тап-цели.
  const taps = await page.evaluate(() => {
    return [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { cls: b.className, w: +r.width.toFixed(1), h: +r.height.toFixed(1), text: (b.textContent ?? '').slice(0, 28) };
      })
      .filter((b) => b.h < 48 || b.w < 48);
  });
  console.log('цели меньше 48px:', taps.length ? JSON.stringify(taps) : 'нет');

  // 3. Раскрывашка лора.
  const lore = await page.evaluate(() => {
    const b = document.querySelector('.lore-toggle');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { h: +r.height.toFixed(1), w: +r.width.toFixed(1), text: b.textContent };
  });
  if (lore) {
    console.log(`раскрывашка лора: ${lore.w}×${lore.h} «${lore.text}»`);
    await page.locator('.lore-toggle').first().scrollIntoViewIfNeeded().catch(() => {});
    await page.locator('.lore-toggle').first().click({ force: true, timeout: 5000 }).catch((e) => console.log('клик по лору не прошёл:', e.message.split('\n')[0]));
    await page.waitForTimeout(400);
    const open = await page.evaluate(() => !!document.querySelector('.lore-text'));
    await page.screenshot({ path: `${outDir}/lore-open-${label}.png` });
    console.log('раскрылась:', open);
    // не проматывает ли она сцену вперёд
    const advanced = await page.evaluate(() => JSON.parse(localStorage.getItem('nameless:save:v1')).state.node);
    console.log('узел после тапа по лору:', advanced);
  } else {
    console.log('раскрывашек лора в ленте пока нет');
  }

  // 4. Переполнение по горизонтали и длинные слова.
  const overflow = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('.bubble-text, .narration, .choice-text, .card-name, .lore-text')) {
      if (el.scrollWidth > el.clientWidth + 1) bad.push({ cls: el.className, text: el.textContent.slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth });
    }
    return {
      bad,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  console.log('вылезает за свою коробку:', overflow.bad.length ? JSON.stringify(overflow.bad) : 'нет', '| гориз. скролл страницы:', overflow.hScroll);

  await ctx.close();
}

await session(390, 844, '390');
await session(360, 640, '360');

// 5. Плашка поворота на разных ландшафтах.
for (const [w, h] of [[844, 390], [740, 360], [1024, 600], [900, 560]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const gate = await page.evaluate(() => !!document.querySelector('.rotate-gate'));
  await page.screenshot({ path: `${outDir}/landscape-${w}x${h}.png` });
  console.log(`ландшафт ${w}×${h}: плашка «поверни» ${gate ? 'есть' : 'НЕТ — играем растянутым интерфейсом'}`);
  await ctx.close();
}

await browser.close();
