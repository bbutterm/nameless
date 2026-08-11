import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  commonActions,
  currentActor,
  isPlayerTurn,
  legalTargets,
  playerAbilityBar,
  unitAbilities,
  COVER_ABILITY_ID,
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
import { playSfx, setAir, setMusic } from '../lib/sound';
import { backgroundImage, backgroundSvg, svgDataUri } from '../lib/art';
import { placeEmblem, placeKey, placeTone, unitEmblem } from '../lib/emblems';
import { TutorialHint } from '../components/Tutorial';
import {
  abilityChips,
  abilityGist,
  blockReason,
  coolingReason,
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
/** Столько мигает кнопка, выбранная тапом по карте, — ровно длина .pick-flash. */
const PICK_MS = 460;
/** Ряд отряда — три слота; столько же у врага. */
const SLOTS = Array.from({ length: PARTY_SLOTS_PER_ROW }, (_, i) => i);

export function BattleScreen() {
  const { battle, lang, battleAct, battleAuto, collectSpoils, spoils, finishBattle } = useGame();
  const [selectedAbility, setSelectedAbility] = useState<Ability>();
  const [peek, setPeek] = useState<Ability>();
  const [reason, setReason] = useState<string>();
  const [anims, setAnims] = useState<Anim>({});
  const [floats, setFloats] = useState<FloatingNumber[]>([]);
  /* Куда указывает стебель панели: середина карточки того, чей сейчас ход,
     в координатах панели. undefined — карточки на доске нет (бой кончился). */
  const [stemX, setStemX] = useState<number>();
  /* Кнопка, которую только что выбрал тап по карте: она мигает, чтобы игрок
     увидел, ЧТО именно выбрал его жест, а не гадал по подсказке. */
  const [picked, setPicked] = useState<string>();
  const panelRef = useRef<HTMLDivElement>(null);
  const pickTimer = useRef<ReturnType<typeof setTimeout>>();
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
    clearTimeout(pickTimer.current);
    pickTimer.current = undefined;
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
    setPicked(undefined);
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
    if (!battleId) return;
    setAir(placeKey(battleId));
    setMusic('battle');
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

  /*
   * Стебель панели — та самая связь «кнопка ↔ юнит», которой не было.
   *
   * Раньше панель висела внизу сама по себе, и чьи это кнопки, держалось на
   * одной строке мелкого текста «Твой ход: <имя>» (REVIEW_GAMEPLAY §1, шаг 4).
   * Слова тут не работают: панель полностью меняется каждый ход, и глаз ищет
   * причину смены не в тексте, а в том, что на доске.
   *
   * Позицию берём измерением карточки, а не арифметикой по номеру слота:
   * ширина карты выводится из ВЫСОТЫ ряда и aspect-ratio, ряды бывают одни и
   * двое, а поле — с полями и зазорами. Любая формула здесь врала бы ровно на
   * тех экранах, где связь важнее всего. `data-uid` на карточке уже был.
   *
   * В ЧУЖОЙ ход стебля нет, и это не экономия. Столбцы своих и вражеских рядов
   * стоят один над другим: клин под карточкой врага из переднего ряда упирался
   * снизу в свою карточку того же столбца — проверено живьём на 360×640, где
   * стебель «Резчика карманов» вставал ровно под «Меловщика». Указатель,
   * который на половине экранов показывает не на того, хуже отсутствующего;
   * чей ход, в это время говорят очередь наверху и цвет бирки.
   */
  const stemActor = battle && battle.outcome === 'ongoing' ? currentActor(battle) : undefined;
  const stemUid = stemActor && stemActor.side === 'player' ? stemActor.uid : undefined;
  const eventCount = battle?.events.length ?? 0;
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !stemUid) {
      setStemX(undefined);
      return;
    }
    const measure = () => {
      const card = document.querySelector<HTMLElement>(`.card[data-uid="${CSS.escape(stemUid)}"]`);
      if (!card) {
        setStemX(undefined);
        return;
      }
      const c = card.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const x = Math.round(c.left + c.width / 2 - p.left);
      // Сравнение с прежним значением обязательно: эффект перезапускается на
      // каждом событии боя, а лишний setState на том же числе — лишний кадр
      // ровно в момент, когда игрок ждёт ответа на тап (замер Б1-г).
      setStemX((prev) => (prev === x ? prev : x));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [stemUid, battleId, eventCount]);

  if (!battle) return null;
  // Псевдоним под сужение типа: onTapUnit — объявление функции, и внутри него
  // TypeScript про проверку выше уже не помнит.
  const live = battle;
  const drawnBg = backgroundImage(battle.battleId, placeKey(battle.battleId));

  const actor = currentActor(battle);
  const myTurn = isPlayerTurn(battle);
  /*
   * В панель идут ВСЕ способности актора, а не только готовые.
   *
   * Было: `readyAbilities` отфильтровывал неготовые, и применённое «Выбить
   * долг» не серело, а пропадало с панели и возвращалось через два раунда.
   * Игрок не знал ни того, что кнопка вернётся, ни того, когда, — с его точки
   * зрения состав кнопок был случаен (REVIEW_GAMEPLAY §1, шаг 4). Перезарядка
   * в движке уже лежит открыто (`u.cooldowns`), её просто никто не показывал.
   */
  const bar =
    actor && myTurn
      ? unitAbilities(combat, actor).map((a) => ({ a, cd: actor.cooldowns[a.id] ?? 0 }))
      : [];
  const abilities = bar.filter((x) => x.cd <= 0).map((x) => x.a);
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
  /*
   * «Заслонить» — третья вещь в панели, и форма у неё третья.
   *
   * Это не способность карты: в набор юнита заслон не вписан нарочно — слот
   * стоит денег, а приписка общего действия в наборы сдвинула бы норму целого
   * тира (DIRECTION_COMBAT §B.C1, §E.8). И не умение памяти: у памяти свой
   * ромб и свой цвет. Это правило боя, доступное любому живому юниту ПЕРЕДНЕГО
   * ряда, — движок отдаёт его отдельным списком `commonActions`.
   *
   * Кнопка стоит на месте ВСЕГДА, пока ход мой, даже когда действие сейчас
   * недоступно. Это то же правило, которым Б2 чинила перезарядку: кнопка, то
   * появляющаяся, то пропадающая, читается как случайность, а не как правило,
   * — а заслон обязан читаться именно как правило, иначе игрок не узнает о нём
   * никогда (он доступен только части ходов). Недоступная гаснет и на нажатие
   * отвечает словами, почему: заслоняют из переднего ряда, за себя не ручаются.
   *
   * Место — сразу за ромбами памяти и ПЕРЕД способностями юнита: слева стоит
   * то, что не принадлежит карте и потому не меняется с ходом, справа — набор
   * актора, который меняется каждый ход. Так общее действие не уезжает за край
   * панели вместе с чужими кнопками.
   */
  const coverAbility = combat.abilities.get(COVER_ABILITY_ID);
  const coverFromRow = !!actor && myTurn && commonActions(combat, actor).length > 0;
  const coverTargets =
    actor && coverAbility && coverFromRow ? legalTargets(battle, actor.uid, coverAbility) : [];
  const coverBarred: 'backRow' | 'noOne' | undefined = !coverFromRow
    ? 'backRow'
    : coverTargets.length === 0
      ? 'noOne'
      : undefined;
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
            coverStatusLabel={t(lang, 'effCover')}
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
      setPicked(undefined);
      return;
    }
    // Тап по своей карте = выбрать её базовое действие.
    //
    // Базовое — это удар, а не первое по списку. Единственная инструкция игры
    // звучит «тапни свою карту, потом врага», и у стартового «Забытыша»
    // первой в наборе стоит «Подержу» — щит на союзника. Игрок делал
    // ровно то, что написано, тапал врага и получал отказ на первое же своё
    // самостоятельное действие. Берём первую готовую способность, которая
    // вообще умеет целиться во врага; если такой нет (чистый лекарь) — первую
    // любую, там инструкция и так не про него.
    //
    // И тап этот больше не слепой: выбранная кнопка мигает. Иначе жест
    // «тапни свою карту» отвечал только строкой мелкого текста, и связь
    // «карта → вот эта кнопка» игроку приходилось выводить самому.
    if (u.uid === actor.uid && abilities.length > 0) {
      const offensive = abilities.find((a) => a.target.startsWith('enemy'));
      const pick = offensive ?? abilities[0];
      if (!pick) return;
      vibrate('tap');
      setSelectedAbility(pick);
      setPeek(undefined);
      setReason(undefined);
      setPicked(pick.id);
      clearTimeout(pickTimer.current);
      pickTimer.current = setTimeout(() => setPicked(undefined), PICK_MS);
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

  /*
   * Бирка хозяина панели: знак дома и имя того, чей сейчас ход.
   *
   * Имя актора и раньше стояло в служебной строке — но только пока в ней не
   * было ничего важнее: выбрал способность, тапнул мимо — и имя пропадало,
   * ровно в тот момент, когда игрок разбирается, чьи это кнопки. Теперь бирка
   * стоит слева всегда и меняется только вместе с ходом, а переменная часть
   * подсказки живёт правее. Цвет говорит сторону: свой ход — цветом выбора,
   * чужой — цветом опасности, тем же, что рамка угрозы на карточках.
   */
  const ownerMark = actor ? unitEmblem(defs.get(actor.defId)?.id, defs.get(actor.defId)?.faction) : undefined;
  const owner = actor && !over && (
    /* Знака нет у тех юнитов, у кого нет ни личного, ни домового (`unitEmblem`
       возвращает undefined — «лучше пусто, чем чужой предмет»). Тогда левое
       поле бирки выравнивается с правым, иначе имя висит не по центру пилюли. */
    <span className={`hint-owner ${myTurn ? 'mine' : 'theirs'} ${ownerMark ? '' : 'no-mark'}`}>
      {ownerMark && <span className="owner-mark" style={ownerMark} aria-hidden="true" />}
      <b>{nameOf(actor)}</b>
    </span>
  );

  // Переменная часть служебной строки: что делает выбранная способность,
  // что готовит враг, почему по этой цели ударить нельзя.
  const hint = (() => {
    if (reason) return <span className="hint-block">{reason}</span>;
    if (!myTurn && actor) {
      const ab = actor.intent ? combat.abilities.get(actor.intent.ability) : undefined;
      const tgt = battle.units.find((u) => u.uid === actor.intent?.targetUid);
      if (!ab) return <span className="hint-turn">{t(lang, 'turnOf')}</span>;
      return (
        <span className="hint-turn">
          <Icon name={ab.icon} size={12} />
          <span className="hint-ability">{loc(ab.name, lang)}</span>
          {tgt && (
            <span className="hint-target">
              {' → '}
              {nameOf(tgt)}
            </span>
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
        {t(lang, 'yourTurn')}
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
        <div className={`battle-panel ${myTurn ? 'mine' : 'theirs'}`} ref={panelRef}>
          {/* Стебель к карточке хозяина панели: клин ровно под тем, чей ход.
              Абсолютный слой поверх верхней кромки — высоту панели не меняет,
              доску не толкает. */}
          {stemX !== undefined && (
            <span className="panel-stem" style={{ left: `${stemX}px` }} aria-hidden="true" />
          )}
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

          <div className="battle-hint">
            {owner}
            {hint}
          </div>

          <div className="ability-bar">
            {/*
             * Панель в два ряда, и разделены они не по тесноте, а по смыслу.
             *
             * Верхний ряд — то, что принадлежит ГЕРОЮ и не меняется с ходом:
             * умения памяти и общие действия боя. Нижний — набор той карточки,
             * чей сейчас ход; он меняется каждый ход. Кнопка, которая не
             * переезжает между ходами, находится пальцем без чтения, а
             * читать в бою некогда.
             *
             * Одним рядом это перестало помещаться ровно тогда, когда у
             * заслона появилась кнопка (Б5): при двух ромбах и двух
             * способностях полоса выходила 423 против 390 видимых, и
             * последняя способность обрезалась правым краем. Прокрутка вбок
             * не спасала: игрок про неё не знает, а решение, которого не
             * видно, для него не существует — той самой жалобе «бой скучный»
             * это прямо противоречит.
             */}
            {(powers.length > 0 || (myTurn && coverAbility)) && (
              <div className="bar-row bar-row-own">
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
            {myTurn && coverAbility && (
              <button
                className={[
                  'common-action',
                  selectedAbility?.id === coverAbility.id ? 'active' : '',
                  coverBarred ? 'barred' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                /* Не `disabled`: недоступную кнопку всё равно надо уметь
                   разобрать долгим тапом и спросить, почему она серая. Молчащая
                   кнопка учит только тому, что игра сломана. */
                aria-label={
                  coverBarred
                    ? `${loc(coverAbility.name, lang)} — ${t(lang, coverBarred === 'backRow' ? 'coverBackRow' : 'coverNoOne')}`
                    : undefined
                }
                onPointerDown={() => startHold(coverAbility)}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onClick={() => {
                  endHold();
                  if (heldOpen.current) {
                    heldOpen.current = false;
                    return;
                  }
                  vibrate('tap');
                  setPeek(undefined);
                  if (coverBarred) {
                    setReason(t(lang, coverBarred === 'backRow' ? 'coverBackRow' : 'coverNoOne'));
                    return;
                  }
                  setReason(undefined);
                  setSelectedAbility(coverAbility);
                }}
              >
                <Icon name={coverAbility.icon} size={22} />
                <span className="ability-name">{loc(coverAbility.name, lang)}</span>
                <span className="ability-gist">{abilityGist(coverAbility, lang)}</span>
              </button>
            )}
              </div>
            )}
            <div className="bar-row bar-row-act">
            {myTurn ? (
              bar.map(({ a, cd }) => (
                <button
                  key={a.id}
                  className={[
                    'ability',
                    selectedAbility?.id === a.id ? 'active' : '',
                    cd > 0 ? 'cooling' : '',
                    picked === a.id ? 'pick-flash' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  /* Неготовая кнопка НЕ отключена — ни `disabled`, ни
                     `aria-disabled`: её всё ещё надо уметь разобрать долгим
                     тапом и спросить, сколько ждать. Отключённая кнопка
                     молчит, а молчание — то самое, из-за чего состав панели
                     выглядел случайным. (`aria-disabled` тут ещё и врал бы
                     вспомогательным технологиям и блокировал бы клик в
                     Playwright — то есть слепил бы наши же инструменты.)
                     Срок уходит в подпись целиком: «1» рядом с песочными
                     часами голосом не читается. */
                  aria-label={cd > 0 ? coolingReason(loc(a.name, lang), cd, lang) : undefined}
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
                    if (cd > 0) {
                      vibrate('tap');
                      setPeek(undefined);
                      setReason(coolingReason(loc(a.name, lang), cd, lang));
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
                      жест, о котором надо догадаться, объяснением не считается.
                      У серой кнопки на этом месте стоит срок: не «что делает»,
                      а «когда вернётся» — сейчас игроку нужно именно это. */}
                  {cd > 0 ? (
                    <span className="ability-cd">
                      <Icon name="hourglass" size={10} />
                      {cd}
                    </span>
                  ) : (
                    <span className="ability-gist">{abilityGist(a, lang)}</span>
                  )}
                </button>
              ))
            ) : (
              <div className="waiting">
                <span className="waiting-dot" />
              </div>
            )}
            </div>
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
