import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  currentActor,
  isPlayerTurn,
  legalTargets,
  playerAbilityBar,
  readyAbilities,
  PARTY_SLOTS_PER_ROW,
  type Ability,
  type BattleEvent,
  type BattleUnitState,
} from '@nameless/engine';
import { UnitCard, type FloatingNumber, type ThreatMark } from '../components/UnitCard';
import { TurnQueue } from '../components/TurnQueue';
import { Icon } from '../components/Icon';
import { loc, t } from '../i18n';
import { useGame } from '../store/game';
import { combat, content } from '../store/content';
import { vibrate } from '../lib/haptics';
import { playSfx, setAir } from '../lib/sound';
import { backgroundImage, backgroundSvg, svgDataUri } from '../lib/art';
import { placeEmblem, placeKey, placeTone, unitEmblem } from '../lib/emblems';
import { TutorialHint } from '../components/Tutorial';
import {
  abilityChips,
  abilityGist,
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
/** Столько живёт всплывающая цифра — ровно длина анимации .float в screens.css. */
const FLOAT_MS = 900;
/** Столько держится рывок/тряска карточки. */
const ANIM_MS = 420;
/** Ряд отряда — три слота; столько же у врага. */
const SLOTS = Array.from({ length: PARTY_SLOTS_PER_ROW }, (_, i) => i);

export function BattleScreen() {
  const { battle, lang, battleAct, battleAuto, collectSpoils, spoils, finishBattle } = useGame();
  const [selectedAbility, setSelectedAbility] = useState<Ability>();
  const [peek, setPeek] = useState<Ability>();
  const [reason, setReason] = useState<string>();
  const [anims, setAnims] = useState<Anim>({});
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  const seenEvents = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const heldOpen = useRef(false);
  // Таймеры уборки живут в ref, а не в cleanup эффекта: ходы идут чаще, чем
  // гаснут цифры (бот ходит раз в 480 мс, цифра висит 900 мс), и cleanup при
  // каждом новом ходе отменял бы уборку предыдущей партии — старые floats
  // копились бы в стейте и в DOM до конца боя, невидимые из-за opacity 0.
  const floatTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animTimer = useRef<ReturnType<typeof setTimeout>>();

  const defs = useMemo(() => new Map(content.units.map((u) => [u.id, u])), []);

  const clearViewTimers = useCallback(() => {
    for (const timer of floatTimers.current) clearTimeout(timer);
    floatTimers.current = [];
    clearTimeout(animTimer.current);
    animTimer.current = undefined;
  }, []);

  /** Забыть всё, что нарисовано от предыдущего боя. */
  const resetBattleView = useCallback(() => {
    clearViewTimers();
    seenEvents.current = 0;
    setFloats([]);
    setAnims({});
    setSelectedAbility(undefined);
    setPeek(undefined);
    setReason(undefined);
  }, [clearViewTimers]);

  // Экран боя не размонтируется между боями: узел onWin может вести прямо в
  // следующий бой, и тогда mode всё время остаётся 'battle'. Без явного сброса
  // счётчик seenEvents оставался от прошлого боя, и первая пачка событий нового
  // (намерения врагов, урон эффектов первого раунда) молча пропадала из
  // анимаций, а floats и рывки старого боя переезжали в новый.
  // Объявлен ДО эффекта событий: React выполняет эффекты в порядке объявления,
  // так что на смене боя сначала сброс, потом разбор свежей ленты.
  const battleId = battle?.battleId;
  useEffect(() => {
    resetBattleView();
    return clearViewTimers;
  }, [battleId, resetBattleView, clearViewTimers]);

  // Воздух боя берётся от самого боя, а не от сцены, из которой в него вошли:
  // драка на мостках звучит дорогой в Выцветь, а не залом, где о ней говорили.
  useEffect(() => {
    if (battleId) setAir(placeKey(battleId));
  }, [battleId]);

  // Новые события боя превращаем в анимацию карточек и всплывающие цифры.
  useEffect(() => {
    if (!battle) return;
    // Тот же бой начат заново (id совпал, лента откатилась к началу) — id не
    // сменился, а смотреть надо с нуля.
    if (battle.events.length < seenEvents.current) resetBattleView();
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

    // Анимации карточек заменяются целиком, поэтому её таймер один на экран.
    clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => setAnims({}), ANIM_MS);

    // А каждая партия цифр убирает СЕБЯ и досматривает свои 900 мс до конца,
    // даже если за это время случилось ещё три хода.
    const batch = new Set(nextFloats.map((f) => f.id));
    if (batch.size > 0) {
      const timer = setTimeout(() => {
        floatTimers.current = floatTimers.current.filter((x) => x !== timer);
        setFloats((f) => f.filter((x) => !batch.has(x.id)));
      }, FLOAT_MS);
      floatTimers.current.push(timer);
    }
  }, [battle, resetBattleView]);

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
  const drawnBg = backgroundImage(battle.battleId, placeKey(battle.battleId));

  const actor = currentActor(battle);
  const myTurn = isPlayerTurn(battle);
  const abilities = actor && myTurn ? readyAbilities(combat, actor) : [];
  /*
   * Умения памяти — ромбы у левого края той же панели, и это не пятая
   * способность юнита, а другая вещь другой формы (MEMORY_POWERS §B.3).
   * Пассив («Опись») в панель не попадает вовсе: движок его отфильтровал,
   * потому что кнопки у него нет — его интерфейс это сами цифры на врагах.
   *
   * Умение применяется вместо хода того юнита, чья очередь: герой отодвигает
   * своего человека и делает сам. Поэтому ромб живёт в общей панели, а не в
   * отдельной полосе — размен «чей ход я отдаю» должен быть виден рядом с
   * тем, что этот ход мог бы сделать.
   */
  const powers = playerAbilityBar(battle);
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

  // Кто в кого метит. Связь показываем НА КАРТЕ ЖЕРТВЫ — знаком нападающего,
  // а не линией через доску. Линия масштабировалась плохо: при полном строю
  // шесть пунктиров пересекали и чужой передний ряд, и свой, и вместо ответа
  // «кого ударят» игрок видел клубок (долг итерации 1). Знак нападающего
  // растёт линейно и остаётся внутри той карточки, про которую он говорит.
  const soonestEnemy = battle.order.slice(battle.turnIndex).find((uid) => {
    const u = battle.units.find((x) => x.uid === uid);
    return !!u && u.alive && u.side === 'enemy' && !u.acted && !!u.intent;
  });
  const threatened = new Map<string, 'danger' | 'ally'>();
  const incoming = new Map<string, ThreatMark[]>();
  if (!over) {
    for (const u of battle.units) {
      if (u.side !== 'enemy' || !u.alive || u.acted || !u.intent?.targetUid) continue;
      const tgt = battle.units.find((x) => x.uid === u.intent!.targetUid);
      if (!tgt || !tgt.alive) continue;
      const tone: 'danger' | 'ally' = tgt.side === 'player' ? 'danger' : 'ally';
      // Ярлык «в эту карту метят» — рамка вокруг жертвы.
      if (threatened.get(tgt.uid) !== 'danger') threatened.set(tgt.uid, tone);
      const def = defs.get(u.defId);
      const list = incoming.get(tgt.uid) ?? [];
      list.push({
        key: u.uid,
        mark: unitEmblem(def?.id, def?.faction),
        soon: u.uid === soonestEnemy,
        tone,
        name: nameOf(u),
      });
      incoming.set(tgt.uid, list);
    }
  }

  const slot = (side: 'player' | 'enemy', row: 'front' | 'back', index: number) =>
    battle.units.find((u) => u.side === side && u.row === row && u.index === index);

  /**
   * Ряд без единого бойца не показываем вовсе: бой на двух врагов держал три
   * пустых пунктирных слота заднего ряда — 145px, то есть верхнюю треть доски,
   * — и карточки из-за этого жались до 105px.
   *
   * Считаем по ИСХОДНОМУ составу, а не по живым: иначе доска перестраивалась бы
   * посреди боя, в момент смерти последнего в ряду, — ровно тогда, когда игрок
   * смотрит на анимацию рассыпания. Пустые слоты внутри непустого ряда
   * остаются: в них видно, что место свободно, и туда бьёт передний ряд.
   */
  const rowUsed = (side: 'player' | 'enemy', row: 'front' | 'back') =>
    battle.units.some((u) => u.side === side && u.row === row);

  const renderRow = (side: 'player' | 'enemy', row: 'front' | 'back') => (
    <div className={`row row-${row}`} key={`${side}-${row}`}>
      {SLOTS.map((i) => {
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
            threats={incoming.get(u.uid)}
            covered={covered}
            coveredLabel={t(lang, 'coveredShort')}
            hideIntent={over}
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
    //
    // Базовое — это удар, а не первое по списку. Единственная инструкция игры
    // звучит «тапни свою карту, потом врага», и у стартового «Невостребованного
    // залога» первой в наборе стоит «Подержу» — щит на союзника. Игрок делал
    // ровно то, что написано, тапал врага и получал отказ на первое же своё
    // самостоятельное действие. Берём первую готовую способность, которая
    // вообще умеет целиться во врага; если такой нет (чистый лекарь) — первую
    // любую, там инструкция и так не про него.
    if (u.uid === actor.uid && abilities.length > 0) {
      const offensive = abilities.find((a) => a.target.startsWith('enemy'));
      setSelectedAbility(offensive ?? abilities[0]);
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
      {/* Нарисованный фон главнее процедурного: положил картинку в
          assets/backgrounds/ под именем боя или ключом места — она встаёт сюда. */}
      <img
        className="scene-bg"
        src={drawnBg ?? svgDataUri(backgroundSvg(battle.battleId, placeTone(battle.battleId)))}
        alt=""
        draggable={false}
      />
      {/* Тот же знак места, что и в диалоге, — бой идёт не в вакууме, а там же,
          где только что был разговор. На поле он ещё бледнее: карты важнее. */}
      {/* Знак места снимается, когда фон нарисован: рисунок уже называет
          место, а глиф поверх него — вторая вывеска на той же двери. */}
      {!drawnBg && (
        <span className="scene-mark battle-mark" style={placeEmblem(battle.battleId)} aria-hidden="true" />
      )}

      <div className="battle-top">
        <div className="battle-top-line">
          <span>
            {t(lang, 'round')} {battle.round}
          </span>
          <span className="battle-title">{loc(content.battles.find((b) => b.id === battle.battleId)?.name, lang)}</span>
        </div>
        {!over && <TurnQueue battle={battle} defs={defs} lang={lang} />}
      </div>

      <div className={`field ${myTurn && selectedAbility ? 'targeting' : ''}`}>
        {/* Подсказка боя переехала из отдельной полки над полем внутрь поля.
            Поле прижимает строй к нижнему краю, поэтому подсказка садится в
            свободную высоту над задним рядом врага: доску она больше не
            толкает (см. `.tutorial-flow` в screens.css). Тапы не перехватывает
            — `pointer-events: none`. */}
        {!over && <TutorialHint step="battle" lang={lang} anchor="flow" />}
        <div className="side enemy-side">
          {rowUsed('enemy', 'back') && renderRow('enemy', 'back')}
          {rowUsed('enemy', 'front') && renderRow('enemy', 'front')}
        </div>
        <div className="divider" />
        <div className="side player-side">
          {rowUsed('player', 'front') && renderRow('player', 'front')}
          {rowUsed('player', 'back') && renderRow('player', 'back')}
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
            {/* Ромбы стоят вне ветки myTurn: погашенное умение должно быть
                видно и в чужой ход — иначе игрок узнаёт о нём только в свой,
                и заряд, потраченный раунд назад, выглядит как пропажа. */}
            {powers.map((slot) => {
              const a = slot.power.ability;
              const ready = slot.state.kind === 'ready';
              const cd = slot.state.kind === 'cooldown' ? slot.state.turns : 0;
              return (
                <button
                  key={slot.power.id}
                  className={`memory-power ${selectedAbility?.id === a.id ? 'active' : ''} ${ready ? '' : 'spent'}`}
                  aria-label={loc(a.name, lang)}
                  disabled={!ready}
                  onClick={() => {
                    if (!ready) {
                      // Молчащая кнопка учит только тому, что игра сломана.
                      setReason(
                        cd > 0
                          ? t(lang, 'powerSpent')
                          : slot.state.kind === 'unavailable' && slot.state.reason === 'noTargets'
                            ? t(lang, 'powerNoTargets')
                            : t(lang, 'powerNotYourTurn'),
                      );
                      return;
                    }
                    vibrate('tap');
                    setPeek(undefined);
                    setReason(undefined);
                    setSelectedAbility(a);
                  }}
                >
                  <span className="power-mark">
                    <Icon name={a.icon} size={20} />
                  </span>
                  <span className="power-name">{loc(a.name, lang)}</span>
                  {cd > 0 && <span className="power-spent">{t(lang, 'powerSpentShort')}</span>}
                </button>
              );
            })}
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
                  <span className="ability-name">{loc(a.name, lang)}</span>
                  {/* Что она делает — прямо на кнопке, а не по долгому нажатию:
                      жест, о котором надо догадаться, объяснением не считается. */}
                  <span className="ability-gist">{abilityGist(a, lang)}</span>
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
