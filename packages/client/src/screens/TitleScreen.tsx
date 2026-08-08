import { useState } from 'react';
import type { Lang } from '@nameless/engine';
import { t } from '../i18n';
import { useGame } from '../store/game';
import { hapticsEnabled, setHaptics } from '../lib/haptics';
import { setSound, soundEnabled } from '../lib/sound';
import { Attribution } from '../components/Attribution';

export function TitleScreen() {
  const { lang, setLang, startNew, resume, hasSave, error } = useGame();
  const [confirm, setConfirm] = useState(false);
  const [haptics, setH] = useState(hapticsEnabled());
  const [sound, setS] = useState(soundEnabled());

  return (
    <div className="screen title">
      <div className="title-art">
        <div className="tower" />
      </div>
      <h1 className="title-name">{t(lang, 'title')}</h1>
      <div className="title-sub">{t(lang, 'subtitle')}</div>

      {error && <div className="title-error">{error}</div>}

      <div className="title-actions">
        {hasSave && (
          <button className="big-button" onClick={resume}>
            {t(lang, 'continue')}
          </button>
        )}
        {!confirm ? (
          <button
            className={hasSave ? 'ghost-button' : 'big-button'}
            onClick={() => (hasSave ? setConfirm(true) : startNew())}
          >
            {t(lang, hasSave ? 'newGame' : 'startGame')}
          </button>
        ) : (
          <div className="confirm">
            <div className="confirm-text">{t(lang, 'newGameWarn')}</div>
            <div className="confirm-row">
              <button className="ghost-button" onClick={() => setConfirm(false)}>
                {t(lang, 'no')}
              </button>
              <button className="big-button" onClick={startNew}>
                {t(lang, 'yes')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="title-settings">
        <div className="setting">
          <span>{t(lang, 'language')}</span>
          <div className="seg">
            {(['ru', 'en'] as Lang[]).map((l) => (
              <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <span>{t(lang, 'sound')}</span>
          <div className="seg">
            <button
              className={sound ? 'on' : ''}
              onClick={() => {
                setSound(true);
                setS(true);
              }}
            >
              ON
            </button>
            <button
              className={!sound ? 'on' : ''}
              onClick={() => {
                setSound(false);
                setS(false);
              }}
            >
              OFF
            </button>
          </div>
        </div>
        <div className="setting">
          <span>{t(lang, 'haptics')}</span>
          <div className="seg">
            <button
              className={haptics ? 'on' : ''}
              onClick={() => {
                setHaptics(true);
                setH(true);
              }}
            >
              ON
            </button>
            <button
              className={!haptics ? 'on' : ''}
              onClick={() => {
                setHaptics(false);
                setH(false);
              }}
            >
              OFF
            </button>
          </div>
        </div>
      </div>

      <Attribution lang={lang} />
    </div>
  );
}
