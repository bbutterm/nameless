import { useState } from 'react';
import type { Keyword, Lang, LocalizedText, SceneNode } from '@nameless/engine';
import { loc, t } from '../i18n';
import { hasPortrait, portraitSvg, type PortraitState } from '@nameless/content/portraits';
import { portraitImage } from '../lib/art';
import { speakerEmblem } from '../lib/emblems';

/** Подсветка ключевых слов внутри пузыря. Цвета — смысловые, не декоративные. */
function highlight(text: string, keywords: Keyword[] | undefined, lang: Lang) {
  if (!keywords || keywords.length === 0) return text;
  const marks = keywords
    .map((k) => ({ word: loc(k.match, lang), tone: k.tone }))
    .filter((k) => k.word && text.includes(k.word))
    .sort((a, b) => b.word.length - a.word.length);
  if (marks.length === 0) return text;

  const parts: (string | { word: string; tone: string })[] = [text];
  for (const m of marks) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (typeof p !== 'string') continue;
      const at = p.indexOf(m.word);
      if (at === -1) continue;
      parts.splice(i, 1, p.slice(0, at), { word: m.word, tone: m.tone }, p.slice(at + m.word.length));
      i += 2;
    }
  }
  return parts
    .filter((p) => p !== '')
    .map((p, i) =>
      typeof p === 'string' ? (
        <span key={i}>{p}</span>
      ) : (
        <b key={i} className={`kw kw-${p.tone}`}>
          {p.word}
        </b>
      ),
    );
}

export function SayBubble({
  speakerId,
  speakerName,
  text,
  keywords,
  lang,
  portraitState,
}: {
  speakerId: string;
  speakerName: string;
  text: LocalizedText;
  keywords?: Keyword[];
  lang: Lang;
  /** Лицо игрока сереет со смертями, Клёста — проявляется по главам. */
  portraitState: PortraitState;
}) {
  // Арт-слот пользователя главнее всего: положил картинку в assets/portraits/<id>
  // — она вытесняет всё. Дальше лицо-гравюра (docs/PORTRAITS.md), и только для
  // ролей без лица — знак роли (docs/ART_PASS.md §1). Порядок именно такой:
  // знак говорит «кто это по должности», лицо — «кто это».
  const img = portraitImage(speakerId);
  const drawn = !img && hasPortrait(speakerId) ? portraitSvg(speakerId, portraitState) : undefined;
  return (
    <div className="bubble-row">
      {img ? (
        <img className="portrait" src={img} alt="" draggable={false} />
      ) : drawn ? (
        <span
          className="portrait portrait-face"
          // Лицо — данные, а не разметка от пользователя: строка собирается
          // чистой функцией из id и состояния игры, снаружи в неё не попадает
          // ничего. Разбирать её в DOM-узлы ради ритуала значит платить за
          // каждый пузырь ленты, а их на экране до трёх десятков.
          dangerouslySetInnerHTML={{ __html: drawn }}
          aria-hidden="true"
        />
      ) : (
        <span className="portrait portrait-mark" style={speakerEmblem(speakerId)} aria-hidden="true" />
      )}
      <div className="bubble">
        <div className="bubble-name">{speakerName}</div>
        <div className="bubble-text">{highlight(loc(text, lang), keywords, lang)}</div>
      </div>
    </div>
  );
}

export function NarrationBubble({
  text,
  keywords,
  lang,
}: {
  text: LocalizedText;
  keywords?: Keyword[];
  lang: Lang;
}) {
  return <div className="narration">{highlight(loc(text, lang), keywords, lang)}</div>;
}

/** «▸ рассмотреть ближе» — лор прячется, чтобы не топить ленту. */
export function LoreBubble({
  title,
  text,
  lang,
}: {
  title: LocalizedText;
  text: LocalizedText;
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lore">
      <button
        className="lore-toggle"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className={`caret ${open ? 'open' : ''}`}>▸</span>
        <span>{open ? loc(title, lang) : `${loc(title, lang)} — ${t(lang, 'lookCloser')}`}</span>
      </button>
      {open && <div className="lore-text">{loc(text, lang)}</div>}
    </div>
  );
}

export type BubbleNode = Extract<SceneNode, { kind: 'say' | 'narration' | 'lore' }>;
