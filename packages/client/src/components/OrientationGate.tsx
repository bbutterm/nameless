import { useEffect, useState, type ReactNode } from 'react';
import type { Lang } from '@nameless/engine';
import { t } from '../i18n';

/**
 * Игра только портретная. При повороте — плашка, а не растянутый интерфейс.
 * Проверяем через соотношение сторон, а не screen.orientation:
 * на десктопе и в узких окнах это работает одинаково честно.
 */
export function OrientationGate({ lang, children }: { lang: Lang; children: ReactNode }) {
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setLandscape(w > h && h < 560);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (landscape) {
    return (
      <div className="rotate-gate">
        <div className="rotate-icon">▯</div>
        <div className="rotate-title">{t(lang, 'rotate')}</div>
        <div className="rotate-hint">{t(lang, 'rotateHint')}</div>
      </div>
    );
  }
  return <>{children}</>;
}
