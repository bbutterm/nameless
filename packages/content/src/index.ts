import type { ContentBundle } from '@nameless/engine';
import * as gen from './generated.js';
import botratesJson from '../data/botrates.json';
import { validateBundle, type Issue } from './validate.js';

export { validateBundle } from './validate.js';
export type { Issue } from './validate.js';
export * from './schema.js';

/** Собранный контент. Валидация — отдельным вызовом, чтобы прод не платил за неё. */
export const content: ContentBundle = {
  axes: gen.axes as ContentBundle['axes'],
  scenes: gen.scenes as ContentBundle['scenes'],
  units: gen.units as ContentBundle['units'],
  abilities: gen.abilities as ContentBundle['abilities'],
  battles: gen.battles as ContentBundle['battles'],
  lives: gen.lives as ContentBundle['lives'],
  memories: gen.memories as ContentBundle['memories'],
  deaths: gen.deaths as ContentBundle['deaths'],
  chapters: gen.chapters as ContentBundle['chapters'],
  speakers: gen.speakers as ContentBundle['speakers'],
  codex: gen.codex as ContentBundle['codex'],
};

export function checkContent(): Issue[] {
  return validateBundle(content);
}

/** Одна строка снимка: сколько выигрывает бот в этом бою и как долго он идёт. */
export interface BotRate {
  winrate: number;
  rounds: number;
  runs: number;
}

/**
 * Снимок «сколько выигрывает бот» (`data/botrates.json`, снимается
 * `node tools/botrates.mjs`). Лежит рядом с контентом, а не в отчётах
 * симулятора: отчёт пересобирается каждым прогоном и в репозиторий не идёт, а
 * полигон боёв обязан показывать цифру бота ВСЕГДА — иначе «ты выиграл 5 из
 * 5» не отвечает на главный вопрос, много это или мало.
 *
 * `measured` печатается на экране рядом с цифрами и не украшение: снимок без
 * даты через месяц превращается в предание.
 */
export interface BotRates {
  note: string;
  measured: string;
  battles: Record<string, BotRate>;
}

export const botrates: BotRates = botratesJson as BotRates;
