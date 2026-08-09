import type { BattleUnitState, Lang, UnitDef } from '@nameless/engine';
import { loc } from '../i18n';
import { cardImage, svgDataUri, unitCardSvg } from '../lib/art';
import type { Preview } from '../lib/combatRead';
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
  threatened,
  covered,
  coveredLabel,
  hideIntent,
  preview,
  anim,
  floats,
  intentName,
  onTap,
}: {
  unit: BattleUnitState;
  def: UnitDef | undefined;
  lang: Lang;
  selected?: boolean;
  targetable?: boolean;
  /** В эту карту метит враг: конец пунктира намерения. */
  threatened?: 'danger' | 'ally';
  /** Закрыта живым передним рядом — цель недоступна, и это надо объяснить. */
  covered?: boolean;
  coveredLabel?: string;
  /** Бой кончился — намерения больше ни к чему не относятся. */
  hideIntent?: boolean;
  /** Сколько примерно снимет выбранная способность именно с этой цели. */
  preview?: Preview;
  /** Человеческое имя способности, которую враг готовит на этот раунд. */
  intentName?: string;
  anim?: 'lunge-up' | 'lunge-down' | 'hit' | 'die' | undefined;
  floats?: FloatingNumber[];
  onTap?: () => void;
}) {
  const hpPct = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
  const art = def ? (cardImage(def.id) ?? svgDataUri(unitCardSvg(def.id, def.tier, def.faction))) : undefined;
  const shield = unit.statuses.filter((s) => s.kind === 'shield').reduce((a, s) => a + s.amount, 0);
  const stunned = unit.statuses.some((s) => s.kind === 'stun');
  // Намерение показываем только тому, кто в этом раунде ещё не ходил: движок
  // проставляет intent всем врагам на весь раунд и после хода его не гасит,
  // так что иконка (а теперь и стрелка к цели) врала про уже отстрелявшихся.
  const showIntent = !!unit.intent && unit.alive && !unit.acted && !hideIntent;

  return (
    <button
      className={[
        'card',
        `tier-${def?.tier ?? 1}`,
        unit.side,
        unit.alive ? '' : 'dead',
        selected ? 'selected' : '',
        targetable ? 'targetable' : '',
        threatened ? `threatened-${threatened}` : '',
        covered ? 'covered' : '',
        anim ? `anim-${anim}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onTap}
      disabled={!unit.alive}
      data-uid={unit.uid}
      aria-label={def ? loc(def.name, lang) : unit.defId}
    >
      {/* Арт лежит в обойме с overflow: hidden — сама карточка обязана
          оставаться overflow: visible ради цифр урона и значка намерения.
          Подробности подрезки — в .card-art в screens.css. */}
      {art && (
        <div className="card-art-clip">
          <img className="card-art" src={art} alt="" draggable={false} />
        </div>
      )}
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

      {showIntent && unit.intent && (
        // В title лежало сырое id способности («pick_the_pocket»): служебная
        // строка, которая утекала в интерфейс. Показываем человеческое имя.
        <div className="intent" title={intentName ?? unit.intent.ability}>
          <Icon name={unit.intent.icon} size={14} />
        </div>
      )}
      {stunned && (
        <div className="status-badge">
          <Icon name="stun" size={13} color="var(--accent)" />
        </div>
      )}

      {/* Предпросмотр урона поверх арта: та же позиция, где через мгновение
          всплывёт настоящая цифра, — «во что превратится тап» читается сразу. */}
      {preview && (
        <span className={`preview preview-${preview.tone} ${preview.lethal ? 'lethal' : ''}`}>
          {preview.lethal && <Icon name="skull" size={11} />}
          {preview.text}
        </span>
      )}

      {/* Закрытая цель раньше просто гасла — без слова «почему». */}
      {covered && (
        <span className="cover-mark">
          <Icon name="shield" size={11} />
          {coveredLabel}
        </span>
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
