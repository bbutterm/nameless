/**
 * Снимок «сколько выигрывает бот» — чтобы полигон боёв мог сравнить человека с
 * прибором прямо на экране.
 *
 * Отчёт симулятора (`sim-reports/latest.json`) в репозиторий не идёт: он
 * пересобирается каждым прогоном и весит много. А одна цифра на бой нужна
 * клиенту постоянно — иначе полигон покажет «сыграно 5, побед 5» и не скажет
 * главного: много это или мало. Поэтому цифры вынимаются в маленький файл,
 * который коммитится и лежит рядом с контентом.
 *
 * Снимок ОБЯЗАН нести дату и число прогонов: цифра без них через месяц
 * превращается в предание. Полигон печатает и то и другое.
 *
 * Запуск: node tools/botrates.mjs   (после полного `npx tsx src/cli.ts`)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'sim-reports', 'latest.json');
const out = join(root, 'packages', 'content', 'data', 'botrates.json');

let report;
try {
  report = JSON.parse(readFileSync(src, 'utf8'));
} catch {
  console.log(`!! ${src} не читается — сначала прогони симулятор полностью`);
  process.exit(1);
}

const rows = report.scriptedBattles ?? [];
if (rows.length === 0) {
  console.log('!! в отчёте нет раздела сюжетных боёв — прогон был частичным?');
  process.exit(1);
}

const battles = {};
for (const r of rows) {
  battles[r.battle] = {
    winrate: Number(r.winrate.toFixed(3)),
    rounds: Number(r.avgRounds.toFixed(1)),
    runs: r.runs,
  };
}

// Дата берётся из отчёта, а не из часов: снимок описывает ТОТ прогон, а не
// момент, когда кто-то запустил эту утилиту.
const snapshot = {
  note:
    'Сколько выигрывает бот-игрок в каждом бою. Снимается утилитой tools/botrates.mjs ' +
    'из отчёта симулятора и служит полигону боёв мерой сравнения: человек играет лучше ' +
    'жадной эвристики, и насколько именно — видно только так.',
  measured: report.measured ?? new Date().toISOString().slice(0, 10),
  battles,
};
writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`снято ${Object.keys(battles).length} боёв → ${out}`);
