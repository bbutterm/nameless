import { useMemo, useState } from 'react';
import { content } from '../store/content';
import { useGame } from '../store/game';
import {
  BOT_MEASURED,
  clearScore,
  loadScore,
  partyIsFixed,
  pct,
  rangeRows,
  rangeTotals,
  saveSetup,
  RANGE_CHAPTERS,
  RANGE_LEVELS,
  RANGE_TIERS,
  type RangeChapter,
  type RangeRow,
  type RangeScore,
  type RangeSetup,
  type RangeTier,
} from '../lib/range';

/**
 * ПОЛИГОН БОЁВ — отладочный прибор владельца. Вход по адресу `#полигон`,
 * кнопки к нему нет ни на одном экране игры.
 *
 * Зачем он есть. Весь балансовый коридор замерен ботом — жадной эвристикой в
 * сорок строк. Играть будет человек, и разрыв между ними никогда не мерили:
 * чтобы измерить его честно, надо пройти игру целиком, то есть потратить час
 * на один замер. Здесь один бой отыгрывается десять раз за пять минут, и своя
 * доля побед стоит на экране рядом с долей бота на том же бою.
 *
 * Экран НАРОЧНО не переведён и не оформлен как остальная игра: это прибор, а
 * не место. Русский текст здесь прошит в разметку, а не заведён в `i18n` —
 * заводить строки прибора в словарь игры значит однажды показать их игроку.
 *
 * Сюжетного сейва (`nameless:save:v1`) этот экран не касается ни на чтение,
 * ни на запись: владелец проходит игру и гоняет полигон в один вечер, и
 * полигон, стерший прохождение, обесценил бы оба замера сразу.
 */
export function RangeScreen() {
  const { rangeFight, leaveRange } = useGame();
  // Счёт читается при каждом появлении экрана — а появляется он заново после
  // каждого боя, потому что на время боя размонтируется. Оттого исход,
  // записанный стором, виден сразу и без всякой подписки.
  const [score, setScore] = useState(loadScore);
  const [confirmReset, setConfirmReset] = useState(false);
  const setup = score.setup;

  const rows = useMemo(() => rangeRows(score), [score]);
  const totals = useMemo(() => rangeTotals(rows), [rows]);
  const chapterTitles = useMemo(
    () => new Map(content.chapters.map((c) => [c.index, c.title.ru])),
    [],
  );

  const change = (patch: Partial<RangeSetup>): void => {
    setScore(saveSetup({ ...setup, ...patch }));
  };

  // Главы идут по возрастанию; бой, в который не входит ни одна сцена,
  // попадает в группу 0 вместе с прологом — сирота на полигоне заметнее, чем
  // спрятанный в конце списка.
  const groups: { chapter: number; rows: RangeRow[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.chapter === r.chapter) last.rows.push(r);
    else groups.push({ chapter: r.chapter, rows: [r] });
  }

  return (
    <div className="screen range">
      <div className="range-head">
        <div className="range-title">Полигон боёв</div>
        <button className="range-exit" onClick={leaveRange}>
          выход
        </button>
      </div>

      <div className="range-setup">
        <div className="range-pick">
          <span>отряд</span>
          <div className="seg">
            {RANGE_CHAPTERS.map((c: RangeChapter) => (
              <button
                key={c}
                className={setup.chapter === c ? 'on' : ''}
                onClick={() => change({ chapter: c })}
              >
                гл. {c}
              </button>
            ))}
          </div>
        </div>
        <div className="range-pick">
          <span>уровень</span>
          <div className="seg">
            {RANGE_LEVELS.map((l) => (
              <button
                key={l}
                className={setup.level === l ? 'on' : ''}
                onClick={() => change({ level: l })}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="range-pick">
          <span>память</span>
          <div className="seg">
            {RANGE_TIERS.map((tier: RangeTier) => (
              <button
                key={tier}
                className={setup.tier === tier ? 'on' : ''}
                onClick={() => change({ tier })}
              >
                {tier === 0 ? 'нет' : tier === 1 ? 'I' : tier === 2 ? 'II' : 'III'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="range-list scroll">
        {groups.map((g) => (
          <div key={g.chapter} className="range-group">
            <div className="range-chapter">
              глава {g.chapter} · {chapterTitles.get(g.chapter) ?? '—'}
            </div>
            {g.rows.map((r) => (
              <button key={r.def.id} className="range-row" onClick={() => rangeFight(r.def.id, setup)}>
                <span className="range-row-name">
                  {r.def.name.ru}
                  {r.lethal && <em className="range-lethal">по сюжету проигрывается</em>}
                  {partyIsFixed(r.def) && <em className="range-fixed">отряд задан боем</em>}
                </span>
                <span className="range-row-nums">
                  <span className="range-bot">
                    {r.bot ? `бот ${pct(r.bot.winrate)} · ${r.bot.rounds.toFixed(1)} р.` : 'бот не мерен'}
                  </span>
                  <span className={r.tally ? 'range-me on' : 'range-me'}>
                    {r.tally
                      ? `ты ${r.tally.won}/${r.tally.played} · ${pct(r.tally.won / r.tally.played)}`
                      : 'ты —'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Итог — то самое число, ради которого прибор и построен. Разрыв в
          пунктах: насколько человек играет лучше жадной эвристики, которой
          замерен весь коридор. */}
      <div className="range-total">
        {totals.played === 0 ? (
          <div className="range-total-line">сыграно 0 боёв — сыграй хоть один, и появится разрыв</div>
        ) : (
          <div className="range-total-line">
            сыграно {totals.played} · ты <b>{pct(totals.human)}</b> · бот{' '}
            <b>{pct(totals.bot)}</b> на тех же боях · разрыв{' '}
            <b className={totals.gapPoints >= 0 ? 'gap-up' : 'gap-down'}>
              {totals.gapPoints > 0 ? '+' : ''}
              {totals.gapPoints}
            </b>{' '}
            п.
          </div>
        )}
        <div className="range-total-note">
          снимок бота от {BOT_MEASURED}
          {totals.unmeasured > 0 && ` · ${totals.unmeasured} прогонов вне снимка`}
        </div>
        <button
          className="range-reset"
          onClick={() => {
            if (!confirmReset) {
              setConfirmReset(true);
              return;
            }
            setConfirmReset(false);
            setScore(clearScoreKeepingSetup(setup));
          }}
        >
          {confirmReset ? 'точно обнулить?' : 'обнулить счёт'}
        </button>
      </div>
    </div>
  );
}

/**
 * Обнуление счёта не должно сбрасывать три переключателя: они не результат, а
 * положение ручек прибора, и сбивать их при обнулении — то же, что гасить свет
 * вместе с показаниями.
 */
function clearScoreKeepingSetup(setup: RangeSetup): RangeScore {
  clearScore();
  return saveSetup(setup);
}
