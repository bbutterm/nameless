import type { Lang } from '@nameless/engine';

/**
 * Атрибуция заимствованных ассетов. Иконки game-icons и OpenGameArt идут под
 * CC BY 3.0, а она требует указания авторов в самой сборке, а не только в
 * репозитории. Строка живёт на титуле — единственном экране, который игрок
 * видит гарантированно.
 */
export function Attribution({ lang }: { lang: Lang }) {
  return (
    <div className="attribution">
      {lang === 'ru' ? (
        <>
          Иконки: <b>game-icons.net</b> — Lorc, Delapouite (CC BY 3.0). RPG-иконки: Lorc,
          OpenGameArt (CC BY 3.0). Интерфейс: <b>Kenney</b> (CC0). Шрифты: Playfair Display,
          PT Sans (OFL).
        </>
      ) : (
        <>
          Icons: <b>game-icons.net</b> — Lorc, Delapouite (CC BY 3.0). RPG icons: Lorc,
          OpenGameArt (CC BY 3.0). Interface: <b>Kenney</b> (CC0). Fonts: Playfair Display,
          PT Sans (OFL).
        </>
      )}
    </div>
  );
}
