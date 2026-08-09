import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export interface ThreatLink {
  fromUid: string;
  toUid: string;
  /** Удар по игроку или помощь своим — цвет линии. */
  tone: 'danger' | 'ally';
  /** Этот ходит ближе всех: его линия ярче и толще. */
  strong: boolean;
}

interface Drawn {
  key: string;
  tone: 'danger' | 'ally';
  strong: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  head: string;
}

/** Точка на границе карточки в направлении (dx, dy) от её центра. */
function onEdge(cx: number, cy: number, hw: number, hh: number, dx: number, dy: number, pad: number) {
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
  return { x: cx + dx * k + (dx / len) * pad, y: cy + dy * k + (dy / len) * pad };
}

/**
 * Кто кого ударит. `intent.targetUid` движок считал с самого начала, но на
 * экране висела только иконка способности над врагом — «в кого» не показывал
 * никто, а это главное тактическое решение боя: прикрыть или добить.
 *
 * Рисуем пунктир от карточки врага к карточке цели со стрелкой на конце.
 * Координаты берём из `offsetLeft/offsetTop` карточек (а не из
 * `getBoundingClientRect`): рывки и тряска карт — это `transform`, и
 * прямоугольник во время анимации уезжает вместе с ними, а раскладка — нет.
 */
export function ThreatLayer({
  containerRef,
  links,
  dim,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  links: ThreatLink[];
  dim?: boolean;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [lines, setLines] = useState<Drawn[]>([]);
  // Список ссылок пересоздаётся каждым рендером — сравниваем по содержимому,
  // иначе измерение и setState загонят друг друга в петлю.
  const sig = links.map((l) => `${l.fromUid}>${l.toUid}${l.strong ? '!' : ''}${l.tone}`).join(',');

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const cards = new Map<string, HTMLElement>();
    root.querySelectorAll<HTMLElement>('[data-uid]').forEach((el) => {
      if (el.dataset.uid) cards.set(el.dataset.uid, el);
    });
    const out: Drawn[] = [];
    for (const l of links) {
      const a = cards.get(l.fromUid);
      const b = cards.get(l.toUid);
      if (!a || !b) continue;
      const ax = a.offsetLeft + a.offsetWidth / 2;
      const ay = a.offsetTop + a.offsetHeight / 2;
      const bx = b.offsetLeft + b.offsetWidth / 2;
      const by = b.offsetTop + b.offsetHeight / 2;
      const dx = bx - ax;
      const dy = by - ay;
      if (dx === 0 && dy === 0) continue;
      const start = onEdge(ax, ay, a.offsetWidth / 2, a.offsetHeight / 2, dx, dy, 2);
      const end = onEdge(bx, by, b.offsetWidth / 2, b.offsetHeight / 2, -dx, -dy, 3);
      const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      const ux = (end.x - start.x) / len;
      const uy = (end.y - start.y) / len;
      const back = 9;
      const wing = 4.5;
      const bxp = end.x - ux * back;
      const byp = end.y - uy * back;
      const head = `${end.x},${end.y} ${bxp - uy * wing},${byp + ux * wing} ${bxp + uy * wing},${byp - ux * wing}`;
      out.push({
        key: `${l.fromUid}>${l.toUid}`,
        tone: l.tone,
        strong: l.strong,
        x1: start.x,
        y1: start.y,
        x2: end.x - ux * (back - 2),
        y2: end.y - uy * (back - 2),
        head,
      });
    }
    setBox({ w: root.clientWidth, h: root.clientHeight });
    setLines(out);
    // links читается внутри, но пересборка завязана на sig — см. комментарий выше.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, sig]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [containerRef, measure]);

  if (lines.length === 0 || box.w === 0) return null;

  return (
    <svg
      className={`threat-layer${dim ? ' dim' : ''}`}
      width={box.w}
      height={box.h}
      viewBox={`0 0 ${box.w} ${box.h}`}
      aria-hidden="true"
    >
      {lines.map((l) => (
        <g key={l.key} className={`threat ${l.tone} ${l.strong ? 'strong' : ''}`}>
          <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
          <polygon points={l.head} />
        </g>
      ))}
    </svg>
  );
}
