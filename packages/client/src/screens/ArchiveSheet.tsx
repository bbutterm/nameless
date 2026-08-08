import { useMemo, useState } from 'react';
import { lifeProgress, type GameState, type Lang } from '@nameless/engine';
import { Icon } from '../components/Icon';
import { loc, t } from '../i18n';
import { cardImage, svgDataUri, unitCardSvg } from '../lib/art';
import { content } from '../store/content';

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
  const defs = useMemo(() => new Map(content.units.map((u) => [u.id, u])), []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
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
              <div className="party-grid">
                {state.party.map((u) => {
                  const def = defs.get(u.defId);
                  const art = def ? (cardImage(def.id) ?? svgDataUri(unitCardSvg(def.id, def.tier, def.faction))) : '';
                  return (
                    <div key={u.uid} className={`party-item tier-${def?.tier ?? 1}`}>
                      <img src={art} alt="" draggable={false} />
                      <div className="party-name">{def ? loc(def.name, lang) : u.defId}</div>
                      <div className="party-blurb">{def ? loc(def.blurb, lang) : ''}</div>
                      <div className="party-meta">
                        {t(lang, 'levelUp')} {u.level} · {u.hp}/{def?.stats.hp ?? u.hp}
                      </div>
                    </div>
                  );
                })}
              </div>
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
    </div>
  );
}
