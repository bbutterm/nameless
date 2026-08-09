import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ThreatLayer, type ThreatLink } from '../components/ThreatLayer';
import { TurnQueue } from '../components/TurnQueue';
import { Icon } from '../components/Icon';
import { loc, t } from '../i18n';
import { useGame } from '../store/game';
import { combat, content } from '../store/content';
import { vibrate } from '../lib/haptics';
import { playSfx } from '../lib/sound';
import { backgroundSvg, svgDataUri } from '../lib/art';
import { TutorialHint } from '../components/Tutorial';
import {
  abilityChips,
  blockReason,
  isCovered,
  previewFor,
  spanOverTargets,
  type Preview,
} from '../lib/combatRead';

type Anim = Record<string, 'lunge-up' | 'lunge-down' | 'hit' | 'die' | undefined>;

let floatId = 0;

/** Столько держим палец на способности, чтобы увидеть её разбор. */
const HOLD_MS = 380;
/** Столько висит объяснение «почему сюда нельзя». */
const REASON_MS = 2600;

export function BattleScreen() {
  const { battle, lang, battleAct, battleAuto, collectSpoils, spoils, finishBattle } = useGame();
  const [selectedAbility, setSelectedAbility] = useState<Ability>();
  const [peek, setPeek] = useState<Ability>();
  const [reason, setReason] = useState<string>();
  const [anims, setAnims] = useState<Anim>({});
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  const seenEvents = useRef(0);
  const fieldRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const heldOpen = useRef(false);

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

  // Объяснение запрета живёт пару секунд и уходит само.
  useEffect(() => {
    if (!reason) return;
    const timer = setTimeout(() => setReason(undefined), REASON_MS);
    return () => clearTimeout(timer);
  }, [reason]);

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

  const endHold = useCallback(() => {
    clearTimeout(holdTimer.current);
  }, []);

  if (!battle) return null;
  // Псевдоним под сужение типа: onTapUnit — объявление функции, и внутри него
  // TypeScript про проверку выше уже не помнит.
  const live = battle;

  const actor = currentActor(battle);
  const myTurn = isPlayerTurn(battle);
  const abilities = actor && myTurn ? readyAbilities(combat, actor) : [];
  const legal = actor && selectedAbility && myTurn ? legalTargets(battle, actor.uid, selectedAbility) : [];
  const targets = legal.map((u) => u.uid);
  const over = battle.outcome !== 'ongoing';

  const nameOf = (u: BattleUnitState | undefined) =>
    u ? loc(defs.get(u.defId)?.name, lang) : '';

  // Предпросмотр урона: считается по той же формуле, что и настоящий удар,
  // и ложится прямо на карточку цели — «тыкаю» превращается в «считаю».
  const previews = new Map<string, Preview>();
  if (actor && selectedAbility && myTurn) {
    for (const tgt of legal) {
      const p = previewFor(actor, tgt, selectedAbility, lang);
      if (p) previews.set(tgt.uid, p);
    }
  }

  // Кто в кого метит. Иконка намерения висела над врагом и раньше — не было
  // видно цели, хотя движок её знает (`intent.targetUid`).
  const soonestEnemy = battle.order.slice(battle.turnIndex).find((uid) => {
    const u = battle.units.find((x) => x.uid === uid);
    return !!u && u.alive && u.side === 'enemy' && !u.acted && !!u.intent;
  });
  const links: ThreatLink[] = [];
  const threatened = new Map<string, 'danger' | 'ally'>();
  if (!over) {
    for (const u of battle.units) {
      if (u.side !== 'enemy' || !u.alive || u.acted || !u.intent?.targetUid) continue;
      const tgt = battle.units.find((x) => x.uid === u.intent!.targetUid);
      if (!tgt || !tgt.alive) continue;
      const tone: 'danger' | 'ally' = tgt.side === 'player' ? 'danger' : 'ally';
      links.push({ fromUid: u.uid, toUid: tgt.uid, tone, strong: u.uid === soonestEnemy });
      // Ярлык «в тебя метят» остаётся, даже если пунктир не поместился.
      if (threatened.get(tgt.uid) !== 'danger') threatened.set(tgt.uid, tone);
    }
  }

  const slot = (side: 'player' | 'enemy', row: 'front' | 'back', index: number) =>
    battle.units.find((u) => u.side === side && u.row === row && u.index === index);

  const renderRow = (side: 'player' | 'enemy', row: 'front' | 'back') => (
    <div className={`row row-${row}`}>
      {[0, 1, 2].map((i) => {
        const u = slot(side, row, i);
        if (!u) return <div key={i} className="card empty" />;
        const covered =
          !!actor && !!selectedAbility && myTurn && isCovered(battle, actor, selectedAbility, u);
        return (
          <UnitCard
            key={u.uid}
            unit={u}
            def={defs.get(u.defId)}
            lang={lang}
            selected={actor?.uid === u.uid && myTurn}
            targetable={targets.includes(u.uid)}
            threatened={threatened.get(u.uid)}
            covered={covered}
            coveredLabel={t(lang, 'coveredShort')}
            preview={previews.get(u.uid)}
            anim={anims[u.uid]}
            floats={floats.filter((f) => f.uid === u.uid)}
            intentName={u.intent ? loc(combat.abilities.get(u.intent.ability)?.name, lang) : undefined}
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
      setPeek(undefined);
      setReason(undefined);
      return;
    }
    // Тап по своей карте = выбрать её базовое действие.
    if (u.uid === actor.uid && abilities.length > 0) {
      setSelectedAbility(abilities[0]);
      return;
    }
    // Тап по недоступной цели раньше не делал ничего — игрок не понимал, сломалась
    // игра или так задумано. Теперь карта отвечает словами.
    vibrate('tap');
    setReason(
      selectedAbility
        ? blockReason(live, actor, selectedAbility, u, lang)
        : t(lang, 'chooseAbility'),
    );
  }

  const startHold = (a: Ability) => {
    clearTimeout(holdTimer.current);
    heldOpen.current = false;
    holdTimer.current = setTimeout(() => {
      heldOpen.current = true;
      setPeek(a);
      vibrate('tap');
    }, HOLD_MS);
  };

  const shown = peek ?? selectedAbility;
  const shownSpan = shown && actor ? spanOverTargets(actor, legal, shown, lang) : undefined;

  // Одна служебная строка над панелью отвечает на все три вопроса разом:
  // чей ход, что делает выбранная способность и почему цель недоступна.
  const hint = (() => {
    if (reason) return <span className="hint-block">{reason}</span>;
    if (!myTurn && actor) {
      const ab = actor.intent ? combat.abilities.get(actor.intent.ability) : undefined;
      const tgt = battle.units.find((u) => u.uid === actor.intent?.targetUid);
      return (
        <span className="hint-turn">
          {t(lang, 'turnOf')}: <b>{nameOf(actor)}</b>
          {ab && (
            <>
              {' · '}
              <Icon name={ab.icon} size={12} />
              <span className="hint-ability">{loc(ab.name, lang)}</span>
              {tgt && (
                <span className="hint-target">
                  {' → '}
                  {nameOf(tgt)}
                </span>
              )}
            </>
          )}
        </span>
      );
    }
    if (shown) {
      return (
        <span className="hint-turn">
          <Icon name={shown.icon} size={12} />
          <span className="hint-ability">{loc(shown.name, lang)}</span>
          {shownSpan && <span className="chip-dmg">{shownSpan}</span>}
          {abilityChips(shown, lang).map((c) => (
            <span key={c} className="chip-info">
              {c}
            </span>
          ))}
        </span>
      );
    }
    return (
      <span className="hint-turn">
        {t(lang, 'yourTurn')}: <b>{nameOf(actor)}</b>
        <span className="hint-hold">· {t(lang, 'holdForInfo')}</span>
      </span>
    );
  })();

  return (
    <div className="screen battle">
      <img className="scene-bg" src={svgDataUri(backgroundSvg(battle.battleId))} alt="" draggable={false} />

      <div className="battle-top">
        <div className="battle-top-line">
          <span>
            {t(lang, 'round')} {battle.round}
          </span>
          <span className="battle-title">{loc(content.battles.find((b) => b.id === battle.battleId)?.name, lang)}</span>
        </div>
        {!over && <TurnQueue battle={battle} defs={defs} lang={lang} />}
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

      <div ref={fieldRef} className={`field ${myTurn && selectedAbility ? 'targeting' : ''}`}>
        <ThreatLayer containerRef={fieldRef} links={links} dim={myTurn && !!selectedAbility} />
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
        <div className="battle-panel">
          {/* Разбор способности по долгому тапу. Слой абсолютный: панель не
              прыгает, поле боя не сжимается. */}
          {peek && (
            <div className="ability-peek" onClick={() => setPeek(undefined)}>
              <div className="peek-head">
                <Icon name={peek.icon} size={16} color="var(--accent)" />
                <b>{loc(peek.name, lang)}</b>
              </div>
              <div className="peek-desc">{loc(peek.description, lang)}</div>
              <div className="peek-chips">
                {shownSpan && <span className="chip-dmg">{shownSpan}</span>}
                {abilityChips(peek, lang).map((c) => (
                  <span key={c} className="chip-info">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="battle-hint">{hint}</div>

          <div className="ability-bar">
            {myTurn ? (
              abilities.map((a) => (
                <button
                  key={a.id}
                  className={`ability ${selectedAbility?.id === a.id ? 'active' : ''}`}
                  onPointerDown={() => startHold(a)}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  onPointerCancel={endHold}
                  onClick={() => {
                    endHold();
                    // Долгий тап уже показал разбор — не превращаем его в выбор.
                    if (heldOpen.current) {
                      heldOpen.current = false;
                      return;
                    }
                    vibrate('tap');
                    setPeek(undefined);
                    setReason(undefined);
                    setSelectedAbility(a);
                  }}
                >
                  <Icon name={a.icon} size={22} />
                  <span>{loc(a.name, lang)}</span>
                </button>
              ))
            ) : (
              <div className="waiting">
                <span className="waiting-dot" />
              </div>
            )}
          </div>
        </div>
      )}

      {over && (
        <div className="battle-over">
          <div className={`outcome ${battle.outcome}`}>
            {battle.outcome === 'win'
              ? t(lang, 'victory')
              : battle.outcome === 'draw'
                ? t(lang, 'battleDraw')
                : t(lang, 'battleLost')}
          </div>
          {/* Проигранный бой — не провал, а переход: смерть здесь единственный
              работающий способ вернуть себе себя (канон). Красное «Поражение»
              тридцатым кеглем спорило с церемонией, которая начиналась через
              три секунды после него. */}
          {battle.outcome !== 'win' && <div className="outcome-note">{t(lang, 'battleLostNote')}</div>}
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
