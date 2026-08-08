/**
 * Генератор реестра контента. Сканирует data/ и пишет src/generated.ts.
 * Смысл: сценаристы кладут файл — и он подхватывается. Никакого общего
 * index-файла, который агенты правили бы одновременно и ловили конфликты.
 *
 * Запуск: pnpm --filter @nameless/content gen
 */
import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const outFile = join(here, 'generated.ts');

const GROUPS = [
  { dir: 'scenes', name: 'scenes' },
  { dir: 'units', name: 'units' },
  { dir: 'abilities', name: 'abilities' },
  { dir: 'battles', name: 'battles' },
  { dir: 'lives', name: 'lives' },
  { dir: 'memories', name: 'memories' },
  { dir: 'deaths', name: 'deaths' },
  { dir: 'chapters', name: 'chapters' },
  { dir: 'axes', name: 'axes' },
  { dir: 'speakers', name: 'speakers' },
] as const;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.json')) out.push(full);
  }
  return out;
}

function ident(path: string, prefix: string, i: number): string {
  const base = path.replace(/[^a-zA-Z0-9]/g, '_');
  return `${prefix}_${i}_${base.slice(-24)}`;
}

const imports: string[] = [];
const groupArrays: string[] = [];

for (const g of GROUPS) {
  const files = walk(join(dataDir, g.dir));
  const names: string[] = [];
  files.forEach((f, i) => {
    const rel = './' + relative(here, f).split('\\').join('/');
    const name = ident(g.name, g.name, i);
    imports.push(`import ${name} from '${rel}';`);
    names.push(name);
  });
  // Файл может содержать как один объект, так и массив объектов.
  // Приведение к unknown[] намеренное: иначе TypeScript пытается вывести
  // объединение литеральных типов всех JSON сразу и захлёбывается на десятках файлов.
  groupArrays.push(
    `export const ${g.name}: unknown[] = ([${names.join(', ')}] as unknown[]).flatMap((x) => (Array.isArray(x) ? x : [x]));`,
  );
}

const banner = `/* СГЕНЕРИРОВАНО gen-index.ts — не редактировать руками. */\n/* eslint-disable */\n`;
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${banner}\n${imports.join('\n')}\n\n${groupArrays.join('\n')}\n`, 'utf8');

const total = imports.length;
console.log(`generated.ts: подключено файлов — ${total}`);
