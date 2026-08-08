/**
 * Индексы контента. Живут отдельно от провайдера намеренно: файл с React-компонентом,
 * экспортирующий ещё и обычные значения, ломает Fast Refresh — контекст пересоздаётся,
 * и приложение падает с «useGame вне GameProvider» посреди горячей перезагрузки.
 */
import { content } from '@nameless/content';
import { indexCombat, indexContent } from '@nameless/engine';

export { content };
export const idx = indexContent(content);
export const combat = indexCombat(content);
