/**
 * Ромб умения памяти на экране боя: видно ли его, помещается ли панель.
 *
 * Умение появляется только у того, кто уже вспомнил, — то есть после смерти
 * и церемонии. Играть до неё каждый раз дорого и ненадёжно, поэтому забег
 * подкладывается готовым: берётся честный сейв первой сцены, в него
 * дописываются закреплённые воспоминания, и дальше игра идёт сама.
 * Подкладывается ровно память — ни отряда, ни осей, ни глав: всё остальное
 * игра выводит из неё сама, и если не выведет, это и будет находкой.
 *
 * Запуск: node tools/powerbar.mjs <url> <outDir> [ширина] [высота]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173';
const outDir = process.argv[3] ?? '/tmp/playtest/powerbar';
const width = Number(process.argv[4] ?? 390);
const height = Number(process.argv[5] ?? 844);
mkdirSync(outDir, { recursive: true });
const tag = `${width}x${height}`;

/* Две жизни сразу: проверяем и веер из нескольких ромбов, и то, что панель
   с ними всё ещё влезает рядом с четырьмя кнопками способностей. */
const LOCKED = (process.env.LOCKED ?? 'smola_na_vode,ples_gorit,pervoye_vedro').split(',');

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

// Игра успела записать честный сейв — дописываем в него память и перезагружаемся.
const seeded = await page.evaluate((locked) => {
  const raw = localStorage.getItem('nameless:save:v1');
  if (!raw) return 'сейва нет';
  const env = JSON.parse(raw);
  env.state.lockedMemories = locked;
  localStorage.setItem('nameless:save:v1', JSON.stringify(env));
  return 'ок';
}, LOCKED);
if (seeded !== 'ок') {
  console.log('!! подложить память не удалось:', seeded);
  await browser.close();
  process.exit(1);
}
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.big-button').first().click();

// Дальше — до первой драки, тыкая всё подряд и предпочитая драку.
const FIGHT = ['драться', 'не отдавать', 'встать', 'бить', 'на мостки', 'не мешать'];
let reached = false;
for (let i = 0; i < 600; i++) {
  if (await page.locator('.screen.battle').count()) {
    reached = true;
    break;
  }
  // Бирка новобранца (В2) перекрывает экран подложкой — до её закрытия любой
  // тап уходит в подложку.
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
    let idx = texts.findIndex((t) => FIGHT.some((w) => t.includes(w)));
    if (idx < 0) idx = 0;
    await ch.nth(idx).click();
  } else {
    // Раньше здесь был слепой клик «по центру на 40% высоты». Он промахивался
    // мимо зоны продолжения (`.tap-area` занимает нижнюю полосу экрана), и до
    // боя инструмент не доходил вовсе — дефект, записанный в итоге Б7.
    // Жмём тот же элемент, что и остальные проходы.
    const hint = page.locator('.tap-hint');
    if (await hint.count()) await hint.first().click();
    else await page.mouse.click(width / 2, height - 24);
  }
  await page.waitForTimeout(40);
}

if (!reached) {
  console.log('!! до боя не дошли за 600 шагов');
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(700);

const report = await page.evaluate(() => {
  const bar = document.querySelector('.ability-bar');
  const powers = [...document.querySelectorAll('.memory-power')];
  const abilities = [...document.querySelectorAll('.ability')];
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) };
  };
  return {
    powers: powers.map((p) => ({
      name: p.querySelector('.power-name')?.textContent ?? '',
      spent: p.classList.contains('spent'),
      ...r(p),
    })),
    abilities: abilities.map((a) => ({ name: a.querySelector('.ability-name')?.textContent ?? '', ...r(a) })),
    barScroll: bar ? { client: bar.clientWidth, scroll: bar.scrollWidth } : undefined,
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});

console.log(`── ромбы умений, ${tag} ──`);
if (report.powers.length === 0) console.log('!! ромбов на экране НЕТ');
for (const p of report.powers) {
  console.log(`   ${p.name.padEnd(18)} ${p.w}×${p.h} @${p.x}${p.spent ? '  (погашен)' : ''}`);
}
console.log(`   кнопок способностей: ${report.abilities.length}`);
console.log(`   панель: видно ${report.barScroll?.client}, содержимое ${report.barScroll?.scroll}` +
  (report.barScroll && report.barScroll.scroll > report.barScroll.client ? '  — ПРОКРУЧИВАЕТСЯ' : ''));
console.log(`   горизонтальная прокрутка страницы: ${report.bodyOverflow ? 'ЕСТЬ — плохо' : 'нет'}`);

// Тап по ромбу: умение должно выделиться и подсветить цели.
if (report.powers.length) {
  await page.locator('.memory-power').first().click();
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    active: !!document.querySelector('.memory-power.active'),
    hint: document.querySelector('.battle-hint')?.textContent ?? '',
    targets: document.querySelectorAll('.unit-card.targetable, .unit-card.legal').length,
  }));
  console.log(`   после тапа: выделен ${after.active ? 'да' : 'НЕТ'}, строка «${after.hint.trim()}»`);
}
await page.screenshot({ path: `${outDir}/powerbar-${tag}.png` });

const tapErrors = errors.filter((e) => !e.includes('favicon'));
console.log(`   ошибок в консоли: ${tapErrors.length}`);
for (const e of tapErrors.slice(0, 5)) console.log(`   !! ${e}`);

await browser.close();
