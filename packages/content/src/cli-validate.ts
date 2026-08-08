import { content, validateBundle } from './index.js';

const issues = validateBundle(content);
const errors = issues.filter((i) => i.level === 'error');
const warns = issues.filter((i) => i.level === 'warn');

console.log(
  `Контент: сцен ${content.scenes.length}, юнитов ${content.units.length}, боёв ${content.battles.length}, ` +
    `воспоминаний ${content.memories.length}, глав ${content.chapters.length}`,
);

for (const i of errors) console.error(`  ОШИБКА  ${i.where}: ${i.message}`);
for (const i of warns) console.warn(`  предупр. ${i.where}: ${i.message}`);

console.log(`Итог: ошибок ${errors.length}, предупреждений ${warns.length}`);
if (errors.length > 0) process.exit(1);
