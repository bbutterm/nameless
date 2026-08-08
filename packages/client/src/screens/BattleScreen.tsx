import { useEffect, useMemo, useRef, useState } from 'react';
import {
  currentActor,
  isPlayerTurn,
  legalTargets,
  readyAbilities,
  type Ability,
  type BattleEvent,
  type BattleUnitState,
} from '@nameless/engine';
import { UnitCard, type FloatingNumber } from '../components/UnitCard';
import { Icon } from '../components/Icon';
import { loc, t } from '../i18n';
import { useGame } from '../store/game';
import { combat, content } from '../store/content';
import { vibrate } from '../lib/haptics';
import { playSfx } from '../lib/sound';
import { backgroundSvg, svgDataUri } from '../lib/art';
import { TutorialHint } from '../components/Tutorial';

type Anim = Record<string, 'lunge-up' | 'lunge-down' | 'hit' | 'die' | undefined>;

let floatId = 0;

export function BattleScreen() {
  const { battle, lang, battleAct, battleAuto, collectSpoils, spoils, finishBattle } = useGame();
  const [selectedAbility, setSelectedAbility] = useState<Ability>();
  const [anims, setAnims] = useState<Anim>({});
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  const seenEvents = useRef(0);

  const defs = useMemo(() => new Map(content.units.map((u) => [u.id, u])), []);

  // Новые события боя превращаем в анимацию карточек и всплывающие цифры.
  useEffect(() => {
    if (!battle) return;
    const fresh = battle.events.slice(seenEvents.current);
    seenEvents.current = battle.events.length;
    if (fresh.length === 0) return;

    const nextAnims: Anim = {};
    const nextFloats: FloatingNumber[] = [];
    for (const e of fresh as BattleEvent[]) {
      if (e.type === 'act') {
        const actor = battle.units.find((u) => u.uid === e.uid);
        nextAnims[e.uid] = actor?.side === 'player' ? 'lunge-up' : 'lunge-down';
      }
      if (e.type === 'damage') {
        nextAnims[e.uid] = 'hit';
        nextFloats.push({ id: floatId++, uid: e.uid, amount: e.amount, kind: e.crit ? 'crit' : 'damage' });
      }
      if (e.type === 'heal') {
        nextFloats.push({ id: floatId++, uid: e.uid, amount: e.amount, kind: 'heal' });
      }
      if (e.type === 'death') nextAnims[e.uid] = 'die';
    }
    if (fresh.some((e) => e.type === 'damage' && e.crit)) {
      vibrate('crit');
      playSfx('crit');
    } else if (fresh.some((e) => e.type === 'damage')) {
      vibrate('hit');
      playSfx('hit');
    }
    const done = fresh.find((e) => e.type === 'outcome');
    if (done && done.type === 'outcome') playSfx(done.result === 'win' ? 'victory' : 'defeat');

    setAnims(nextAnims);
    setFloats((f) => [...f, ...nextFloats]);
    const clearAnims = setTimeout(() => setAnims({}), 420);
    const clearFloats = setTimeout(
      () => setFloats((f) => f.filter((x) => !nextFloats.some((n) => n.id === x.id))),
      900,
    );
    return () => {
      clearTimeout(clearAnims);
      clearTimeout(clearFloats);
    };
  }, [battle]);

  // Ходы противника прокручиваются по одному, с паузой на анимацию.
  // Без этого бой замирал: если первым по инициативе идёт враг, ходить было некому.
  const waitingForBots = !!battle && battle.outcome === 'ongoing' && !isPlayerTurn(battle);
  const finished = !!battle && battle.outcome !== 'ongoing';
  // Итоги считаются один раз, когда бой закончился: игрок должен увидеть,
  // кто вырос и кто превратился, а не обнаружить это потом в описи.
  useEffect(() => {
    if (finished) collectSpoils();
  }, [finished, collectSpoils]);
  useEffect(() => {
    if (!waitingForBots) return;
    const timer = setTimeout(battleAuto, 480);
    return () => clearTimeout(timer);
  }, [waitingForBots, battle, battleAuto]);

  if (!battle) return null;

  const actor = currentActor(battle);
  const myTurn = isPlayerTurn(battle);
  const abilities = actor && myTurn ? readyAbilities(combat, actor) : [];
  const targets =
    actor && selectedAbility ? legalTargets(battle, actor.uid, selectedAbility).map((u) => u.uid) : [];

  const slot = (side: 'player' | 'enemy', row: 'front' | 'back', index: number) =>
    battle.units.find((u) => u.side === side && u.row === row && u.index === index);

  const renderRow = (side: 'player' | 'enemy', row: 'front' | 'back') => (
    <div className={`row row-${row}`}>
      {[0, 1, 2].map((i) => {
        const u = slot(side, row, i);
        if (!u) return <div key={i} className="card empty" />;
        return (
          <UnitCard
            key={u.uid}
            unit={u}
            def={defs.get(u.defId)}
            lang={lang}
            selected={actor?.uid === u.uid && myTurn}
            targetable={targets.includes(u.uid)}
            anim={anims[u.uid]}
            floats={floats.filter((f) => f.uid === u.uid)}
            onTap={() => onTapUnit(u)}
          />
        );
      })}
    </div>
  );

  function onTapUnit(u: BattleUnitState) {
    if (!myTurn || !actor) return;
    if (selectedAbility && targets.includes(u.uid)) {
      vibrate('tap');
      battleAct({ ability: selectedAbility.id, targetUid: u.uid });
      setSelectedAbility(undefined);
      return;
    }
    // Тап по своей карте = выбрать её базовое действие.
    if (u.uid === actor.uid && abilities.length > 0) {
      setSelectedAbility(abilities[0]);
    }
  }

  const over = battle.outcome !== 'ongoing';

  return (
    <div className="screen battle">
      <img className="scene-bg" src={svgDataUri(backgroundSvg(battle.battleId))} alt="" draggable={false} />

      <div className="battle-top">
        <span>
          {t(lang, 'round')} {battle.round}
        </span>
        <span className="battle-title">{loc(content.battles.find((b) => b.id === battle.battleId)?.name, lang)}</span>
      </div>

      {/* Подсказка боя стоит в потоке, над полем: всплывашка с anchor="top"
          ложилась ровно на задний ряд врага и на первые 6.5 секунды первого
          боя прятала и имена, и иконки намерений — то есть ровно то, о чём
          сама же и рассказывает. */}
      {!over && (
        <div className="tutorial-slot">
          <TutorialHint step="battle" lang={lang} anchor="flow" />
        </div>
      )}

      <div className="field">
        <div className="side enemy-side">
          {renderRow('enemy', 'back')}
          {renderRow('enemy', 'front')}
        </div>
        <div className="divider" />
        <div className="side player-side">
          {renderRow('player', 'front')}
          {renderRow('player', 'back')}
        </div>
      </div>

      {!over && (
        <div className="ability-bar">
          {myTurn ? (
            abilities.map((a) => (
              <button
                key={a.id}
                className={`ability ${selectedAbility?.id === a.id ? 'active' : ''}`}
                onClick={() => {
                  vibrate('tap');
                  setSelectedAbility(a);
                }}
              >
                <Icon name={a.icon} size={22} />
                <span>{loc(a.name, lang)}</span>
              </button>
            ))
          ) : (
            <div className="waiting">…</div>
          )}
        </div>
      )}

      {!over && myTurn && (
        <div className="battle-hint">
          {selectedAbility ? t(lang, 'chooseTarget') : t(lang, 'yourTurn')}
        </div>
      )}

      {!over && <TutorialHint step="battle" lang={lang} anchor="top" />}

      {over && (
        <div className="battle-over">
          <div className={`outcome ${battle.outcome}`}>
            {battle.outcome === 'win' ? t(lang, 'victory') : t(lang, 'defeat')}
          </div>
          {spoils && (
            <div className="spoils">
              {spoils.evolutions.map((e) => (
                <div key={e.uid} className="spoil evolve">
                  <Icon name="wing" size={14} color="var(--tier-3)" />
                  <span>
                    {t(lang, 'evolved')}: {loc(defs.get(e.from)?.name, lang)} →{' '}
                    {loc(defs.get(e.to)?.name, lang)}
                  </span>
                </div>
              ))}
              {spoils.levelUps.map((l) => (
                <div key={l.uid} className="spoil">
                  <Icon name="coin" size={14} color="var(--accent)" />
                  <span>
                    {loc(defs.get(battle.units.find((u) => u.uid === l.uid)?.defId ?? '')?.name, lang)}
                    {' — '}
                    {t(lang, 'levelUp')} {l.to}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button className="big-button" onClick={finishBattle}>
            {t(lang, 'proceed')}
          </button>
        </div>
      )}
    </div>
  );
}
