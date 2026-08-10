import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  act,
  advance,
  applyDeath,
  applyEffects,
  autoAct,
  choose,
  createInitialState,
  derivePlayerPowers,
  goTo,
  grantXp,
  isPlayerTurn,
  normalizeEntry,
  pushBubble,
  resolve,
  startBattle,
  type Action,
  type BattleState,
  type CodexEntry,
  type GameState,
  type Lang,
  type Memory,
  type PastLife,
  type Step,
} from '@nameless/engine';
import { combat, content, idx } from './content';
import { clearSave, loadGame, saveGame } from '../lib/storage';
import { bumpRuns, commitPending, loadCodex } from '../lib/codex';
import { detectLang, saveLang } from '../i18n';
import { vibrate } from '../lib/haptics';
import { playSfx, resume as resumeAudio } from '../lib/sound';

export type Mode = 'title' | 'dialogue' | 'battle' | 'death' | 'end' | 'error';

export interface BattleSpoils {
  levelUps: { uid: string; from: number; to: number }[];
  evolutions: { uid: string; from: string; to: string }[];
}

/** Одна запись Помянника и строки, которые в неё легли на этой церемонии. */
export interface CodexAddedGroup {
  entry: CodexEntry;
  lineIds: string[];
}

export interface DeathReveal {
  deathId: string;
  memory?: Memory;
  life?: PastLife;
  lifeAwakened: boolean;
  /** Такт 2 церемонии (CODEX §5): что дописалось в Помянник этой смертью. */
  codexAdded: CodexAddedGroup[];
}

interface GameApi {
  ready: boolean;
  mode: Mode;
  state: GameState | undefined;
  step: Step | undefined;
  battle: BattleState | undefined;
  reveal: DeathReveal | undefined;
  spoils: BattleSpoils | undefined;
  lang: Lang;
  error: string | undefined;
  hasSave: boolean;
  setLang(l: Lang): void;
  startNew(): void;
  resume(): void;
  tap(): void;
  pick(optionId: string): void;
  battleAct(action: Action): void;
  battleAuto(): void;
  collectSpoils(): void;
  swapSlots(a: string, b: string): void;
  finishBattle(): void;
  ackDeath(): void;
  toTitle(): void;
}

const Ctx = createContext<GameApi | undefined>(undefined);

function firstChapterEntry(): { chapter: number; scene: string } {
  const ch = [...content.chapters].sort((a, b) => a.index - b.index)[0];
  return { chapter: ch?.index ?? 1, scene: ch?.entryScene ?? '' };
}

/**
 * Опыт за бой. Единственное место, где живёт формула: экран итогов и настоящее
 * начисление обязаны считать одно и то же число.
 */
const BATTLE_XP_BASE = 60;
const BATTLE_XP_PER_ROUND = 3;

function battleXp(battle: BattleState): number {
  return BATTLE_XP_BASE + battle.round * BATTLE_XP_PER_ROUND;
}

interface Settled {
  state: GameState;
  spoils?: BattleSpoils;
}

/**
 * Единственный конвейер исхода боя: раны из боя, награды узла, опыт за бой.
 * Итоги (`spoils`) — это ДИФФ отряда до и после прогона, а не отдельный расчёт:
 * раньше экран итогов считал прирост от состояния ДО наград, и эволюция,
 * доехавшая на опыте из награды боя, происходила по-настоящему, но игроку
 * не показывалась. Диффом ловится и повышение уровня от одной только награды —
 * `grantXp` о нём не сообщает, потому что `applyEffects` уже поднял уровень.
 */
function settleBattle(state: GameState, battle: BattleState): Settled {
  const won = battle.outcome === 'win';
  const def = content.battles.find((b) => b.id === battle.battleId);
  // Раны переносятся из боя: отряд не лечится сам собой, только смертью.
  // Порог в 1 hp одинаков для победы и поражения, и вариантов тут нет: юнит
  // с нулём hp не восстановится сам, а проигранный бой всё равно ведёт в
  // церемонию смерти (`onLose` → узел death), где отряд лечится целиком.
  let next: GameState = {
    ...state,
    party: state.party.map((u) => {
      const bu = battle.units.find((x) => x.uid === u.uid);
      return bu ? { ...u, hp: Math.max(1, bu.hp) } : u;
    }),
  };
  if (!won) return { state: next };

  next = applyEffects(next, def?.rewards, idx.effectCtx);
  next = grantXp(next, combat.units, battleXp(battle)).state;

  const before = new Map(state.party.map((u) => [u.uid, u]));
  const levelUps: BattleSpoils['levelUps'] = [];
  const evolutions: BattleSpoils['evolutions'] = [];
  for (const u of next.party) {
    const was = before.get(u.uid);
    if (!was) continue;
    if (was.defId !== u.defId) evolutions.push({ uid: u.uid, from: was.defId, to: u.defId });
    if (was.level !== u.level) levelUps.push({ uid: u.uid, from: was.level, to: u.level });
  }
  const spoils =
    levelUps.length > 0 || evolutions.length > 0 ? { levelUps, evolutions } : undefined;
  return { state: next, spoils };
}

/**
 * Переносит найденные за забег строки Помянника в хранилище и группирует их
 * по записям — для такта церемонии («В Помянник дописано: N», CODEX §5).
 * Единственное место в клиенте, где книга пишется (кроме финала забега,
 * см. `commit`): вызывается только на церемонии смерти и на конце игры.
 */
function commitCodex(pending: readonly string[]): CodexAddedGroup[] {
  const addedIds = commitPending(pending, loadCodex().runs);
  const groups = new Map<string, CodexAddedGroup>();
  for (const id of addedIds) {
    const entry = idx.codex.entryOfLine.get(id);
    if (!entry) continue; // не бывает: id пришёл из того же индекса
    const g = groups.get(entry.id);
    if (g) g.lineIds.push(id);
    else groups.set(entry.id, { entry, lineIds: [id] });
  }
  return [...groups.values()];
}

/** Доводит состояние до ближайшего показываемого шага, попутно копя ленту. */
function present(state: GameState): { state: GameState; step: Step } {
  const r = resolve(idx, normalizeEntry(idx, state));
  if (r.step.kind === 'bubble') {
    return { state: pushBubble(r.state, r.step.node), step: r.step };
  }
  return { state: r.state, step: r.step };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>();
  const [step, setStep] = useState<Step>();
  const [mode, setMode] = useState<Mode>('title');
  const [battle, setBattle] = useState<BattleState>();
  const [reveal, setReveal] = useState<DeathReveal>();
  const [spoils, setSpoils] = useState<BattleSpoils>();
  const [lang, setLangState] = useState<Lang>(detectLang());
  const [error, setError] = useState<string>();
  const [saveExists, setSaveExists] = useState(false);
  const battleReturn = useRef<{ onWin: string; onLose: string }>();
  const settledRef = useRef<{ from: GameState; battle: BattleState; result: Settled }>();

  useEffect(() => {
    const loaded = loadGame();
    setSaveExists(!!loaded.state);
    if (loaded.error) setError(loaded.error);
  }, []);

  const commit = useCallback((next: GameState) => {
    const r = present(next);
    setState(r.state);
    setStep(r.step);
    if (r.step.kind === 'error') {
      setError(r.step.message);
      setMode('error');
      return;
    }
    if (r.step.kind === 'battle') {
      const node = r.step.node;
      // Битый id боя раньше подменялся боем без врагов — и checkOutcome объявлял
      // победу на первом же раунде. Валидатор ловит такое на сборке, но если
      // валидацию не гоняли, игрок получал молча выигранный пустой бой вместо
      // сообщения о поломанном контенте.
      const battleDef = content.battles.find((b) => b.id === node.battle);
      if (!battleDef) {
        setError(`Нет описания боя ${node.battle}`);
        setMode('error');
        return;
      }
      battleReturn.current = { onWin: node.onWin, onLose: node.onLose };
      // Умения игрока выводятся из закреплённых воспоминаний в момент входа в
      // бой: хранить их между боями негде и незачем — источник правды один.
      const powers = derivePlayerPowers(r.state.lockedMemories, content).abilities;
      setBattle(startBattle(combat, battleDef, r.state.party, r.state.seed, powers));
      setMode('battle');
      saveGame(r.state);
      return;
    }
    if (r.step.kind === 'death') {
      const node = r.step.node;
      const deathDef = content.deaths.find((d) => d.id === node.death);
      if (!deathDef) {
        setError(`Нет описания смерти ${node.death}`);
        setMode('error');
        return;
      }
      const out = applyDeath(r.state, content, deathDef, idx.effectCtx);
      // Помянник пишется по мёртвому времени (CODEX §4): найденное за забег
      // ложится в книгу здесь и только здесь, вместе с лотом. codexPending
      // после этого пуст — бросить книгу на середине смерти нельзя.
      const codexAdded = commitCodex(out.state.codexPending);
      const afterCodex: GameState = { ...out.state, codexPending: [] };
      setState(afterCodex);
      setReveal({
        deathId: deathDef.id,
        memory: out.memory,
        life: out.life,
        lifeAwakened: out.lifeAwakened,
        codexAdded,
      });
      setMode('death');
      vibrate('death');
      playSfx('death');
      saveGame(afterCodex);
      return;
    }
    if (r.step.kind === 'end') {
      // Финал забега — второе (и последнее) место записи в Помянник (CODEX §9).
      // Такта на экране здесь нет: игра и так кончилась, поздравлять нечего.
      commitCodex(r.state.codexPending);
      const afterCodex: GameState = { ...r.state, codexPending: [] };
      setState(afterCodex);
      setMode('end');
      saveGame(afterCodex);
      return;
    }
    setMode('dialogue');
    saveGame(r.state);
  }, []);

  const startNew = useCallback(() => {
    clearSave();
    // Забег — единица счёта Помянника (CODEX §4, §9): считаем по «Новой игре»,
    // а не по смертям, потому что смерть здесь продолжает забег, а не кончает его.
    bumpRuns();
    const entry = firstChapterEntry();
    const fresh = createInitialState({
      seed: `run-${Date.now().toString(36)}`,
      axes: content.axes.map((a) => ({ id: a.id, start: a.start })),
      chapter: entry.chapter,
      scene: entry.scene,
      node: '@entry',
      now: Date.now(),
    });
    void resumeAudio();
    setReveal(undefined);
    setBattle(undefined);
    setError(undefined);
    setSaveExists(true);
    commit(fresh);
  }, [commit]);

  const resume = useCallback(() => {
    void resumeAudio();
    const loaded = loadGame();
    if (!loaded.state) {
      setError(loaded.error ?? 'Сейва нет');
      return;
    }
    setError(undefined);
    commit(loaded.state);
  }, [commit]);

  const tap = useCallback(() => {
    if (!state || step?.kind !== 'bubble') return;
    vibrate('tap');
    playSfx('bubble');
    commit(advance(idx, state));
  }, [state, step, commit]);

  const pick = useCallback(
    (optionId: string) => {
      if (!state || step?.kind !== 'choice') return;
      vibrate('choice');
      playSfx('choice');
      commit(choose(idx, state, optionId));
    },
    [state, step, commit],
  );

  const battleAct = useCallback((action: Action) => {
    setBattle((b) => {
      if (!b || b.outcome !== 'ongoing' || !isPlayerTurn(b)) return b;
      return act(combat, b, action);
    });
  }, []);

  /**
   * Один ход бота. Экран боя вызывает это по таймеру, пока очередь не дойдёт до
   * игрока: прокручивать все вражеские ходы разом нельзя — тогда игрок увидит
   * только итог, без рывков карт и всплывающих цифр.
   */
  const battleAuto = useCallback(() => {
    setBattle((b) => {
      if (!b || b.outcome !== 'ongoing' || isPlayerTurn(b)) return b;
      return autoAct(combat, b);
    });
  }, []);

  /**
   * Один прогон исхода на бой: экран итогов и переход в сцену обязаны видеть
   * ОДИН И ТОТ ЖЕ результат, поэтому он считается однажды и запоминается.
   */
  const settle = useCallback((from: GameState, fought: BattleState): Settled => {
    const cached = settledRef.current;
    if (cached && cached.from === from && cached.battle === fought) return cached.result;
    const result = settleBattle(from, fought);
    settledRef.current = { from, battle: fought, result };
    return result;
  }, []);

  /** Показывает игроку, кто вырос и кто превратился, прежде чем вернуть в сцену. */
  const collectSpoils = useCallback(() => {
    if (!state || !battle || battle.outcome === 'ongoing') {
      setSpoils(undefined);
      return;
    }
    setSpoils(settle(state, battle).spoils);
  }, [state, battle, settle]);

  const finishBattle = useCallback(() => {
    if (!state || !battle || !battleReturn.current) return;
    setSpoils(undefined);
    const won = battle.outcome === 'win';
    const settled = settle(state, battle);
    const to = won ? battleReturn.current.onWin : battleReturn.current.onLose;
    battleReturn.current = undefined;
    settledRef.current = undefined;
    setBattle(undefined);
    commit(goTo(settled.state, to));
  }, [state, battle, commit, settle]);

  /**
   * Перестановка строя. Спека требует, чтобы игрок сам решал, кто стоит впереди:
   * передний ряд прикрывает задний, и это единственный способ защитить стрелков.
   */
  const swapSlots = useCallback((a: string, b: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const ua = prev.party.find((u) => u.uid === a);
      const ub = prev.party.find((u) => u.uid === b);
      if (!ua || !ub) return prev;
      const next = {
        ...prev,
        party: prev.party.map((u) =>
          u.uid === a ? { ...u, slot: ub.slot } : u.uid === b ? { ...u, slot: ua.slot } : u,
        ),
      };
      saveGame(next);
      return next;
    });
  }, []);

  const ackDeath = useCallback(() => {
    if (!state) return;
    setReveal(undefined);
    commit(state);
  }, [state, commit]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    saveLang(l);
  }, []);

  const toTitle = useCallback(() => {
    setMode('title');
    setSaveExists(true);
  }, []);

  const api = useMemo<GameApi>(
    () => ({
      ready: true,
      mode,
      state,
      step,
      battle,
      reveal,
      spoils,
      lang,
      error,
      hasSave: saveExists,
      setLang,
      startNew,
      resume,
      tap,
      pick,
      battleAct,
      battleAuto,
      collectSpoils,
      swapSlots,
      finishBattle,
      ackDeath,
      toTitle,
    }),
    [
      mode,
      state,
      step,
      battle,
      reveal,
      spoils,
      lang,
      error,
      saveExists,
      setLang,
      startNew,
      resume,
      tap,
      pick,
      battleAct,
      battleAuto,
      collectSpoils,
      swapSlots,
      finishBattle,
      ackDeath,
      toTitle,
    ],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useGame(): GameApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGame вне GameProvider');
  return ctx;
}
