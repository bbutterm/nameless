/**
 * Иконки способностей и намерений. Один набор на всю игру: одна толщина линии,
 * viewBox 24×24, никаких заливок — иначе экран боя рассыпается на «разные игры».
 */
const PATHS: Record<string, string> = {
  sword: 'M4 20l4-4M6.5 17.5L4 20M14 4l6 6-8 8-2-2-2 2-2-2 2-2-2-2 8-8z',
  bow: 'M5 3v18M5 12c8 0 12-4 14-9M5 12c8 0 12 4 14 9M19 3l-9 9',
  staff: 'M8 21L18 5M18 5a3 3 0 10-2-4M8 12h5',
  shield: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3z',
  poison: 'M12 3s5 6 5 10a5 5 0 01-10 0c0-4 5-10 5-10zM9 14h6',
  stun: 'M13 2L5 14h6l-2 8 8-12h-6l2-8z',
  heal: 'M12 5v14M5 12h14',
  fire: 'M12 3c1 4 5 5 5 9a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1 0 1-4 1-8z',
  ice: 'M12 2v20M4 7l16 10M20 7L4 17M12 6l-2-2m2 2l2-2m-2 14l-2 2m2-2l2 2',
  blood: 'M12 3c3 5 6 7 6 11a6 6 0 01-12 0c0-4 3-6 6-11z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z',
  chain: 'M9 7a4 4 0 000 8h1M15 17a4 4 0 000-8h-1M8 11h8',
  bone: 'M6 18a2.5 2.5 0 11-1-4l8-8a2.5 2.5 0 114 4l-8 8a2.5 2.5 0 11-3 0z',
  coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v10M9.5 9.5h5M9.5 14.5h5',
  candle: 'M12 3c1.5 2 2 3 2 4a2 2 0 11-4 0c0-1 .5-2 2-4zM9 11h6v10H9z',
  key: 'M15 3a6 6 0 100 12 6 6 0 000-12zM11 13L3 21m3-3l2 2m0-4l2 2',
  lock: 'M6 11h12v10H6zM9 11V7a3 3 0 016 0v4',
  skull: 'M12 3a8 8 0 00-5 14v4h10v-4a8 8 0 00-5-14zM9 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm6 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  wing: 'M3 6c8 0 14 4 18 12-6-1-9 0-12-2S5 10 3 6z',
  hammer: 'M4 20l8-8M10 10l4-4 2 2 4-4 2 2-4 4 2 2-4 4-6-6z',
  dagger: 'M12 2l3 9-3 4-3-4 3-9zM9 15h6M12 15v7',
  book: 'M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4V4zm16 0h-7a2 2 0 00-2 2v14a2 2 0 012-2h7V4z',
  hourglass: 'M6 2h12M6 22h12M7 2c0 6 5 6 5 10s-5 4-5 10M17 2c0 6-5 6-5 10s5 4 5 10',
  heart: 'M12 20s-8-4.5-8-10a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.5-8 10-8 10z',
  /*
   * «Заслонить». Отдельный знак, а не щит, и это не украшение:
   * DIRECTION_COMBAT §B.C1 прямо требует развести щит и заслон, потому что они
   * делают РАЗНОЕ — щит поглощает урон на месте, заслон уводит его в другое
   * тело. Со щитом заслон стоял бы на панели рядом («Взять на себя» и
   * «Заслонить» у одного и того же залога в первом же бою), и одинаковая
   * иконка сообщала бы игроку прямую неправду.
   * Рисунок: стоящий (вертикаль справа) и удар, свернувший к нему остриём, —
   * не «стена», а «принял на себя».
   */
  cover: 'M18 4v16M4 7h3a5 5 0 015 5h4M13 9l3 3-3 3',
};

/**
 * Настоящие иконки game-icons, если файл с таким именем лежит в
 * `packages/content/assets/icons/`. Формат оттуда — чёрный круг, белое кольцо
 * и белый глиф; фон и кольцо выбрасываются, остаётся глиф, который красится
 * в currentColor и потому подчиняется палитре игры.
 */
const rawIcons = import.meta.glob('../../../content/assets/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

interface Glyph {
  inner: string;
  viewBox: string;
}

const GLYPHS = new Map<string, Glyph>();
for (const [path, raw] of Object.entries(rawIcons)) {
  const name = (path.split('/').pop() ?? '').replace(/\.svg$/, '');
  const viewBox = /viewBox="([^"]+)"/.exec(raw)?.[1] ?? '0 0 512 512';
  const inner = raw
    .replace(/<\/?svg[^>]*>/g, '')
    // Фон у game-icons бывает двух видов — залитый круг и залитый прямоугольник
    // во весь холст. И то и другое выбрасываем: нам нужен только глиф,
    // чтобы он красился в currentColor и подчинялся палитре игры.
    .replace(/<circle(?![^>]*stroke)[^>]*\/>/g, '')
    .replace(/<circle[^>]*stroke="#fff"[^>]*\/>/g, '')
    .replace(/<path\s+d="M0 0h\d+v\d+H0z"\s*\/>/g, '')
    .replace(/fill="#fff"/g, 'fill="currentColor"')
    .replace(/stroke="#fff"/g, 'stroke="currentColor"')
    .trim();
  if (inner) GLYPHS.set(name, { inner, viewBox });
}

export function Icon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 1.6,
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const glyph = GLYPHS.get(name);
  if (glyph) {
    return (
      <svg
        viewBox={glyph.viewBox}
        width={size}
        height={size}
        fill={color}
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: glyph.inner }}
      />
    );
  }

  const d = PATHS[name] ?? PATHS['sword'];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS);
