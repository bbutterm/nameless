/**
 * Ставит отпечаток сборки в имя кеша сервис-воркера.
 *
 * Без этого имя кеша постоянно, `activate` не удаляет ничего, и мусор всех
 * прошлых сборок живёт на устройстве вечно. Отпечаток берём от index.html:
 * он меняется при любой смене хешей ассетов, то есть ровно тогда, когда кеш
 * и надо считать новым.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const swPath = join(dist, 'sw.js');
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const stamp = createHash('sha1').update(html).digest('hex').slice(0, 8);

const sw = readFileSync(swPath, 'utf8');
if (!sw.includes('__BUILD__')) {
  console.error('stamp-sw: в sw.js нет метки __BUILD__ — обновление кеша сломано');
  process.exit(1);
}
writeFileSync(swPath, sw.replaceAll('__BUILD__', stamp));
console.log(`stamp-sw: кеш сборки — nameless-${stamp}`);
