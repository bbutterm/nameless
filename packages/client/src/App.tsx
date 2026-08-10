import { OrientationGate } from './components/OrientationGate';
import { RecruitTag } from './components/RecruitTag';
import { BattleScreen } from './screens/BattleScreen';
import { DeathScreen } from './screens/DeathScreen';
import { DialogueScreen } from './screens/DialogueScreen';
import { TitleScreen } from './screens/TitleScreen';
import { GameProvider, useGame } from './store/game';
import { t } from './i18n';
import '@nameless/content/palette.css';
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
  const { lang, recruits, ackRecruit } = useGame();
  const joined = recruits[0];
  return (
    <OrientationGate lang={lang}>
      <Router />
      {/* Бирка вербовки живёт СНАРУЖИ экрана, а не внутри него: диалог
          продвигается тапом по всему `.screen`, и вложенная бирка отдавала бы
          свой клик ленте — игрок закрывал бы бирку и одновременно проматывал
          реплику. Экран под ней остаётся любым: вербовать может и узел перед
          боем, и награда за бой. */}
      {joined && <RecruitTag key={joined.uid} unit={joined} lang={lang} onClose={ackRecruit} />}
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
