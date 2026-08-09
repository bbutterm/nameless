/**
 * Контактный лист портретов ИЗ БОЕВОГО МОДУЛЯ (не из прототипа).
 * Запуск: node tools/portrait-sheet.mjs out.png
 */
import { chromium } from 'playwright';
import { portraitSvg, PORTRAIT_IDS, ECHO_IDS } from '../packages/content/assets/procedural/portraits.ts';

const NAMES = { narrator:'Рассказчик', player:'Ты', osoka:'Осока', tminny:'Тминный',
  proshchai:'Брат Прощай', zhichka:'Жичка', dratva:'Дратва', klyost:'Клёст', revizor:'Ревизор',
  strazhnik:'Стражник', otsenshchik:'Оценщик', poproshayka:'Попрошайка', marodyor:'Мародёр',
  golos_iz_trukhi:'Голос из трухи', brat_ogorodnik:'Огородник', pisar_chitalni:'Писарь',
  storozh_arkhiva:'Сторож', ochered:'Очередь', mertvyy_v_ocheredi:'Мертвец',
  svodchik:'Сводчик', naryad_revizii:'Старший наряда',
  gar:'Гарь', vodonos:'Водонос', posul:'Посул', svidetel:'Свидетель' };

const ids = [...PORTRAIT_IDS, ...ECHO_IDS];
const cell = (id) => {
  const big = portraitSvg(id, { deaths: 2, chapter: 2 });
  return `<div style="text-align:center">
    <div style="width:112px;height:112px;background:#151219;border-radius:12px;box-shadow:inset 0 2px 10px #000a;overflow:hidden">
      ${big.replace('<svg', '<svg style="width:112px;height:112px"')}</div>
    <div style="width:44px;height:44px;background:#151219;border-radius:9px;margin:7px auto 3px;overflow:hidden">
      ${big.replace('<svg', '<svg style="width:44px;height:44px"')}</div>
    <div style="font:11px system-ui;color:#9a90a0">${NAMES[id] ?? id}</div></div>`;
};
const html = `<body style="margin:0;background:#0d0b0e;padding:16px">
<div style="display:flex;gap:10px;flex-wrap:wrap;width:600px">${ids.map(cell).join('')}</div></body>`;

const exe = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 640, height: 1000 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.screenshot({ path: process.argv[2], fullPage: true });
await b.close();
console.log('лиц', ids.length);
