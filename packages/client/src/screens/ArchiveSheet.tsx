import { useMemo, useRef, useState } from 'react';
import { lifeProgress, type GameState, type Lang, type PartyUnit } from '@nameless/engine';
import { Icon } from '../components/Icon';
import { RecruitTag } from '../components/RecruitTag';
import { loc, t } from '../i18n';
import { cardImage, svgDataUri, unitCardSvg } from '../lib/art';
import { placeEmblemByKey, unitEmblem } from '../lib/emblems';
import { content } from '../store/content';
import { useGame } from '../store/game';
import { vibrate } from '../lib/haptics';

/** Столько держать карточку отряда, чтобы открылась бирка. Как в бою. */
const HOLD_MS = 380;

/**
 * «Опись» — отряд и мозаика памяти. Осей здесь нет и не будет:
 * числа личности игроку не показываются никогда, это канон.
 * Игрок видит только то, что уже выкупил.
 */
export function ArchiveSheet({
  state,
  lang,
  onClose,
}: {
  state: GameState;
  lang: Lang;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'party' | 'memories'>('party');
  const [picked, setPicked] = useState<string>();
  /*
   * «Бирка потом доступна по тапу вне боя» (КАНОН_КРАТКО §9.2). Тап в описи уже
   * занят перестановкой строя, поэтому бирка открывается удержанием — тем же
   * жестом, которым в бою открывается разбор способности («удержи — разбор»).
   */
  const [shown, setShown] = useState<PartyUnit>();
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  /** uid карточки, которую держали достаточно долго; false — обычный тап. */
  const heldOpen = useRef<string | false>(false);
  const { swapSlots } = useGame();
  const defs = useMemo(() => new Map(content.units.map((u) => [u.id, u])), []);

  /*
   * Удержание ЗАСЧИТЫВАЕТСЯ по таймеру (палец чувствует отклик сразу), а бирка
   * открывается только когда палец отпустили. Разница не косметическая:
   * `click` браузер шлёт общему предку того, где нажали, и того, где отпустили.
   * Открой бирку под пальцем — отпускание пришлось бы уже на её подложку, общим
   * предком оказалась бы подложка описи, и один жест закрывал бы разом опись и
   * бирку, которую игрок только что вызвал.
   */
  const startHold = (u: PartyUnit) => {
    clearTimeout(holdTimer.current);
    heldOpen.current = false;
    holdTimer.current = setTimeout(() => {
      heldOpen.current = u.uid;
      vibrate('tap');
    }, HOLD_MS);
  };
  const endHold = () => clearTimeout(holdTimer.current);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {/* Свиток описи: лист называет сам себя. Лежит под вкладками и телом,
            видно его только там, где пусто, — то есть в первую очередь на
            пустом отряде, где раньше была одна серая строка. */}
        <span className="sheet-mark" style={placeEmblemByKey('ledger')} aria-hidden="true" />
        <div className="sheet-tabs">
          <button className={tab === 'party' ? 'on' : ''} onClick={() => setTab('party')}>
            {t(lang, 'party')}
          </button>
          <button className={tab === 'memories' ? 'on' : ''} onClick={() => setTab('memories')}>
            {t(lang, 'memories')}
          </button>
        </div>

        <div className="sheet-body scroll">
          {tab === 'party' &&
            (state.party.length === 0 ? (
              <div className="sheet-empty">{t(lang, 'emptyParty')}</div>
            ) : (
              <>
              <div className="swap-hint">{t(lang, 'swapHint')}</div>
              <div className="party-grid">
                {[...state.party]
                  .sort((a, b) =>
                    a.slot.row === b.slot.row
                      ? a.slot.index - b.slot.index
                      : a.slot.row === 'front'
                        ? -1
                        : 1,
                  )
                  .map((u) => {
                  const def = defs.get(u.defId);
                  const custom = def ? cardImage(def.id) : undefined;
                  const art = def ? (custom ?? svgDataUri(unitCardSvg(def.id, def.tier, def.faction))) : '';
                  const mark = custom ? undefined : unitEmblem(def?.id, def?.faction);
                  return (
                    <button
                      key={u.uid}
                      className={`party-item tier-${def?.tier ?? 1} ${picked === u.uid ? 'picked' : ''}`}
                      onPointerDown={() => startHold(u)}
                      onPointerUp={endHold}
                      onPointerLeave={endHold}
                      onPointerCancel={endHold}
                      onClick={() => {
                        endHold();
                        // Держали долго — это запрос бирки, а не перестановка.
                        if (heldOpen.current === u.uid) {
                          heldOpen.current = false;
                          setShown(u);
                          return;
                        }
                        heldOpen.current = false;
                        vibrate('tap');
                        if (!picked) {
                          setPicked(u.uid);
                        } else if (picked === u.uid) {
                          setPicked(undefined);
                        } else {
                          swapSlots(picked, u.uid);
                          setPicked(undefined);
                        }
                      }}
                    >
                      <div className="party-thumb">
                        <img src={art} alt="" draggable={false} />
                        {mark && <span className="card-mark" style={mark} aria-hidden="true" />}
                      </div>
                      <div className="party-name">{def ? loc(def.name, lang) : u.defId}</div>
                      <div className="party-blurb">{def ? loc(def.blurb, lang) : ''}</div>
                      <div className="party-meta">
                        {u.slot.row === 'front' ? t(lang, 'rowFront') : t(lang, 'rowBack')} ·{' '}
                        {t(lang, 'levelUp')} {u.level}
                      </div>
                    </button>
                  );
                })}
              </div>
              </>
            ))}

          {tab === 'memories' &&
            (state.lockedMemories.length === 0 ? (
              <div className="sheet-empty">{t(lang, 'noMemories')}</div>
            ) : (
              content.lives
                .map((life) => ({ life, prog: lifeProgress(state, life) }))
                .filter((x) => x.prog.locked > 0)
                .map(({ life, prog }) => (
                  <div key={life.id} className="life-block">
                    <div className="life-block-head">
                      <Icon name={life.icon} size={16} color="var(--accent)" />
                      <span>{loc(life.name, lang)}</span>
                      <span className="life-prog">
                        {prog.locked}/{prog.total}
                      </span>
                    </div>
                    <div className="life-block-flavor">{loc(life.flavor, lang)}</div>
                    {content.memories
                      .filter((m) => m.life === life.id && state.lockedMemories.includes(m.id))
                      .map((m) => (
                        <div key={m.id} className="mem-row">
                          <Icon name={m.icon} size={14} color="var(--memory)" />
                          <div>
                            <div className="mem-name">{loc(m.name, lang)}</div>
                            <div className="mem-text">{loc(m.revelation, lang)}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                ))
            ))}
        </div>

        <button className="ghost-button sheet-close" onClick={onClose}>
          {t(lang, 'close')}
        </button>
      </div>

      {shown && <RecruitTag unit={shown} lang={lang} look onClose={() => setShown(undefined)} />}
    </div>
  );
}
