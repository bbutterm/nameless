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
  grantXp,
  isPlayerTurn,
  normalizeEntry,
  pushBubble,
  resolve,
  startBattle,
  type Action,
  type BattleState,
  type GameState,
  type Lang,
  type Memory,
  type PastLife,
  type Step,
} from '@nameless/engine';
import { combat, content, idx } from './content';
import { clearSave, loadGame, saveGame } from '../lib/storage';
import { detectLang, saveLang } from '../i18n';
import { vibrate } from '../lib/haptics';
import { playSfx, resume as resumeAudio } from '../lib/sound';

export type Mode = 'title' | 'dialogue' | 'battle' | 'death' | 'end' | 'error';

export interface BattleSpoils {
  levelUps: { uid: string; from: number; to: number }[];
  evolutions: { uid: string; from: string; to: string }[];
}

export interface DeathReveal {
  deathId: string;
  memory?: Memory;
  life?: PastLife;
  lifeAwakened: boolean;
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
      battleReturn.current = { onWin: r.step.node.onWin, onLose: r.step.node.onLose };
      setBattle(startBattle(combat, findBattle(r.step.node.battle), r.state.party, r.state.seed));
      setMode('battle');
      saveGame(r.state);
      return;
    }
    if (r.step.kind === 'death') {
      const deathDef = content.deaths.find((d) => d.id === (r.step as { node: { death: string } }).node.death);
      if (!deathDef) {
        setError(`Нет описания смерти ${(r.step as { node: { death: string } }).node.death}`);
        setMode('error');
        return;
      }
      const out = applyDeath(r.state, content, deathDef, idx.effectCtx);
      setState(out.state);
      setReveal({
        deathId: deathDef.id,
        memory: out.memory,
        life: out.life,
        lifeAwakened: out.lifeAwakened,
      });
      setMode('death');
      vibrate('death');
      playSfx('death');
      saveGame(out.state);
      return;
    }
    if (r.step.kind === 'end') {
      setMode('end');
      saveGame(r.state);
      return;
    }
    setMode('dialogue');
    saveGame(r.state);
  }, []);

  const startNew = useCallback(() => {
    clearSave();
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

  /** Показывает игроку, кто вырос и кто превратился, прежде чем вернуть в сцену. */
  const collectSpoils = useCallback(() => {
    if (!state || !battle || battle.outcome !== 'win') {
      setSpoils(undefined);
      return;
    }
    const xp = grantXp(state, combat.units, 60 + battle.round * 3);
    if (xp.levelUps.length === 0 && xp.evolutions.length === 0) {
      setSpoils(undefined);
      return;
    }
    setSpoils({ levelUps: xp.levelUps, evolutions: xp.evolutions });
  }, [state, battle]);

  const finishBattle = useCallback(() => {
    if (!state || !battle || !battleReturn.current) return;
    setSpoils(undefined);
    const won = battle.outcome === 'win';
    const def = content.battles.find((b) => b.id === battle.battleId);
    // Раны переносятся из боя: отряд не лечится сам собой, только смертью.
    let next: GameState = {
      ...state,
      party: state.party.map((u) => {
        const bu = battle.units.find((x) => x.uid === u.uid);
        return bu ? { ...u, hp: Math.max(won ? 1 : 1, bu.hp) } : u;
      }),
    };
    if (won) {
      next = applyEffects(next, def?.rewards, idx.effectCtx);
      const xp = grantXp(next, combat.units, 60 + battle.round * 3);
      next = xp.state;
    }
    const to = won ? battleReturn.current.onWin : battleReturn.current.onLose;
    battleReturn.current = undefined;
    setBattle(undefined);
    commit(jump(next, to));
  }, [state, battle, commit]);

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

function jump(state: GameState, to: string): GameState {
  if (to.startsWith('scene:')) {
    const rest = to.slice(6);
    const hash = rest.indexOf('#');
    if (hash === -1) return { ...state, scene: rest, node: '@entry' };
    return { ...state, scene: rest.slice(0, hash), node: rest.slice(hash + 1) };
  }
  return { ...state, node: to };
}

function findBattle(id: string) {
  const b = content.battles.find((x) => x.id === id);
  if (b) return b;
  return {
    id,
    name: { ru: 'Стычка', en: 'Skirmish' },
    enemies: [],
  };
}
