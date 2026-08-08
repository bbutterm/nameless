import type { BattleUnitState, Lang, UnitDef } from '@nameless/engine';
import { loc } from '../i18n';
import { cardImage, svgDataUri, unitCardSvg } from '../lib/art';
import { Icon } from './Icon';

export interface FloatingNumber {
  id: number;
  uid: string;
  amount: number;
  kind: 'damage' | 'heal' | 'crit';
}

/**
 * Карточка юнита. Анимации — движением самой карточки: рывок к цели,
 * тряска при уроне, рассыпание при смерти. Никаких скелетов и спрайтшитов.
 */
export function UnitCard({
  unit,
  def,
  lang,
  selected,
  targetable,
  anim,
  floats,
  onTap,
}: {
  unit: BattleUnitState;
  def: UnitDef | undefined;
  lang: Lang;
  selected?: boolean;
  targetable?: boolean;
  anim?: 'lunge-up' | 'lunge-down' | 'hit' | 'die' | undefined;
  floats?: FloatingNumber[];
  onTap?: () => void;
}) {
  const hpPct = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
  const art = def ? (cardImage(def.id) ?? svgDataUri(unitCardSvg(def.id, def.tier, def.faction))) : undefined;
  const shield = unit.statuses.filter((s) => s.kind === 'shield').reduce((a, s) => a + s.amount, 0);
  const stunned = unit.statuses.some((s) => s.kind === 'stun');

  return (
    <button
      className={[
        'card',
        `tier-${def?.tier ?? 1}`,
        unit.side,
        unit.alive ? '' : 'dead',
        selected ? 'selected' : '',
        targetable ? 'targetable' : '',
        anim ? `anim-${anim}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onTap}
      disabled={!unit.alive}
      aria-label={def ? loc(def.name, lang) : unit.defId}
    >
      {art && <img className="card-art" src={art} alt="" draggable={false} />}
      <div className="card-name">{def ? loc(def.name, lang) : unit.defId}</div>

      <div className="hp-bar">
        <div
          className="hp-fill"
          style={{
            width: `${hpPct * 100}%`,
            background: unit.side === 'player' ? 'var(--hp-ally)' : 'var(--hp-enemy)',
          }}
        />
        {shield > 0 && <div className="shield-pip">{shield}</div>}
      </div>
      <div className="card-hp">
        {unit.hp}/{unit.maxHp}
      </div>

      {unit.intent && (
        <div className="intent" title={unit.intent.ability}>
          <Icon name={unit.intent.icon} size={14} />
        </div>
      )}
      {stunned && (
        <div className="status-badge">
          <Icon name="stun" size={13} color="var(--accent)" />
        </div>
      )}

      {floats?.map((f) => (
        <span key={f.id} className={`float float-${f.kind}`}>
          {f.kind === 'heal' ? '+' : '−'}
          {f.amount}
        </span>
      ))}
    </button>
  );
}
