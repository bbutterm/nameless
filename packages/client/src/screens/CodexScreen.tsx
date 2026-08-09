import { useEffect, useMemo, useState } from 'react';
import type { CodexEntry, CodexSource, Lang } from '@nameless/engine';
import { loc, t, type UiKey } from '../i18n';
import { content, idx } from '../store/content';
import { portraitImage } from '../lib/art';
import { hasPortrait, portraitSvg } from '@nameless/content/portraits';
import { placeEmblemByKey, speakerEmblem } from '../lib/emblems';
import { Icon } from '../components/Icon';
import { vibrate } from '../lib/haptics';
import { loadCodex, markEntrySeen, hasNew, type CodexEnvelope } from '../lib/codex';

/**
 * Помянник — справочник персонажей, который переживает смерть героя и «Новую
 * игру» (CODEX §4). Реюз каркаса `.sheet` из ArchiveSheet: стили, скролл и
 * закрытие уже оплачены, второй архив не плодим. Отличие от Описи в самом
 * смысле, а не в вёрстке — Опись про этот забег, Помянник про все забеги.
 *
 * Экран НЕ принимает `GameState`: книга не зависит от текущего забега вообще,
 * её можно открыть с титульного экрана, когда сейва нет и в помине.
 */

interface EntryRow {
  entry: CodexEntry;
  /** id строк этой записи, уже лежащих в книге. */
  foundLineIds: string[];
  isNew: boolean;
}

/**
 * Порядок списка — хронология вписания (CODEX §7): первое появление строки
 * записи в книге. `Object.keys` держит порядок вставки для нечисловых
 * строковых ключей — отдельного поля с меткой времени в конверте книги
 * заводить не пришлось (CODEX §9 фиксирует форму конверта, и в ней его нет).
 */
function buildRows(env: CodexEnvelope): EntryRow[] {
  const byId = new Map((content.codex ?? []).map((e) => [e.id, e]));
  const order: string[] = [];
  const known = new Set<string>();
  for (const lineId of Object.keys(env.lines)) {
    const entry = idx.codex.entryOfLine.get(lineId);
    if (!entry || known.has(entry.id)) continue;
    known.add(entry.id);
    order.push(entry.id);
  }
  const rows: EntryRow[] = [];
  for (const id of order) {
    const entry = byId.get(id);
    if (!entry) continue; // строка есть в книге, а записи в текущем контенте уже нет — переживаемо
    const foundLineIds = entry.lines.filter((l) => env.lines[l.id]).map((l) => l.id);
    rows.push({ entry, foundLineIds, isNew: hasNew(foundLineIds) });
  }
  return rows;
}

/** id строк записи, которые уже лежат в книге — для гашения точки «новое». */
function foundLineIdsForEntry(env: CodexEnvelope, entryId: string): string[] {
  const entry = (content.codex ?? []).find((e) => e.id === entryId);
  if (!entry) return [];
  return entry.lines.filter((l) => env.lines[l.id]).map((l) => l.id);
}

function sourceKey(source: CodexSource): UiKey {
  switch (source) {
    case 'seen':
      return 'codexSourceSeen';
    case 'heard':
      return 'codexSourceHeard';
    case 'after_death':
      return 'codexSourceAfterDeath';
    case 'last':
      return 'codexSourceLast';
  }
}

/**
 * Портрет: арт пользователя → лицо-гравюра → знак роли/жизни. Тот же порядок
 * и тот же рисовальщик, что в ленте диалога (Bubble.tsx), только крупнее и без
 * состояния забега: книгу открывают, когда сейва нет, и лицо в ней не имеет
 * права зависеть от того, сколько раз игрок умер в стёртом прохождении.
 *
 * Важно брать лицо именно из `@nameless/content/portraits`, а не одноимённую
 * функцию из `lib/art`: та отдаёт процедурную заглушку, и на 132px запись
 * показывала бы тёмный силуэт вместо единственного крупного лица в игре.
 */
function CodexPortrait({ entry, big }: { entry: CodexEntry; big?: boolean }) {
  const img = portraitImage(entry.id);
  const drawn = !img && hasPortrait(entry.id) ? portraitSvg(entry.id) : undefined;
  const cls = big ? 'codex-portrait-big' : 'codex-portrait';
  if (img) return <img className={cls} src={img} alt="" draggable={false} />;
  if (drawn) {
    return (
      <span
        className={`${cls} codex-portrait-face`}
        dangerouslySetInnerHTML={{ __html: drawn }}
        aria-hidden="true"
      />
    );
  }
  const life = entry.kind === 'life' ? content.lives.find((l) => l.id === entry.id) : undefined;
  return (
    <span className={`${cls} codex-portrait-fallback`} style={life ? undefined : speakerEmblem(entry.id)} aria-hidden="true">
      {life && <Icon name={life.icon} size={big ? 40 : 20} color="var(--accent)" />}
    </span>
  );
}

function CodexRow({ row, lang, onOpen }: { row: EntryRow; lang: Lang; onOpen: (id: string) => void }) {
  return (
    <button className="codex-row" onClick={() => onOpen(row.entry.id)}>
      <CodexPortrait entry={row.entry} />
      <div className="codex-row-text">
        <div className="codex-row-name">
          {loc(row.entry.name, lang)}
          {row.isNew && <span className="codex-dot" aria-hidden="true" />}
        </div>
        <div className="codex-row-blurb">{loc(row.entry.blurb, lang)}</div>
      </div>
    </button>
  );
}

function CodexList({
  rows,
  lang,
  onOpen,
}: {
  rows: EntryRow[];
  lang: Lang;
  onOpen: (id: string) => void;
}) {
  const people = rows.filter((r) => r.entry.kind === 'person');
  const lives = rows.filter((r) => r.entry.kind === 'life');
  return (
    <>
      <div className="codex-head">
        {/* Счётчик без знаменателя намеренно (CODEX §6): книга не обещает,
            сколько всего записей существует, только сколько уже вписано. */}
        <span className="codex-count">
          {t(lang, 'codexCount')}: {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="sheet-empty">{t(lang, 'codexEmpty')}</div>
      ) : (
        <>
          {people.map((row) => (
            <CodexRow key={row.entry.id} row={row} lang={lang} onOpen={onOpen} />
          ))}
          {lives.length > 0 && (
            <>
              <div className="codex-group-head">{t(lang, 'codexYou')}</div>
              {lives.map((row) => (
                <CodexRow key={row.entry.id} row={row} lang={lang} onOpen={onOpen} />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

function CodexRecord({ row, lang }: { row: EntryRow; lang: Lang }) {
  const { entry, foundLineIds } = row;
  const foundLines = entry.lines.filter((l) => foundLineIds.includes(l.id));
  // Линейки — по одной на ещё не найденную строку (CODEX §2, поле 5): честный
  // маркер неполноты, без «???» и без намёков на содержание.
  const missing = entry.lines.length - foundLines.length;
  return (
    <div className="codex-entry">
      <div className="codex-entry-head">
        <CodexPortrait entry={entry} big />
        <div className="codex-entry-name">{loc(entry.name, lang)}</div>
        <div className="codex-entry-blurb">{loc(entry.blurb, lang)}</div>
      </div>
      <div className="codex-signs">{loc(entry.signs, lang)}</div>
      <div className="codex-lines">
        {foundLines.map((line) => (
          <div key={line.id} className={`codex-line ${line.source === 'last' ? 'codex-line-last' : ''}`}>
            <div className="codex-line-source">{t(lang, sourceKey(line.source))}</div>
            <div className="codex-line-text">{loc(line.text, lang)}</div>
          </div>
        ))}
        {Array.from({ length: missing }).map((_, i) => (
          <div key={`rule-${i}`} className="codex-rule" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

export function CodexScreen({
  lang,
  onClose,
  initialEntryId,
}: {
  lang: Lang;
  onClose: () => void;
  /** Вход из церемонии смерти (CODEX §5, такт 2): сразу открыть запись, минуя
      список, и вернуть игрока не в список, а в церемонию по закрытию —
      единственное исключение из «два уровня, не больше» (CODEX §7). */
  initialEntryId?: string;
}) {
  const [env, setEnv] = useState<CodexEnvelope>(() => loadCodex());
  const [openId, setOpenId] = useState<string | undefined>(initialEntryId);
  const standalone = initialEntryId !== undefined;

  const rows = useMemo(() => buildRows(env), [env]);
  const openRow = openId ? rows.find((r) => r.entry.id === openId) : undefined;

  // Точка «есть новое» гаснет открытием записи (CODEX §7) — единственное
  // место, независимо от того, добрались ли до записи через список или сразу
  // (вход из церемонии смерти передаёт `initialEntryId` мимо `handleOpen`).
  // Зависимость только от `openId`: `env` в effect не входит намеренно —
  // `setEnv` внутри создаёт новый объект по ссылке и с `env` в зависимостях
  // это была бы бесконечная перерисовка.
  useEffect(() => {
    if (!openId) return;
    const ids = foundLineIdsForEntry(env, openId);
    if (ids.length === 0) return;
    markEntrySeen(ids);
    setEnv(loadCodex());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const handleOpen = (id: string) => {
    vibrate('tap');
    setOpenId(id);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet codex-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Книга пишется по мёртвому времени (CODEX §4) — водяной знак песочных
            часов тот же, что в церемонии смерти, а не леджер Описи: разный смысл. */}
        <span className="sheet-mark" style={placeEmblemByKey('hourglass')} aria-hidden="true" />
        <div className="sheet-body scroll">
          {openRow && !standalone && (
            <button className="ghost-button codex-back" onClick={() => setOpenId(undefined)}>
              {t(lang, 'codexBack')}
            </button>
          )}
          {openRow ? (
            <CodexRecord row={openRow} lang={lang} />
          ) : (
            <CodexList rows={rows} lang={lang} onOpen={handleOpen} />
          )}
        </div>
        <button className="ghost-button sheet-close" onClick={onClose}>
          {t(lang, standalone && openRow ? 'codexReturn' : 'close')}
        </button>
      </div>
    </div>
  );
}
