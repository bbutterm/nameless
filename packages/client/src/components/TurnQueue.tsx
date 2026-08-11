import type { BattleState, Lang, UnitDef } from '@nameless/engine';
import { loc, t } from '../i18n';
import { cardImage } from '../lib/art';
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
 *
 * 3. **Видно, СКОЛЬКО ждать.** Лента показывала, чей ход идёт, но не отвечала
 *    на вопрос ожидающего: «сколько ещё чужих ходов до моего». Ожидание без
 *    конца ощущается дольше, чем оно есть, — а это ровно жалоба «не
 *    динамичная»: замер Б10 говорит, что ждать осталось секунду, но игрок
 *    этого не знал. Теперь ближайшее СВОЁ деление помечено золотом и несёт
 *    цифру — через сколько ходов оно наступит, а чужие деления до него горят
 *    полным светом (остальные приглушены). Цифра, а не слово: лента и так
 *    говорит знаками, и переводить тут нечего.
 */
const WINDOW = 8;

/**
 * Через сколько ходов очередь дойдёт до стороны игрока. 0 — уже дошла,
 * `undefined` — до конца раунда своих не осталось (тогда врать нельзя:
 * следующий порядок решает бросок инициативы).
 *
 * Живёт здесь, а не в экране боя, потому что считается по тому же `order`,
 * который рисует лента: два места, считающие «сколько ждать» по-разному, —
 * это две разные цифры на одном экране.
 */
export function turnsUntilPlayer(battle: BattleState): number | undefined {
  const rest = battle.order
    .slice(battle.turnIndex)
    .map((uid) => battle.units.find((x) => x.uid === uid))
    .filter((u): u is NonNullable<typeof u> => !!u && u.alive);
  const i = rest.findIndex((u) => u.side === 'player');
  return i < 0 ? undefined : i;
}

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

  // Ближайшее своё деление и расстояние до него — в тех же строках, что рисует
  // лента, иначе цифра указывала бы не на тот кружок.
  const mineIdx = nowIdx < 0 ? -1 : rows.findIndex((r, i) => i >= nowIdx && r.u.side === 'player');
  const untilMine = mineIdx < 0 ? -1 : mineIdx - nowIdx;

  return (
    <div className="turn-queue" aria-hidden="true">
      {win.map(({ u, done }, i) => {
        const at = start + i;
        // Ждущему нужен не «мой ход когда-нибудь», а «ещё два чужих и мой»,
        // поэтому метка живёт только пока ход чужой: в свой ход цифра «0» на
        // собственной карточке — шум.
        const mineNext = untilMine > 0 && at === mineIdx;
        const beforeMine = untilMine > 0 && at >= nowIdx && at < mineIdx;
        const def = defs.get(u.defId);
        // Лицо с карточки главнее знака: рисунок узнаётся быстрее абстрактного
        // глифа и, в отличие от него, есть у КАЖДОГО юнита — новые силы мира B
        // пришли без записи в спрайт-ленте знаков и падали на букву, то есть
        // ровно в ту болезнь, ради которой очередь и переделывали.
        const art = def ? cardImage(def.id) : undefined;
        const mark = art ? undefined : unitEmblem(def?.id, def?.faction);
        const name = def ? loc(def.name, lang) : u.defId;
        return (
          <div
            key={u.uid}
            className={[
              'queue-chip',
              u.side,
              done ? 'done' : '',
              u.uid === nowUid ? 'now' : '',
              mineNext ? 'mine-next' : '',
              beforeMine ? 'before-mine' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={name}
          >
            {mineNext && <span className="queue-eta">{untilMine}</span>}
            {art ? (
              <img className="queue-art" src={art} alt="" draggable={false} />
            ) : mark ? (
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
