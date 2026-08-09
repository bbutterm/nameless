/**
 * Зеркалит собранный packages/client/dist в корневой dist/.
 *
 * Зачем: Vercel в монорепо ищет выходную папку по-разному в зависимости от
 * настройки Root Directory проекта, и наш `outputDirectory` из vercel.json он
 * в одном из вариантов не применял — деплой падал с «No Output Directory named
 * "dist" found» при успешной сборке. Гадать, какой вариант выбран в настройках,
 * бессмысленно: дешевле положить результат в оба места, где его могут искать.
 *
 * Собираем при этом по-прежнему внутрь пакета: запись за пределы корня пакета
 * (`outDir: '../../dist'`) оказалась единственным отличием между сборкой,
 * которая на Vercel прошла, и сборкой, которая молча умерла.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(clientDir, 'dist');
const dst = join(clientDir, '..', '..', 'dist');

if (!existsSync(src)) {
  console.error(`mirror-dist: нечего зеркалить, нет ${src}`);
  process.exit(1);
}

rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log(`mirror-dist: ${src} -> ${dst}`);
