import type { BattleState, Lang, UnitDef } from '@nameless/engine';
import { loc, t } from '../i18n';
import { cardImage, svgDataUri, unitCardSvg } from '../lib/art';

/**
 * Лента очереди хода. Движок держит `order` — порядок uid на раунд — и
 * `turnIndex`; на экране этого не было видно вовсе, и «чей сейчас ход» игрок
 * узнавал только по рывку карточки постфактум.
 *
 * Показываем текущего и ближайших: миниатюра арта той же карты + кольцо по
 * стороне (свой / враг). Текущий крупнее и в золоте — тем же цветом, что
 * обводка его карточки на поле, чтобы связь читалась без подписи.
 * Хвост очереди упирается в значок нового раунда: дальше порядок решает
 * бросок инициативы, и врать про него нельзя.
 */
const MAX_CHIPS = 7;

export function TurnQueue({
  battle,
  defs,
  lang,
}: {
  battle: BattleState;
  defs: Map<string, UnitDef>;
  lang: Lang;
}) {
  const upcoming = battle.order
    .slice(battle.turnIndex)
    .map((uid) => battle.units.find((u) => u.uid === uid))
    .filter((u): u is NonNullable<typeof u> => !!u && u.alive)
    .slice(0, MAX_CHIPS);

  if (upcoming.length === 0) return null;

  return (
    <div className="turn-queue" aria-hidden="true">
      {upcoming.map((u, i) => {
        const def = defs.get(u.defId);
        const art = def ? (cardImage(def.id) ?? svgDataUri(unitCardSvg(def.id, def.tier, def.faction))) : undefined;
        const name = def ? loc(def.name, lang) : u.defId;
        return (
          <div
            key={u.uid}
            className={['queue-chip', u.side, i === 0 ? 'now' : ''].filter(Boolean).join(' ')}
            title={name}
          >
            {art && <img className="queue-art" src={art} alt="" draggable={false} />}
            {/* Буква поверх арта: процедурные заглушки — почти чёрные силуэты,
                на 26px они неразличимы между собой, а буква имени различима. */}
            <span className="queue-letter">{name.slice(0, 1)}</span>
          </div>
        );
      })}
      {upcoming.length < MAX_CHIPS && (
        <div className="queue-chip queue-next-round" title={t(lang, 'nextRound')}>
          ↻
        </div>
      )}
    </div>
  );
}
