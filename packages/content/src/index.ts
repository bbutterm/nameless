import type { ContentBundle } from '@nameless/engine';
import * as gen from './generated.js';
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
