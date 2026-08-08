import { useEffect, useState } from 'react';
import type { Lang } from '@nameless/engine';
import { t } from '../i18n';

/**
 * Обучение ≤30 секунд: три подсказки, каждая появляется ровно в тот момент,
 * когда игрок впервые видит соответствующий интерфейс, и гаснет после действия.
 * Никаких модальных окон с текстом на полэкрана — это мобильная игра.
 */
export type TutorialStep = 'tap' | 'choice' | 'battle';

const KEY = 'nameless:tutorial';

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(step: TutorialStep): void {
  try {
    const s = seen();
    s.add(step);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    // не критично
  }
}

export function useTutorial(step: TutorialStep | undefined): {
  show: boolean;
  dismiss: () => void;
} {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!step) {
      setShow(false);
      return;
    }
    if (seen().has(step)) {
      setShow(false);
      return;
    }
    const appear = setTimeout(() => setShow(true), 700);
    // Подсказка гаснет сама. Кликать по ней нельзя: всплывашка над кнопками
    // выбора и панелью способностей перехватывала бы тапы по самой игре.
    const vanish = setTimeout(() => {
      markSeen(step);
      setShow(false);
    }, 6500);
    return () => {
      clearTimeout(appear);
      clearTimeout(vanish);
    };
  }, [step]);

  return {
    show,
    dismiss: () => {
      if (step) markSeen(step);
      setShow(false);
    },
  };
}

const TEXT: Record<TutorialStep, 'tutorialTap' | 'tutorialChoice' | 'tutorialBattle'> = {
  tap: 'tutorialTap',
  choice: 'tutorialChoice',
  battle: 'tutorialBattle',
};

export function TutorialHint({
  step,
  lang,
  anchor = 'bottom',
}: {
  step: TutorialStep | undefined;
  lang: Lang;
  anchor?: 'bottom' | 'center' | 'top';
}) {
  const { show } = useTutorial(step);
  if (!show || !step) return null;
  return (
    <div className={`tutorial tutorial-${anchor}`} aria-live="polite">
      <div className="tutorial-text">{t(lang, TEXT[step])}</div>
    </div>
  );
}
