/**
 * Типы для `tools/plainwords.mjs`. Счёт живёт в `.mjs`, потому что прибор
 * обязан запускаться одним `node tools/plainwords.mjs` без сборки; но его же
 * зовёт симулятор на TypeScript, и без этого файла вызов был бы нетипизирован.
 */

export interface PlainwordsHit {
  readonly root: string;
  readonly word: string;
}

export interface TierAFinding extends PlainwordsHit {
  readonly where: string;
  readonly lang: 'ru' | 'en';
  readonly quote: string;
}

export interface PerLineFinding {
  readonly where: string;
  readonly count: number;
  readonly words: string[];
}

export interface SceneCheck {
  readonly id: string;
  readonly words: number;
  readonly limit: number;
  readonly tierA: TierAFinding[];
  readonly tierB: number;
  readonly tierBOver: boolean;
  readonly tierBRoots: [string, number][];
  readonly perLine: PerLineFinding[];
}

export interface NameCheck {
  readonly power: string;
  readonly total: number;
  readonly matched: number;
  readonly share: number;
  readonly limit: number;
  readonly over: boolean;
  readonly names: string[];
}

export interface PlainwordsResult {
  readonly scenes: SceneCheck[];
  readonly skipped: string[];
  readonly names: NameCheck[];
  readonly unitsTotal: number;
  readonly tierAScenes: SceneCheck[];
  readonly tierAHits: number;
  readonly tierBScenes: SceneCheck[];
  readonly perLineScenes: SceneCheck[];
  readonly perLineHits: number;
  readonly namesOver: NameCheck[];
  readonly violations: number;
}

export interface PlainwordsFinding {
  readonly kind: 'plainwords';
  readonly id: string;
  readonly value?: number;
  readonly note: string;
}

export declare const SKIPPED_SCENES: Set<string>;
export declare const NAME_SHARE_LIMIT: number;
export declare const POWER_DICTS: readonly { power: string; stems: string[] }[];

export declare function wordCount(text: string): number;
export declare function tierBLimit(words: number): number;
export declare function tierAHits(text: string, lang: 'ru' | 'en'): PlainwordsHit[];
export declare function tierBHits(text: string): PlainwordsHit[];
export declare function visibleLines(
  scene: unknown,
): { where: string; lang: 'ru' | 'en'; text: string }[];
export declare function checkScene(scene: unknown): SceneCheck;
export declare function checkNames(units: readonly unknown[]): NameCheck[];
export declare function checkPlainwords(root?: string): PlainwordsResult;
export declare function repoRoot(): string;
export declare function report(r: PlainwordsResult): string[];
export declare function brief(r: PlainwordsResult): string[];
export declare function findings(r: PlainwordsResult): PlainwordsFinding[];
