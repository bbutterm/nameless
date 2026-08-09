import { useEffect, useState } from 'react';
import { loc, t } from '../i18n';
import { useGame } from '../store/game';
import { content } from '../store/content';
import { Icon } from '../components/Icon';
import { vibrate } from '../lib/haptics';
import { playSfx } from '../lib/sound';
import { placeEmblemByKey } from '../lib/emblems';

/**
 * Церемония смерти: очередь → Прилавок → выдача лота → чулан.
 * Это не экран поражения. Это единственный способ вернуть себе себя,
 * и он должен ощущаться как награда с горьким привкусом.
 */
export function DeathScreen() {
  const { reveal, lang, ackDeath, state } = useGame();
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    const a = setTimeout(() => setPhase(1), 1400);
    const b = setTimeout(() => {
      setPhase(2);
      vibrate('memory');
      playSfx('memory');
    }, 2800);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  if (!reveal) return null;
  const death = content.deaths.find((d) => d.id === reveal.deathId);

  return (
    <div className="screen death">
      <div className="ash" />
      {/* Церемония смерти была набрана одним шрифтом на пустоте. Песочные часы
          в цвете памяти — единственный знак на экране: он не иллюстрирует
          смерть, он называет то, что здесь на самом деле происходит, — срок. */}
      <span className="death-mark" style={placeEmblemByKey('hourglass')} aria-hidden="true" />

      <div className={`death-stage ${phase >= 0 ? 'in' : ''}`}>
        <div className="death-name">{loc(death?.name, lang)}</div>
        <div className="death-wake">{loc(death?.wakeText, lang)}</div>
      </div>

      {phase >= 1 && reveal.memory && (
        <div className="memory-card in">
          <div className="memory-head">
            <Icon name={reveal.memory.icon} size={18} color="var(--memory)" />
            <span>{t(lang, 'memoryLocked')}</span>
          </div>
          <div className="memory-name">{loc(reveal.memory.name, lang)}</div>
          {phase >= 2 && (
            <div className="memory-text in">{loc(reveal.memory.revelation, lang)}</div>
          )}
          <div className="memory-hint">{t(lang, 'memoryLockedHint')}</div>
        </div>
      )}

      {phase >= 2 && reveal.lifeAwakened && reveal.life && (
        <div className="life-card in">
          <div className="life-head">
            <Icon name={reveal.life.icon} size={16} color="var(--accent)" />
            <span>{t(lang, 'lifeAwakened')}</span>
          </div>
          <div className="life-name">{loc(reveal.life.name, lang)}</div>
          <div className="life-flavor">{loc(reveal.life.flavor, lang)}</div>
        </div>
      )}

      {phase >= 2 && (
        <div className="death-footer in">
          <div className="death-count">
            {t(lang, 'deathsCount')}: {state?.deaths ?? 0}
          </div>
          <button className="big-button" onClick={ackDeath}>
            {t(lang, 'proceed')}
          </button>
        </div>
      )}
    </div>
  );
}
