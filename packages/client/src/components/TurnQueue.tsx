import type { BattleState, Lang, UnitDef } from '@nameless/engine';
import { loc, t } from '../i18n';
import { unitEmblem } from '../lib/emblems';

/**
 * Лента очереди хода. Движок держит `order` — порядок uid на раунд — и
 * `turnIndex`; на экране этого не было видно вовсе, и «чей сейчас ход» игрок
 * узнавал только по рывку карточки постфактум.
 *
 * Здесь исправлены две вещи из первого захода.
 *
 * 1. **Не буква, а знак.** Подпись была первой буквой имени, и три «Багорщика»
 *    давали три одинаковых «Б» подряд — то есть ровно тот случай, ради которого
 *    очередь и заводилась, она не разбирала. Теперь в кружке тот же знак дома
 *    или спутника, что и на карточке этого юнита (`lib/emblems.ts`): очередь и
 *    доска говорят одним алфавитом, и «через два хода бьёт вон тот с ножом»
 *    читается без подписи. Тонкая обводка по стороне (свой/чужой) осталась.
 *
 * 2. **Лента больше не пустеет.** Показывались только те, кто ещё не ходил, и к
 *    середине раунда от очереди на четверых оставалось одно-два деления —
 *    полоса выглядела сломанной. Окно теперь постоянной длины: текущий и
 *    ближайшие, а если впереди осталось мало — хвост добирается уже
 *    отходившими (они гаснут). Значок нового раунда стоит только тогда, когда
 *    окно действительно дошло до конца раунда: дальше порядок решает бросок
 *    инициативы, и врать про него нельзя.
 */
const WINDOW = 8;

export function TurnQueue({
  battle,
  defs,
  lang,
}: {
  battle: BattleState;
  defs: Map<string, UnitDef>;
  lang: Lang;
}) {
  const rows = battle.order
    .map((uid, i) => ({ u: battle.units.find((x) => x.uid === uid), done: i < battle.turnIndex }))
    .filter((r): r is { u: NonNullable<typeof r.u>; done: boolean } => !!r.u && r.u.alive);

  if (rows.length === 0) return null;

  const nowIdx = rows.findIndex((r) => !r.done);
  const nowUid = rows[nowIdx]?.u.uid;
  // Окно всегда содержит текущего и по возможности WINDOW делений: сдвигаем
  // назад, пока хватает уже отходивших.
  const start = Math.max(0, Math.min(Math.max(0, nowIdx), rows.length - WINDOW));
  const win = rows.slice(start, start + WINDOW);
  const tailShown = start + win.length >= rows.length;

  return (
    <div className="turn-queue" aria-hidden="true">
      {win.map(({ u, done }) => {
        const def = defs.get(u.defId);
        const mark = unitEmblem(def?.id, def?.faction);
        const name = def ? loc(def.name, lang) : u.defId;
        return (
          <div
            key={u.uid}
            className={['queue-chip', u.side, done ? 'done' : '', u.uid === nowUid ? 'now' : '']
              .filter(Boolean)
              .join(' ')}
            title={name}
          >
            {mark ? (
              <span className="queue-mark" style={mark} />
            ) : (
              // Юнит без знака (такого в игре сейчас нет, но контент растёт) —
              // буква лучше пустого кружка.
              <span className="queue-letter">{name.slice(0, 1)}</span>
            )}
          </div>
        );
      })}
      {tailShown && (
        <div className="queue-chip queue-next-round" title={t(lang, 'nextRound')}>
          ↻
        </div>
      )}
    </div>
  );
}
