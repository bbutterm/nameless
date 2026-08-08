import type { Lang, Option } from '@nameless/engine';
import { loc } from '../i18n';
import { Icon } from './Icon';

/**
 * Кнопки выбора в зоне большого пальца. Чип на кнопке — это проверка
 * прошлой жизни: «[⚔ Смолокур] Взять за горло».
 */
export function ChoiceBar({
  options,
  prompt,
  lang,
  onPick,
}: {
  options: Option[];
  prompt?: string;
  lang: Lang;
  onPick: (id: string) => void;
}) {
  return (
    <div className="choices">
      {prompt && <div className="choice-prompt">{prompt}</div>}
      {options.map((o) => (
        <button
          key={o.id}
          className={`choice ${o.chip ? `chip-${o.chip.tone ?? 'life'}` : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onPick(o.id);
          }}
        >
          {o.chip && (
            <span className="chip">
              <Icon name={o.chip.icon} size={14} />
              <span>{loc(o.chip.label, lang)}</span>
            </span>
          )}
          <span className="choice-text">{loc(o.text, lang)}</span>
        </button>
      ))}
    </div>
  );
}
