import { OrientationGate } from './components/OrientationGate';
import { BattleScreen } from './screens/BattleScreen';
import { DeathScreen } from './screens/DeathScreen';
import { DialogueScreen } from './screens/DialogueScreen';
import { TitleScreen } from './screens/TitleScreen';
import { GameProvider, useGame } from './store/game';
import { t } from './i18n';
import './theme.css';
import './screens.css';

function Router() {
  const { mode, lang, error, toTitle } = useGame();

  if (mode === 'error') {
    return (
      <div className="screen title">
        <div className="title-error">{error ?? t(lang, 'saveError')}</div>
        <button className="big-button" onClick={toTitle}>
          {t(lang, 'close')}
        </button>
      </div>
    );
  }
  if (mode === 'battle') return <BattleScreen />;
  if (mode === 'death') return <DeathScreen />;
  if (mode === 'dialogue') return <DialogueScreen />;
  if (mode === 'end') {
    return (
      <div className="screen title">
        <h1 className="title-name">{t(lang, 'title')}</h1>
        <button className="big-button" onClick={toTitle}>
          {t(lang, 'close')}
        </button>
      </div>
    );
  }
  return <TitleScreen />;
}

function Shell() {
  const { lang } = useGame();
  return (
    <OrientationGate lang={lang}>
      <Router />
    </OrientationGate>
  );
}

export function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
