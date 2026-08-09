import type { BattleUnitState, Lang, StatusEffect, UnitDef } from '@nameless/engine';
import { loc } from '../i18n';
import { cardImage, svgDataUri, unitCardSvg } from '../lib/art';
import { unitEmblem } from '../lib/emblems';
import type { Preview } from '../lib/combatRead';
import { Icon } from './Icon';

export interface FloatingNumber {
  id: number;
  uid: string;
  amount: number;
  kind: 'damage' | 'heal' | 'crit';
}

/**
 * Строка состояний под именем карты.
 *
 * До этого на карточке жили ровно два состояния: число щита в углу полосы HP и
 * значок оглушения. Яд, усиления и ослабления не показывались НИКАК — урон
 * «сам собой» капал в начале хода, а собственный бафф атаки нельзя было
 * увидеть, только вспомнить. Показываем все пять видов одним рядом.
 *
 * Иконки берём из уже принятого набора (`Icon`, game-icons/Lorc), а не из
 * пака Kenney: см. docs/ART_PASS.md §3 — «значков статов» в том паке нет,
 * там галочки, крестики и курсоры, и они бежевые с заливкой.
 *
 * Цвет — смысл, а не украшение: щит — свой цвет щита, вред (яд, ослабление,
 * оглушение) — `--danger`, польза (усиление) — `--accent`.
 */
interface StatusChip {
  icon: string;
  tone: string;
  label: string;
  key: string;
}

const STAT_ICON: Record<string, string> = {
  atk: 'sword',
  def: 'shield',
  initiative: 'wing',
};

function statusChips(statuses: StatusEffect[]): StatusChip[] {
  const chips: StatusChip[] = [];
  let shield = 0;
  let dot = 0;
  let stunTurns = 0;
  for (const s of statuses) {
    if (s.kind === 'shield') shield += s.amount;
    else if (s.kind === 'dot') dot += s.amount;
    else if (s.kind === 'stun') stunTurns = Math.max(stunTurns, s.turns);
    else if (s.kind === 'buff' || s.kind === 'debuff') {
      const sign = s.kind === 'buff' ? '+' : '−';
      chips.push({
        key: `${s.kind}-${s.stat}-${chips.length}`,
        icon: STAT_ICON[s.stat ?? 'atk'] ?? 'sword',
        tone: s.kind === 'buff' ? 'var(--accent)' : 'var(--danger)',
        label: `${sign}${Math.abs(s.amount)}`,
      });
    }
  }
  // Порядок постоянный: щит → яд → оглушение → усиления. Прыгающий порядок
  // на карточке 105px читается как мигание, а не как информация.
  const head: StatusChip[] = [];
  if (shield > 0)
    head.push({ key: 'shield', icon: 'shield', tone: 'var(--shield)', label: String(shield) });
  if (dot > 0) head.push({ key: 'dot', icon: 'poison', tone: 'var(--danger)', label: String(dot) });
  if (stunTurns > 0)
    head.push({ key: 'stun', icon: 'stun', tone: 'var(--danger)', label: String(stunTurns) });
  return [...head, ...chips];
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
  const custom = def ? cardImage(def.id) : undefined;
  const art = def ? (custom ?? svgDataUri(unitCardSvg(def.id, def.tier, def.faction))) : undefined;
  // Знак дома кладём только поверх процедурной заглушки. Свой арт пользователя
  // (assets/cards/<id>.webp) ничем не забиваем — это его слот, а не наш холст.
  const mark = custom ? undefined : unitEmblem(def?.id, def?.faction);
  const chips = statusChips(unit.statuses);
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
          {mark && <span className="card-mark" style={mark} aria-hidden="true" />}
        </div>
      )}
      <div className="card-name">{def ? loc(def.name, lang) : unit.defId}</div>

      {chips.length > 0 && (
        <div className="status-row">
          {chips.map((c) => (
            <span key={c.key} className="status-chip" style={{ color: c.tone }}>
              <Icon name={c.icon} size={11} color={c.tone} />
              {c.label}
            </span>
          ))}
        </div>
      )}

      <div className="hp-bar">
        <div
          className="hp-fill"
          style={{
            width: `${hpPct * 100}%`,
            background: unit.side === 'player' ? 'var(--hp-ally)' : 'var(--hp-enemy)',
          }}
        />
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
