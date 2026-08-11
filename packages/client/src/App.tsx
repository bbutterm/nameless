import { OrientationGate } from './components/OrientationGate';
import { RecruitTag } from './components/RecruitTag';
import { BattleScreen } from './screens/BattleScreen';
import { DeathScreen } from './screens/DeathScreen';
import { DialogueScreen } from './screens/DialogueScreen';
import { RangeScreen } from './screens/RangeScreen';
import { TitleScreen } from './screens/TitleScreen';
import { GameProvider, useGame } from './store/game';
import { t } from './i18n';
import '@nameless/content/palette.css';
import './theme.css';
import './screens.css';
/* Стили полигона — отдельным файлом, последним. Это прибор, а не экран игры:
   отдельный файл не даёт ему прирасти к `screens.css` и позволяет вынести его
   целиком, если он однажды перестанет быть нужен. Порядок важен — правила
   полигона стоят после игровых и не спорят с ними за вес селектора. */
import './range.css';

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
  // Полигон стоит выше боя не случайно: бой на полигоне идёт в режиме
  // `battle`, и порядок веток тут ни на что не влияет, а вот сама ветка —
  // единственный вход в прибор (адрес `#полигон`, см. store/game.tsx).
  if (mode === 'range') return <RangeScreen />;
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
