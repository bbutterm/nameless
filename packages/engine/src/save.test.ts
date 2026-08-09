import { afterEach, describe, expect, it } from 'vitest';
import { deserialize, migrations, serialize, type SaveEnvelope } from './save.js';
import { SAVE_VERSION, createInitialState, type GameState } from './state.js';

function state(patch: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    seed: 'save-test',
    axes: [
      { id: 'mercy_cruelty', start: 0 },
      { id: 'honesty_deceit', start: 0 },
    ],
    chapter: 2,
    scene: 'nizhnie_khranilishcha',
    node: 'n1',
    now: 1_700_000_000_000,
  });
  return { ...base, ...patch };
}

/**
 * Тесты подмешивают фиктивные миграции в общий реестр. Снимок настоящих —
 * чтобы afterEach возвращал реестр как был, а не вычищал его: без этого
 * первый же тест уносил боевую миграцию, и следующие падали на её отсутствии.
 */
const realMigrations = { ...migrations };

afterEach(() => {
  for (const k of Object.keys(migrations)) delete migrations[Number(k)];
  Object.assign(migrations, realMigrations);
});

describe('serialize / deserialize', () => {
  it('round-trip не теряет состояние', () => {
    const s = state({
      axes: { mercy_cruelty: -37, honesty_deceit: 61 },
      flags: { dogovor_naiden: true },
      counters: { lots: 4 },
      fragments: { ples: 3 },
      lockedMemories: ['ples'],
      awakenedLives: ['smolokur'],
      gold: 17,
      deaths: 2,
      visitedScenes: ['chulan', 'mokrye_ryady'],
      party: [{ uid: 'u1', defId: 'gar', hp: 30, xp: 120, level: 2, slot: { row: 'back', index: 0 } }],
    });
    const loaded = deserialize(serialize(s, 123));
    expect(loaded.ok).toBe(true);
    expect(loaded.state).toEqual(s);
    expect(loaded.migrated).toBeFalsy();
  });

  it('конверт несёт версию и время сохранения', () => {
    const env = JSON.parse(serialize(state(), 999)) as SaveEnvelope;
    expect(env.version).toBe(SAVE_VERSION);
    expect(env.savedAt).toBe(999);
  });

  it('сейв из будущей версии отвергается', () => {
    const env = JSON.stringify({ version: SAVE_VERSION + 1, savedAt: 1, state: state() });
    const r = deserialize(env);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/более новой версии/);
  });

  it('битый JSON не роняет игру', () => {
    const r = deserialize('{не json');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/не читается JSON/);
  });

  it('не-объект отвергается', () => {
    expect(deserialize('42').ok).toBe(false);
    expect(deserialize('null').ok).toBe(false);
  });

  it('конверт без версии отвергается', () => {
    const r = deserialize(JSON.stringify({ savedAt: 1, state: state() }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/без версии/);
  });

  it('конверт без состояния отвергается', () => {
    const r = deserialize(JSON.stringify({ version: SAVE_VERSION, savedAt: 1 }));
    expect(r.ok).toBe(false);
  });
});

describe('миграции', () => {
  it('старый сейв прогоняется через цепочку и помечается migrated', () => {
    migrations[0] = (old) => ({ ...old, gold: 55 });
    const legacy = JSON.stringify({ version: 0, savedAt: 1, state: { ...state(), gold: 1 } });
    const r = deserialize(legacy);
    expect(r.ok).toBe(true);
    expect(r.migrated).toBe(true);
    expect(r.state?.gold).toBe(55);
    expect(r.state?.version).toBe(SAVE_VERSION);
  });

  it('без нужной миграции сейв не открывается молча', () => {
    const legacy = JSON.stringify({ version: 0, savedAt: 1, state: state() });
    const r = deserialize(legacy);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Нет миграции с версии 0/);
  });
});

describe('структурная проверка', () => {
  it('конверт с пустым состоянием не выдаётся за валидный сейв', () => {
    const r = deserialize(JSON.stringify({ version: SAVE_VERSION, savedAt: 1, state: {} }));
    expect(r.ok).toBe(false);
  });

  it.each([
    ['seed', 42, /«seed» не строка/],
    ['scene', null, /«scene» не строка/],
    ['node', 7, /«node» не строка/],
    ['gold', '17', /«gold» не число/],
    ['chapter', NaN, /«chapter» не число/],
    ['deaths', undefined, /«deaths» не число/],
    ['party', {}, /«party» не список/],
    ['log', 'пусто', /«log» не список/],
    ['seenNodes', null, /«seenNodes» не список/],
    ['axes', [], /«axes» не словарь/],
    ['flags', 'нет', /«flags» не словарь/],
    ['rng', { seed: 'x', calls: 0 }, /генератора случайных чисел/],
  ])('поле %s неверного типа отвергается с внятной причиной', (key, bad, expected) => {
    const broken = { ...(state() as unknown as Record<string, unknown>), [key]: bad };
    const r = deserialize(JSON.stringify({ version: SAVE_VERSION, savedAt: 1, state: broken }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(expected);
  });

  it('проверка идёт ПОСЛЕ миграций: старое состояние чинится, а не отбраковывается', () => {
    migrations[0] = (old) => ({ ...old, seenNodes: [] });
    const legacy = { ...(state() as unknown as Record<string, unknown>) };
    delete legacy['seenNodes'];
    const r = deserialize(JSON.stringify({ version: 0, savedAt: 1, state: legacy }));
    expect(r.ok).toBe(true);
    expect(r.state?.seenNodes).toEqual([]);
  });

  it('ссылочная целостность не проверяется: сцена из удалённого контента доезжает до движка', () => {
    const r = deserialize(serialize(state({ scene: 'сцены-такой-больше-нет' }), 1));
    expect(r.ok).toBe(true);
  });
});
